"""Herramientas del agente.

Cada herramienta toca el sistema real: consulta disponibilidad, mueve la
seleccion y crea cotizaciones. El modelo no inventa precios: si no llamo a una
herramienta, no hay dato.
"""

from datetime import date
from secrets import token_hex

from langchain_core.tools import tool

from .catalog import Search, canonical, options, today
from .clients import Turismo, TurismoError

TIPOS = {"paquete": "paquete", "hotel": "hotel", "experiencia": "experiencia",
         "paquetes": "paquete", "hoteles": "hotel", "experiencias": "experiencia",
         "tour": "experiencia", "tours": "experiencia"}


def dinero(valor: float, moneda: str) -> str:
    return f"${valor:,.2f} {moneda}"


def build_tools(api: Turismo, chat_id: int, session: dict) -> list:
    """Crea las herramientas atadas a la sesion de un chat."""

    @tool
    async def buscar_servicios(
        tipo: str,
        destino: str,
        fecha: str,
        adultos: int = 1,
        menores: int = 0,
        fecha_salida: str | None = None,
    ) -> str:
        """Consulta disponibilidad real y deja las opciones listas para elegir.

        tipo: "paquete", "hotel" o "experiencia".
        fecha y fecha_salida en formato YYYY-MM-DD (fecha_salida solo para hotel).
        """
        clase = TIPOS.get(tipo.strip().lower())
        if clase is None:
            return "Tipo no válido: usa paquete, hotel o experiencia."

        try:
            inicio = date.fromisoformat(fecha)
            fin = date.fromisoformat(fecha_salida) if fecha_salida else None
        except ValueError:
            return "La fecha debe venir en formato YYYY-MM-DD."

        if clase == "hotel" and fin is None:
            return "Para un hotel necesito la fecha de salida (fecha_salida)."

        if inicio < today():
            return f"Esa fecha ya pasó: hoy es {today():%d/%m/%Y}. ¿Qué fecha quieres?"

        criterio = Search(kind=clase, destination=destino, start=inicio, end=fin,
                          adults=max(1, adultos), children=max(0, menores))

        try:
            encontrados = await options(api, criterio)
        except TurismoError:
            return "El catálogo no respondió. Intenta de nuevo en un momento."

        session["options"] = encontrados
        session["option_key"] = token_hex(6)
        session.pop("sugerencias_destino", None)

        if not encontrados:
            return (f"Sin cupo de {clase} en {destino} para esas fechas. "
                    "Puedes probar otro tipo (paquete, hotel o experiencia), otras fechas "
                    "o un destino cercano.")

        lineas = [
            f"{indice + 1}. {fila['label']} ({fila['detail']})"
            for indice, fila in enumerate(encontrados)
        ]
        return "Opciones disponibles (la interfaz muestra un botón por opción):\n" + "\n".join(lineas)

    @tool
    async def agregar_opcion(indice: int | None = None, nombre: str | None = None) -> str:
        """Agrega una opción de la lista. Indica el número (1 = primera) o parte del nombre."""
        filas = session.get("options") or []
        if not filas:
            return "No hay opciones cargadas; busca primero."

        elegida = None
        if nombre:
            buscado = canonical(nombre)
            for fila in filas:
                if buscado in canonical(fila["label"]):
                    elegida = fila
                    break
        if elegida is None and indice is not None:
            if not 1 <= indice <= len(filas):
                return f"No hay opción {indice}. Hay {len(filas)} disponibles."
            elegida = filas[indice - 1]
        if elegida is None:
            return "Dime cuál opción: el número o parte del nombre."

        fila = elegida
        cesta = session.setdefault("basket", [])
        if any(existente["item"] == fila["item"] for existente in cesta):
            return f"{fila['label']} ya está en la selección."
        cesta.append(fila)
        session.pop("quote", None)
        return f"Agregado: {fila['label']}. La selección tiene {len(cesta)} servicio(s)."

    @tool
    async def vaciar_seleccion() -> str:
        """Deja la selección vacía. Sirve si se agregaron opciones por error."""
        cuantas = len(session.get("basket") or [])
        session.pop("basket", None)
        session.pop("quote", None)
        return f"Selección vacía ({cuantas} servicio(s) quitados)."

    @tool
    async def cotizar() -> str:
        """Cotiza la selección actual con precios y cupo reales."""
        cesta = session.get("basket") or []
        if not cesta:
            return "La selección está vacía."

        try:
            cotizacion = await api.request("POST", "/quotes", auth=True,
                                           json={"items": [fila["item"] for fila in cesta]})
        except TurismoError as error:
            if error.code == "QUOTE_EXPIRED":
                return "La cotización venció. Vuelve a buscar para actualizar precios."
            return "No se pudo cotizar ahora mismo."

        session["quote"] = cotizacion
        total = dinero(float(cotizacion["total"]), cotizacion["currency"])
        detalle = "; ".join(
            f'{item["title"]} {dinero(float(item["total"]), cotizacion["currency"])}'
            for item in cotizacion["items"]
        )
        return (f"Cotización {cotizacion['reference']}: {detalle}. "
                f"Total {total}. Vence {cotizacion['expiresAt']} UTC.")

    @tool
    async def apartar() -> str:
        """Aparta la cotización actual y devuelve el enlace de pago.

        Pide confirmación al usuario antes de llamarla. Solo funciona con un
        servicio en la selección y una cotización vigente.
        """
        cotizacion = session.get("quote")
        if not cotizacion:
            return "Todavía no hay cotización. Usa cotizar primero."

        cesta = session.get("basket") or []
        if len(cesta) != 1:
            return "Para apartar hace falta un solo servicio en la selección."
        if cesta[0]["item"]["type"] not in {"package_departure", "room_stay", "experience_slot"}:
            return "Ese servicio todavía no se puede apartar en línea."

        try:
            reserva = await api.request(
                "POST", "/bookings/checkout", auth=True,
                json={"quoteId": cotizacion["quoteId"], "travelerRef": f"telegram:{chat_id}"},
            )
        except TurismoError as error:
            mensajes = {
                "QUOTE_EXPIRED": "La cotización venció: hay que cotizar de nuevo.",
                "INSUFFICIENT_AVAILABILITY": "Ya no hay cupo para esa fecha.",
                "BOOKING_ITEM_NOT_SUPPORTED": "Ese servicio no se puede apartar en línea.",
                "PAYPAL_NOT_CONFIGURED": "El pago no está disponible en este momento.",
            }
            return mensajes.get(error.code, "No se pudo apartar. Intenta de nuevo.")

        session["booking"] = reserva
        referencia = reserva.get("reference") or reserva["bookingId"]
        return (f"Apartado {referencia} por {dinero(float(reserva['total']), reserva['currency'])}. "
                f"El enlace de pago vence {reserva['expiresAt']} UTC: {reserva['paymentUrl']}")

    @tool
    async def consultar_reserva() -> str:
        """Devuelve el estado de la reserva de este chat, si existe."""
        reserva = session.get("booking")
        if not reserva:
            return "Este chat no tiene una reserva todavía."

        try:
            actual = await api.request(
                "GET", f"/bookings/{reserva['bookingId']}", auth=True,
                params={"travelerRef": f"telegram:{chat_id}"},
            )
        except TurismoError:
            return "No pude consultar la reserva ahora mismo."

        session["booking"] = actual
        # Si el pago se confirmo, el bot manda el QR en el siguiente envio.
        if actual.get("status") == "confirmed" and not session.get("ticket_sent"):
            session["ticket_pending"] = True
        claves = {
            "confirmed": "Pago confirmado",
            "pending_payment": "Apartado, pendiente de pago",
            "expired": "Apartado vencido",
            "payment_failed": "Pago rechazado",
            "capturing": "Verificando el pago",
        }
        estado = claves.get(actual["status"], actual["status"])
        referencia = actual.get("reference") or actual["bookingId"]
        return f"Reserva {referencia}: {estado}. Total {dinero(float(actual['total']), actual['currency'])}."

    @tool
    async def listar_destinos() -> str:
        """Lista los destinos con socios activos, para sugerir cuando el usuario no sabe a dónde ir."""
        try:
            regiones = await api.request("GET", "/regions", params={"limit": 20})
        except TurismoError:
            return "No pude consultar los destinos."

        nombres = [region["name"] for region in regiones][:8]
        session["sugerencias_destino"] = nombres
        if not nombres:
            return "Sin destinos cargados."

        return ("Destinos con socios activos: " + ", ".join(nombres) +
                ". Esto NO confirma cupo para una fecha; para eso hay que buscar_servicios. "
                "La interfaz ya muestra un botón por destino.")

    return [buscar_servicios, agregar_opcion, vaciar_seleccion, cotizar, apartar, consultar_reserva, listar_destinos]
