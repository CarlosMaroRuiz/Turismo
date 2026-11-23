import asyncio
from contextlib import asynccontextmanager, suppress
from hmac import compare_digest
import json
import logging
import re

from fastapi import FastAPI, HTTPException, Request
import httpx
from langchain_deepseek import ChatDeepSeek
from pydantic import SecretStr, field_validator
from pydantic_settings import BaseSettings, SettingsConfigDict

from .catalog import Search
from .clients import Telegram, Turismo, TurismoError
from .store import Store
from .workflow import booking_status, build_graph, friendly_error, message


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
    def __init__(self, store: Store, api: Turismo, telegram: Telegram, graph):
        self.store, self.api, self.telegram, self.graph = store, api, telegram, graph

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
        try:
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
        await self.telegram.call("sendMessage", outgoing)
        self.store.finish(row["id"])

    async def run(self) -> None:
        while True:
            update = self.store.next_update()
            if update:
                try:
                    await self.process(update)
                except Exception as exc:
                    log.warning("Reintento de actualización (%s)", type(exc).__name__)
                    self.store.retry(update)

            due = self.store.next_booking()
            if due:
                await self.check_booking(due)
            notice = self.store.next_notice()
            if notice:
                try:
                    await self.telegram.call("sendMessage", json.loads(notice["payload"]))
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
    logging.getLogger("httpx").setLevel(logging.WARNING)
    async with httpx.AsyncClient(timeout=20) as http:
        api = Turismo(http, settings.turismo_api_url, settings.turismo_client_id,
                      settings.turismo_client_secret.get_secret_value())
        telegram = Telegram(http, settings.telegram_bot_token.get_secret_value())
        extractor = None
        if settings.deepseek_api_key and settings.deepseek_api_key.get_secret_value().strip():
            extractor = ChatDeepSeek(
                model=settings.deepseek_model,
                api_key=settings.deepseek_api_key,
                max_tokens=512,
                timeout=15,
                max_retries=1,
                extra_body={"thinking": {"type": "disabled"}},
            ).with_structured_output(Search, method="json_mode", include_raw=True)
        app.state.store = store
        app.state.secret = settings.telegram_webhook_secret.get_secret_value()
        worker = asyncio.create_task(Bot(store, api, telegram, build_graph(api, extractor)).run())
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
