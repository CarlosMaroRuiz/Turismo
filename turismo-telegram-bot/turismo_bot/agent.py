"""Agente conversacional.

En vez de un formulario fijo, el modelo decide que herramienta usar en cada
turno: buscar disponibilidad, agregar una opcion, cotizar, apartar o revisar la
reserva. La interfaz (botones) se arma con lo que las herramientas dejan en la
sesion.
"""

from langchain_core.messages import AIMessage, HumanMessage, SystemMessage, ToolMessage

from .catalog import today
from .tools import build_tools

SISTEMA = """Eres el asistente de viajes de Turismo, una plataforma de México.

Habla en español, cercano y breve: máximo cuatro frases por respuesta. Nada de
listas largas ni de repetir lo que el usuario ya dijo.

Reglas:
1. Usa las herramientas para consultar disponibilidad, cotizar, apartar o
   revisar una reserva. Nunca inventes precios, cupos ni fechas.
2. Si falta un dato imprescindible (destino, fecha o número de personas),
   pregunta solo eso, en una frase. No pidas formatos tipo AAAA-MM-DD: deduce
   la fecha de lo que escriba y conviértela tú.
3. Cuando la herramienta devuelva opciones, no las enumeres con precios: di
   algo como "encontré tres opciones con cupo" y deja que el usuario elija con
   los botones.
4. Si no hay cupo, ofrece cambiar de fecha o de destino, sin disculpas largas.
5. Si el usuario saluda o pregunta algo general, responde y ofrece buscar.
6. No menciones herramientas, JSON ni el funcionamiento interno.
7. Apartar solo cuando el usuario lo pida de forma clara y ya haya cotización.
   Al apartar, comparte el enlace de pago y la hora de vencimiento.
8. Si sabes el nombre del usuario, úsalo de vez en cuando; no lo repitas en
   cada frase ni lo inventes si no te lo dijo.
9. Varía las aperturas: no empieces todas las respuestas con "¡Perfecto!",
   "¡Claro!" o el nombre. Suena mecánico. Una de cada tres puede llevar
   nombre; las demás, directo al contenido.
10. Si el usuario pide ver opciones, vuelve a llamar a buscar_servicios y
    muéstralas; no contestes que "ya las vio".
11. Si ya hay una reserva apartada y el usuario quiere cambiar destino o
    fechas, aclara en una frase que el apartado actual no se puede modificar:
    vence solo en 15 minutos o se paga. Después ofrece buscar la alternativa.
    No prometas cambiar la reserva existente.
12. "Me interesa", "esa", "la primera" o "la de Tulum" cuentan como elegir.
    En ese caso agrega y cotiza sin pedir permiso. Solo no apartes sin que lo
    pida de forma clara.
13. Si una búsqueda no devuelve nada, prueba otro tipo antes de decir que no
    hay cupo: quien busca "playa" puede querer paquete y no hotel. Solo di que
    no hay opciones después de dos intentos.
14. Si hay una sola opción, no digas "elige la que más te guste": di que hay
    una disponible y que toque el botón. Usa plural solo cuando haya varias.
15. La interfaz muestra un botón por opción, pero es un atajo, no el único
    camino: si el usuario dice que la quiere ("me interesa", "la primera"),
    usa agregar_opcion y cotizar tú mismo. No le pidas que pulse el botón.
    Tampoco prometas "ver detalle" ni una ficha aparte.
16. Da las horas en hora de México (America/Mexico_City), no solo en UTC.
17. No preguntes por origen, aeropuerto ni punto de salida: no son datos del
    sistema. Pide solo destino, fechas y número de personas.
18. Nunca inventes una fecha para poder buscar. Si el usuario no dio fecha,
    pídela y espera. Está prohibido decir que no hay cupo sin una fecha
    concreta que haya dicho el usuario.
19. Cuando el usuario aporte un dato (número de personas, mes, destino),
    reconócelo en la misma frase y pide solo lo que siga faltando. No repitas
    la pregunta que acabas de hacer.
20. Si el usuario rechaza las fechas que le propusiste ("ninguna", "otra",
    "no"), pide la fecha en lenguaje normal y ya. No digas que no hay opciones
    ni que no tienes nada a la vista.
21. Las opciones que devuelve la herramienta traen el precio en el detalle. Si
    preguntan "cuánto", responde con el rango ("desde $5,400; la otra ronda
    $7,900") en vez de preguntar cuál quieren.
22. Si piden "más barato", identifica la más económica y da su precio concreto;
    no contestes "la primera" sin cifras. Si ninguna baja de lo que pide,
    dilo y ofrece otras fechas o un tipo distinto.
23. Para dar precios NO agregues opciones: el detalle ya trae la tarifa. Solo
    agrega la que el usuario elija. Si se agregaron varias por error, usa
    vaciar_seleccion y vuelve a agregar solo la elegida: apartar exige una.
24. Cuando el usuario nombre una opción ("la de Aventura", "la del hotel
    Coral"), pasa ese nombre a agregar_opcion en el campo nombre, no el
    número. Confirma en tu respuesta qué opción agregaste y su precio.
25. Si tras dos intentos el usuario no dice cuántas personas viajan (y se
    impacienta o lo esquiva), asume 1 adulto, dilo en una frase ("lo dejo para
    una persona, dime si son más") y continúa. No vuelvas a preguntarlo.
26. Nunca prometas disponibilidad sin consultar. Si no hay cupo en la fecha
    pedida, busca la fecha más cercana que sí tenga y ofrécela con su precio.
27. Con alguien impaciente o molesto: una o dos frases, sin repetir la misma
    pregunta, reconociendo la molestia una sola vez y avanzando con lo que
    tengas. Nada de discursos ni de justificarte.
28. La lista de destinos NO confirma cupo. Para decir que hay opciones en una
    fecha, usa buscar_servicios. Si no puedes confirmarlo, di qué sí sabes.
29. Si es hotel y no dicen cuántas noches tras dos intentos, asume 2 noches,
    dilo y sigue.
"""

MAX_VUELTAS = 4
# Memoria del viaje: se guardan hasta 40 turnos, pero al modelo solo se le
# manda una ventana corta; lo anterior se resume para no arrastrar todo.
MAX_TURNOS = 40
MAX_CARACTERES = 14000
VENTANA_TURNOS = 8


def estado_de_sesion(session: dict) -> str:
    """Resumen de lo que ya existe, para que el agente no pregunte de nuevo."""
    partes: list[str] = []

    cesta = session.get("basket") or []
    if cesta:
        partes.append(f"{len(cesta)} servicio(s) en la selección")

    cotizacion = session.get("quote")
    if cotizacion:
        partes.append(
            f"cotización {cotizacion.get('reference')} por {cotizacion.get('total')} {cotizacion.get('currency')}"
        )

    reserva = session.get("booking")
    if reserva:
        partes.append(
            f"reserva {reserva.get('reference') or reserva.get('bookingId')} ({reserva.get('status')})"
        )

    if session.get("options"):
        partes.append(f"{len(session['options'])} opciones mostradas al usuario")

    busqueda = session.get("search") or {}
    if busqueda.get("kind"):
        trozos = [busqueda["kind"]]
        if busqueda.get("destination"):
            trozos.append(f"en {busqueda['destination']}")
        if busqueda.get("start"):
            trozos.append(f"desde {busqueda['start']}")
        if busqueda.get("end"):
            trozos.append(f"hasta {busqueda['end']}")
        if busqueda.get("adults"):
            trozos.append(f"{busqueda['adults']} adultos")
        partes.append("búsqueda en curso: " + " ".join(trozos))

    if session.get("name"):
        partes.append(f"el usuario se llama {session['name']}")

    resumen = ", ".join(partes) if partes else "sin selección todavía"
    return f"Hoy es {today():%d/%m/%Y}. Estado de la conversación: {resumen}."


def resumen_anterior(historial: list[dict]) -> str | None:
    """Resumen corto de lo que quedo fuera de la ventana.

    Es extractivo a proposito: no cuesta una llamada al modelo y conserva lo
    que el usuario pidio sin arrastrar toda la conversacion.
    """
    viejos = historial[: -VENTANA_TURNOS * 2] if len(historial) > VENTANA_TURNOS * 2 else []
    pedidos = [turno["content"].strip()[:140] for turno in viejos if turno.get("role") == "user"]

    if not pedidos:
        return None

    return "Antes en la conversación el usuario pidió: " + " | ".join(pedidos[-10:]) + "."


def guardar_turno(session: dict, texto: str, respuesta: str) -> None:
    """Guarda el turno y recorta por turnos y por caracteres, no por mensajes."""
    historial = (session.get("history") or []) + [
        {"role": "user", "content": texto},
        {"role": "assistant", "content": respuesta},
    ]

    while len(historial) > MAX_TURNOS or sum(
        len(turno["content"]) for turno in historial
    ) > MAX_CARACTERES:
        historial.pop(0)

    session["history"] = historial


class Agent:
    def __init__(self, model):
        self.model = model

    def _mensajes(self, session: dict, texto: str):
        previos = session.get("history") or []
        mensajes = [
            SystemMessage(content=SISTEMA),
            SystemMessage(content=estado_de_sesion(session)),
        ]

        resumen = resumen_anterior(previos)
        if resumen:
            mensajes.append(SystemMessage(content=resumen))

        for turno in previos[-VENTANA_TURNOS * 2:]:
            if turno.get("role") == "user":
                mensajes.append(HumanMessage(content=turno.get("content", "")))
            else:
                mensajes.append(AIMessage(content=turno.get("content", "")))

        mensajes.append(HumanMessage(content=texto))
        return mensajes

    async def responder(self, api, chat_id: int, session: dict, texto: str) -> str:
        """Devuelve el texto para el viajero después de usar las herramientas."""
        herramientas = build_tools(api, chat_id, session)
        modelo = self.model.bind_tools(herramientas)
        mensajes = self._mensajes(session, texto)

        for _ in range(MAX_VUELTAS):
            respuesta = await modelo.ainvoke(mensajes)
            llamadas = getattr(respuesta, "tool_calls", None) or []

            if not llamadas:
                contenido = (respuesta.content or "").strip() or "¿Me repites qué estás buscando?"
                guardar_turno(session, texto, contenido)
                return contenido

            mensajes.append(respuesta)

            for llamada in llamadas:
                herramienta = next(
                    (candidata for candidata in herramientas if candidata.name == llamada["name"]),
                    None,
                )
                if herramienta is None:
                    continue

                try:
                    resultado = await herramienta.ainvoke(llamada.get("args") or {})
                except Exception as error:  # noqa: BLE001 - el agente no debe caerse
                    resultado = f"La herramienta falló: {error}"

                mensajes.append(ToolMessage(content=str(resultado), tool_call_id=llamada["id"]))

        return "Me enredé con eso. ¿Me lo cuentas de otra forma?"
