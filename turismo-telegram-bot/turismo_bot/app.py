import asyncio
from contextlib import asynccontextmanager, suppress
from hmac import compare_digest
import json
import os
import traceback
import logging
import re

from fastapi import FastAPI, HTTPException, Request
import httpx
from langchain_deepseek import ChatDeepSeek
from pydantic import SecretStr, field_validator
from pydantic_settings import BaseSettings, SettingsConfigDict

from .agent import Agent
from .catalog import Extraccion
from .clients import Telegram, Turismo, TurismoError
from .store import Store
from .workflow import booking_status, build_graph, friendly_error, menu, message


log = logging.getLogger(__name__)


class Settings(BaseSettings):
    model_config = SettingsConfigDict(env_file=".env", env_file_encoding="utf-8", extra="ignore")
    telegram_bot_token: SecretStr
    telegram_webhook_secret: SecretStr
    turismo_api_url: str = "http://localhost:3000/api/v1"
    turismo_client_id: str
    turismo_client_secret: SecretStr
    deepseek_api_key: SecretStr | None = None
    deepseek_model: str = "deepseek-flash"
    bot_database: str = "bot.sqlite3"

    @field_validator("telegram_webhook_secret")
    @classmethod
    def valid_webhook_secret(cls, value: SecretStr) -> SecretStr:
        if not re.fullmatch(r"[A-Za-z0-9_-]{16,256}", value.get_secret_value()):
            raise ValueError("Usa un secreto de webhook de 16 a 256 caracteres")
        return value


class Bot:
    def __init__(self, store: Store, api: Turismo, telegram: Telegram, graph, agent=None):
        self.store, self.api, self.telegram, self.graph = store, api, telegram, graph
        self.agent = agent

    @staticmethod
    def nombre_limpio(texto: str) -> str:
        """Quita "con", "soy", "me llamo"... y deja el nombre presentable."""
        limpio = re.sub(r"^(?:soy|me llamo|mi nombre es|aqui|aquí|habla|con)\s+",
                        "", texto.strip(), flags=re.IGNORECASE).strip()
        limpio = limpio.strip(" .,!¡¿?").strip()
        if not limpio:
            return ""
        return limpio[:40].title()

    async def unir_mensajes(self, chat_id: int, update_id: int, texto: str) -> str:
        """Espera un momento por si el usuario sigue escribiendo y une los mensajes.

        Evita que el bot conteste tres veces a una idea partida en tres mensajes.
        """
        await asyncio.sleep(1.2)

        pendientes = self.store.pendientes_del_chat(chat_id, update_id)
        if not pendientes:
            return texto

        partes = [texto]
        for fila in pendientes:
            datos = json.loads(fila["payload"])
            partes.append((datos.get("message") or {}).get("text", ""))
            self.store.finish(fila["id"])

        return "\n".join(parte for parte in partes if parte).strip()

    async def _latido_escribiendo(self, chat_id: int) -> None:
        """Repite "escribiendo..." cada 4 segundos mientras se piensa la respuesta."""
        while True:
            await self.telegram.send_chat_action(chat_id, "typing")
            await asyncio.sleep(4)

    @asynccontextmanager
    async def escribiendo(self, chat_id: int):
        tarea = asyncio.create_task(self._latido_escribiendo(chat_id))
        try:
            yield
        finally:
            tarea.cancel()
            with suppress(asyncio.CancelledError):
                await tarea

    async def deliver(self, chat_id: int, session: dict, payload: dict) -> None:
        """Envía el mensaje y, si el pago se acaba de confirmar, el QR del comprobante."""
        await self.telegram.call("sendMessage", {"chat_id": chat_id, **payload})
        await self.send_ticket_qr(chat_id, session)

    async def send_ticket_qr(self, chat_id: int, session: dict) -> None:
        booking = session.get("booking") or {}
        if not session.get("ticket_pending") or not booking.get("bookingId"):
            return
        try:
            png = await self.api.binary(
                f'/bookings/{booking["bookingId"]}/qr.png',
                params={"travelerRef": f"telegram:{chat_id}"},
            )
            await self.telegram.send_photo(
                chat_id, png, "Muestra este QR al proveedor al iniciar el servicio."
            )
            session["ticket_sent"] = True
        except (TurismoError, RuntimeError):
            log.warning("No se pudo enviar el QR de la reserva")
        finally:
            session.pop("ticket_pending", None)

    async def process(self, row) -> None:
        if row["response"]:
            await self.telegram.call("sendMessage", json.loads(row["response"]))
            self.store.finish(row["id"])
            return

        update = json.loads(row["payload"])
        callback = update.get("callback_query")
        event = callback.get("message", {}) if callback else update.get("message", {})
        chat = event.get("chat", {})
        if chat.get("type") != "private":
            self.store.finish(row["id"])
            return

        chat_id = chat["id"]
        text = event.get("text", "")
        action = ""
        if callback:
            if callback.get("from", {}).get("id") != chat_id:
                self.store.finish(row["id"])
                return
            action = callback.get("data", "")
            with suppress(RuntimeError):
                await self.telegram.call("answerCallbackQuery", {"callback_query_id": callback["id"]})
        elif not text:
            self.store.finish(row["id"])
            return
        elif text.startswith("/"):
            command = text.split()[0].partition("@")[0]
            action = {"/start": "start", "/reserva": "status", "/cotizar": "quote"}.get(command, "start")

        session = self.store.load(chat_id)

        # Primer mensaje despues de /start: es el nombre del viajero.
        if session.get("awaiting_name") and action == "" and text:
            posible = self.nombre_limpio(text)
            parece_busqueda = bool(re.search(
                r"\b(hotel|hoteles|paquete|paquetes|experiencia|tour|busco|quiero ir|reservar|viajar)\b",
                posible, re.IGNORECASE,
            ))
            if 1 <= len(posible) <= 40 and not parece_busqueda:
                session["name"] = posible
                session.pop("awaiting_name", None)
                payload = menu(posible)
                outgoing = {"chat_id": chat_id, **payload}
                self.store.stage(row["id"], chat_id, session, outgoing)
                await self.deliver(chat_id, session, payload)
                self.store.finish(row["id"])
                return
            session.pop("awaiting_name", None)

        # Texto libre: lo atiende el agente con herramientas. Los botones y
        # comandos siguen por el flujo guiado, que es determinista.

        if action == "" and text and self.agent is not None:
            try:
                async with self.escribiendo(chat_id):
                    respuesta = await self.agent.responder(self.api, chat_id, session, text)
                payload = message(respuesta, *self.botones_de_sesion(session))
                outgoing = {"chat_id": chat_id, **payload}
                self.store.stage(row["id"], chat_id, session, outgoing)
                await self.deliver(chat_id, session, payload)
                self.store.finish(row["id"])
                return
            except Exception as exc:  # noqa: BLE001 - si el agente falla, se sigue igual
                log.warning("El agente falló, se usa el flujo guiado (%s)", type(exc).__name__)

        try:
            async with self.escribiendo(chat_id):
                result = await self.graph.ainvoke({
                    "chat_id": chat_id, "text": text, "action": action, "session": session,
                })
            payload = result["response"]
            session = result["session"]
        except TurismoError as exc:
            payload = friendly_error(exc)
        except Exception as exc:
            log.warning("Error al procesar conversación (%s)", type(exc).__name__)
            payload = message("No pude procesar el mensaje. Puedes continuar con /start.")
        outgoing = {"chat_id": chat_id, **payload}
        self.store.stage(row["id"], chat_id, session, outgoing)
        await self.deliver(chat_id, session, payload)

        # El sticker va despues del saludo: primero se lee, luego se ve.
        if action == "start":
            ruta = os.environ.get("WELCOME_STICKER", "turismo_bot/assets/welcome.webp")
            if os.path.exists(ruta):
                try:
                    await self.telegram.send_sticker(chat_id, ruta)
                except RuntimeError:
                    log.warning("No se pudo enviar el sticker de bienvenida")

        self.store.finish(row["id"])

    @staticmethod
    def botones_de_sesion(session: dict) -> list[list[dict]]:
        """Botones de las opciones y la selección que dejan las herramientas."""
        filas: list[list[dict]] = []
        opciones = session.get("options") or []
        clave = session.get("option_key")

        if clave and opciones:
            filas = [
                [{"text": f'{fila["label"]} · {fila["detail"]}'[:75], "callback_data": f"add:{clave}:{indice}"}]
                for indice, fila in enumerate(opciones[:5])
            ]

        destinos = session.get("sugerencias_destino") or []
        if not filas and destinos:
            fila: list[dict] = []
            for nombre in destinos:
                fila.append({"text": nombre, "callback_data": f"dest:{nombre}"})
                if len(fila) == 2:
                    filas.append(fila)
                    fila = []
            if fila:
                filas.append(fila)

        if session.get("basket"):
            filas.append([{"text": "🛒 Ver selección", "callback_data": "basket"}])

        return filas

    async def run(self) -> None:
        while True:
            update = self.store.next_update()
            if update:
                try:
                    await self.process(update)
                except Exception as exc:
                    log.warning("Reintento de actualización (%s): %s", type(exc).__name__, traceback.format_exc())
                    self.store.retry(update)

            due = self.store.next_booking()
            if due:
                await self.check_booking(due)
            notice = self.store.next_notice()
            if notice:
                payload = json.loads(notice["payload"])
                try:
                    await self.telegram.call("sendMessage", payload)
                    chat_id = payload.get("chat_id")
                    if chat_id is not None:
                        session = self.store.load(chat_id)
                        await self.send_ticket_qr(chat_id, session)
                        self.store.save(chat_id, session)
                    self.store.finish_notice(notice["booking_id"])
                except RuntimeError:
                    self.store.retry_notice(notice["booking_id"])
            if not (update or due or notice):
                await asyncio.sleep(0.5)

    async def check_booking(self, due) -> None:
        chat_id = due["chat_id"]
        session = json.loads(due["state"])
        try:
            response = await booking_status(self.api, chat_id, session)
        except TurismoError:
            self.store.defer_booking(chat_id)
            return
        booking = session["booking"]
        with self.store.db:
            self.store.save(chat_id, session)
            if booking["status"] in {"confirmed", "expired", "payment_failed"}:
                self.store.notify(booking["bookingId"], {"chat_id": chat_id, **response})


@asynccontextmanager
async def lifespan(app: FastAPI):
    settings = Settings()
    store = Store(settings.bot_database)
    descartadas = store.descartar_antiguas()
    if descartadas:
        log.info("Se descartaron %s actualizaciones viejas de la cola", descartadas)
    logging.getLogger("httpx").setLevel(logging.WARNING)
    async with httpx.AsyncClient(timeout=20) as http:
        api = Turismo(http, settings.turismo_api_url, settings.turismo_client_id,
                      settings.turismo_client_secret.get_secret_value())
        telegram = Telegram(http, settings.telegram_bot_token.get_secret_value())
        extractor = None
        modelo = None
        if settings.deepseek_api_key and settings.deepseek_api_key.get_secret_value().strip():
            modelo = ChatDeepSeek(
                model=settings.deepseek_model,
                api_key=settings.deepseek_api_key,
                max_tokens=512,
                timeout=15,
                max_retries=1,
                extra_body={"thinking": {"type": "disabled"}},
            )
            extractor = modelo.with_structured_output(Extraccion, method="json_mode", include_raw=True)
        agent = Agent(modelo) if modelo is not None else None
        app.state.store = store
        app.state.secret = settings.telegram_webhook_secret.get_secret_value()
        worker = asyncio.create_task(Bot(store, api, telegram, build_graph(api, extractor), agent).run())
        app.state.worker = worker
        try:
            yield
        finally:
            worker.cancel()
            try:
                with suppress(asyncio.CancelledError):
                    await worker
            finally:
                store.db.close()


app = FastAPI(title="Turismo Telegram Bot", lifespan=lifespan)


@app.get("/health")
async def health(request: Request):
    if request.app.state.worker.done():
        raise HTTPException(503, "Procesador de mensajes detenido")
    return {"ok": True}


@app.post("/telegram/webhook", status_code=204)
async def telegram_webhook(request: Request) -> None:
    secret = request.headers.get("X-Telegram-Bot-Api-Secret-Token", "")
    if not compare_digest(secret.encode(), request.app.state.secret.encode()):
        raise HTTPException(401, "Webhook no autorizado")
    body = bytearray()
    async for chunk in request.stream():
        body.extend(chunk)
        if len(body) > 128 * 1024:
            raise HTTPException(413, "Actualización demasiado grande")
    try:
        update = json.loads(body)
    except (ValueError, UnicodeError):
        raise HTTPException(400, "Actualización inválida") from None
    if not isinstance(update, dict) or type(update.get("update_id")) is not int:
        raise HTTPException(400, "Actualización inválida")
    request.app.state.store.enqueue(update)
