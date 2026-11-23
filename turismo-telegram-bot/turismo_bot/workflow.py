from datetime import date, timedelta
import re
from secrets import token_hex
from typing import TypedDict

from langgraph.graph import END, START, StateGraph

from .catalog import Extraccion, QuickReply, Search, ServiceKind, options, today
from .clients import Turismo, TurismoError

# Tipos de ítem que ya pueden procesarse en checkout
_CHECKOUT_TYPES = {"package_departure", "room_stay", "experience_slot"}

MESES_ES = {
    "enero": 1, "ene": 1,
    "febrero": 2, "feb": 2,
    "marzo": 3, "mar": 3,
    "abril": 4, "abr": 4,
    "mayo": 5, "may": 5,
    "junio": 6, "jun": 6,
    "julio": 7, "jul": 7,
    "agosto": 8, "ago": 8,
    "septiembre": 9, "sep": 9, "setiembre": 9,
    "octubre": 10, "oct": 10,
    "noviembre": 11, "nov": 11,
    "diciembre": 12, "dic": 12,
}


def parse_spanish_date(text: str, current_year: int) -> date | None:
    """Extrae una fecha en español (ej. '10 de diciembre', '10 dic', '10/12/2026')."""
    # 1. Rango numérico ISO: 2026-12-01
    iso = re.search(r"\b(\d{4})-(\d{1,2})-(\d{1,2})\b", text)
    if iso:
        try:
            return date(int(iso.group(1)), int(iso.group(2)), int(iso.group(3)))
        except ValueError:
            pass

    # 2. Formato barra: 01/12/2026 o 01/12
    slash = re.search(r"\b(\d{1,2})[/-](\d{1,2})(?:[/-](\d{4}))?\b", text)
    if slash:
        try:
            d, m = int(slash.group(1)), int(slash.group(2))
            y = int(slash.group(3)) if slash.group(3) else current_year
            return date(y, m, d)
        except ValueError:
            pass

    # 3. Formato texto: "10 de diciembre", "10 dic", "10 de diciembre del 2026"
    m = re.search(
        r"\b(\d{1,2})\s*(?:de)?\s*(enero|febrero|marzo|abril|mayo|junio|julio|agosto|septiembre|setiembre|octubre|noviembre|diciembre|ene|feb|mar|abr|may|jun|jul|ago|sep|oct|nov|dic)\b(?:\s*(?:de|del)?\s*(\d{4}))?",
        text,
        re.IGNORECASE
    )
    if m:
        d = int(m.group(1))
        mes = MESES_ES.get(m.group(2).lower())
        if mes:
            y = int(m.group(3)) if m.group(3) else current_year
            try:
                res = date(y, mes, d)
                if not m.group(3) and res < today():
                    res = date(y + 1, mes, d)
                return res
            except ValueError:
                pass
    return None


def parse_spanish_date_range(text: str, current_year: int) -> tuple[date | None, date | None]:
    """Detecta rangos de fechas (ej. 'del 1 al 10 de diciembre' o '1 a 10 de diciembre')."""
    m = re.search(
        r"\b(?:del\s+)?(\d{1,2})\s*(?:al?|-)\s*(\d{1,2})\s*(?:de)?\s*(enero|febrero|marzo|abril|mayo|junio|julio|agosto|septiembre|setiembre|octubre|noviembre|diciembre|ene|feb|mar|abr|may|jun|jul|ago|sep|oct|nov|dic)\b(?:\s*(?:de|del)?\s*(\d{4}))?",
        text,
        re.IGNORECASE
    )
    if m:
        d1, d2 = int(m.group(1)), int(m.group(2))
        mes = MESES_ES.get(m.group(3).lower())
        if mes:
            y = int(m.group(4)) if m.group(4) else current_year
            try:
                inicio = date(y, mes, d1)
                fin = date(y, mes, d2)
                if not m.group(4) and inicio < today():
                    inicio = date(y + 1, mes, d1)
                    fin = date(y + 1, mes, d2)
                return (inicio, fin)
            except ValueError:
                pass
    return (None, None)


def parse_nights(text: str) -> int | None:
    m = re.search(r"\b(\d{1,2})\s*(?:noches?|dias?)\b", text, re.IGNORECASE)
    return int(m.group(1)) if m else None


def button(text: str, action: str) -> dict:
    return {"text": text, "callback_data": action}


def message(text: str, *rows: list[dict]) -> dict:
    result = {"text": text}
    if rows:
        result["reply_markup"] = {"inline_keyboard": list(rows)}
    return result


def money(value: float, currency: str) -> str:
    return f"${value:,.2f} {currency}"


def fechas_rapidas() -> list[list[dict]]:
    """Atajos para no escribir la fecha: hoy, manana, el sabado y en dos semanas."""
    hoy = today()
    dias_al_sabado = (5 - hoy.weekday()) % 7 or 7
    sabado = hoy + timedelta(days=dias_al_sabado)

    return [
        [button("Hoy", f"date:{hoy.isoformat()}"),
         button("Manana", f"date:{(hoy + timedelta(days=1)).isoformat()}")],
        [button("Este sabado", f"date:{sabado.isoformat()}"),
         button("En 2 semanas", f"date:{(hoy + timedelta(days=14)).isoformat()}")],
    ]


def botones_noches() -> list[dict]:
    """Cantidad de noches para una estancia, sin escribir fechas."""
    return [button("1 noche", "nights:1"), button("2 noches", "nights:2"),
            button("3 noches", "nights:3"), button("1 semana", "nights:7")]


def welcome() -> dict:
    """Primer mensaje: saludo y nombre, sin menu todavia."""
    return message(
        "¡Hola! Hoy seré tu asistente de viaje. ¿Con quién tengo el gusto?"
    )


def menu(nombre: str) -> dict:
    """Menu de servicios, ya con el nombre del viajero."""
    return message(
        f"Mucho gusto, {nombre}. ¿Qué te gustaría hacer hoy?",
        [button("📦 Paquetes", "search:paquete"),
         button("🏨 Hoteles", "search:hotel"),
         button("🧗 Experiencias", "search:experiencia")],
        [button("🛒 Ver mi selección", "basket"), button("🎫 Consultar mi reserva", "status")],
    )

EXAMPLES = {
    "paquete": "San Cristóbal de las Casas | AAAA-MM-DD | 2 | 0",
    "hotel": "San Cristóbal de las Casas | AAAA-MM-DD | AAAA-MM-DD | 2 | 0",
    "experiencia": "San Cristóbal de las Casas | AAAA-MM-DD | 2 | 0",
}


def search_prompt(kind: ServiceKind | None) -> str:
    if kind is None:
        return "Indica si buscas un paquete, hotel o experiencia."
    dates = "fecha de entrada y salida" if kind == "hotel" else "fecha del viaje"
    return (
        f"Cuéntame el destino, {dates} y cuántos viajeros son "
        f"(adultos y menores si aplica).\n"
        f"Formato rápido: {EXAMPLES[kind]}"
    )


def missing_search_details(criteria: Search) -> str | None:
    missing = []
    if criteria.kind is None:
        missing.append("si buscas un paquete, hotel o experiencia")
    if not criteria.destination:
        missing.append("el destino")
    if criteria.start is None:
        missing.append("la fecha de entrada" if criteria.kind == "hotel" else "la fecha")
    if criteria.kind == "hotel" and criteria.end is None:
        missing.append("la fecha de salida")
    if criteria.adults is None:
        missing.append("cuántos adultos viajan")
    if missing == ["cuántos adultos viajan"]:
        return "¿Cuántos adultos viajan? Puedes responder con el número."
    if missing:
        return f"Indícame {', '.join(missing[:-1]) + ' y ' if len(missing) > 1 else ''}{missing[-1]}."
    return None


def titulo_lugar(texto: str) -> str:
    """Capitaliza el destino sin romper 'Playa del Carmen' ni 'San Cristobal de las Casas'."""
    minusculas = {"de", "del", "la", "las", "los", "y", "el"}
    partes = texto.split()
    return " ".join(
        parte if indice > 0 and parte.lower() in minusculas else parte.capitalize()
        for indice, parte in enumerate(partes)
    )


def buscar_resumen(criteria: Search) -> str | None:
    """Lo que ya se entendio, en una frase natural (se usa para reconocer avances)."""
    partes: list[str] = []

    if criteria.kind is not None:
        partes.append({"hotel": "hotel", "paquete": "paquete", "experiencia": "experiencia"}[criteria.kind])
    if criteria.destination:
        partes.append(f"en {titulo_lugar(criteria.destination)}")
    if criteria.start and criteria.end:
        partes.append(f"del {criteria.start:%d/%m} al {criteria.end:%d/%m/%Y}")
    elif criteria.start:
        partes.append(f"el {criteria.start:%d/%m/%Y}")
    if criteria.adults:
        partes.append(f"para {criteria.adults} adulto{'s' if criteria.adults != 1 else ''}")
    if criteria.children:
        partes.append(f"y {criteria.children} menor{'es' if criteria.children != 1 else ''}")

    return " ".join(partes) if partes else None

def missing_search_response(criteria: Search) -> dict:
    """Genera la respuesta con botones interactivos cuando faltan datos."""
    detail_str = missing_search_details(criteria)
    if not detail_str:
        return message("Por favor indica los detalles de tu búsqueda.")

    # Se reconoce lo que el usuario ya dijo: repetir la lista completa se siente
    # como si el bot no escuchara.
    resumen = buscar_resumen(criteria)
    prefijo = f"Anotado: {resumen}. " if resumen else ""

    # 1. Si falta el tipo de servicio (kind)
    if criteria.kind is None:
        dest_txt = f" para {criteria.destination.title()}" if criteria.destination else ""
        return message(
            f"{prefijo}¿Qué servicio buscas{dest_txt}? Elige una opción:",
            [button("Paquetes", "search:paquete"),
             button("Hoteles", "search:hotel"),
             button("Experiencias", "search:experiencia")]
        )

    # 2. Si solo faltan adultos (compatibilidad exacta con test_checkout.py)
    if detail_str == "¿Cuántos adultos viajan? Puedes responder con el número.":
        return message(
            "¿Cuántos adultos viajan? Puedes responder con el número.",
            [button("1 adulto", "adults:1"), button("2 adultos", "adults:2"),
             button("3 adultos", "adults:3"), button("4 adultos", "adults:4")]
        )

    # 3. Si es hotel y falta solo la fecha de salida (end)
    if criteria.kind == "hotel" and criteria.start and not criteria.end:
        return message(
            f"{prefijo}¿Cuál es tu fecha de salida o cuántas noches te hospedarás?",
            botones_noches(),
        )

    # 4. Si falta la fecha, se ofrecen atajos ademas de pedirla
    if criteria.start is None:
        return message(f"{prefijo}{detail_str}", *fechas_rapidas())

    return message(f"{prefijo}{detail_str}")


def parse_form(text: str, kind: ServiceKind | None) -> Search:
    if "|" not in text or kind is None:
        return Search()
    fields = [field.strip() for field in text.split("|")]
    if len(fields) != (5 if kind == "hotel" else 4):
        raise ValueError("Formato incorrecto")
    return Search(
        kind=kind,
        destination=fields[0],
        start=date.fromisoformat(fields[1]),
        end=date.fromisoformat(fields[2]) if kind == "hotel" else None,
        adults=int(fields[-2]),
        children=int(fields[-1]),
    )


def clear_search_buttons(session: dict) -> None:
    for key in ("options", "option_key", "search_choices"):
        session.pop(key, None)


def search_choices(session: dict, kind: str, values: list[dict], text: str) -> dict:
    key = token_hex(6)
    session["search_choices"] = {"kind": kind, "key": key, "values": values}
    return message(text, *[
        [button(choice["label"][:75], f"pick:{key}:{index}")]
        for index, choice in enumerate(values)
    ])


class Turn(TypedDict):
    chat_id: int
    text: str
    action: str
    session: dict
    response: dict


async def run_search_options(api: Turismo, session: dict, criteria: Search) -> dict:
    assert criteria.start is not None and criteria.adults is not None
    if criteria.start < today():
        return {"response": message("Elige una fecha de hoy en adelante.")}
    if criteria.kind == "hotel":
        assert criteria.end is not None
        if not 1 <= (criteria.end - criteria.start).days <= 30:
            return {"response": message("Elige una estancia de 1 a 30 noches.")}
        if criteria.adults > 10 or (criteria.children or 0) > 10:
            return {"response": message("La consulta de habitación admite hasta 10 adultos y 10 menores.")}

    results = await options(api, criteria)
    session["options"] = results
    session["option_key"] = token_hex(6)
    dest_name = (criteria.destination or "el destino").title()
    if not results:
        return {"response": message(
            f"No encontré opciones con cupo disponible en {dest_name} para esas fechas. "
            "¿Te gustaría probar con otras fechas o cambiar de destino?",
            [button("🔄 Cambiar fecha", f"search:{criteria.kind}"), button("🔍 Buscar otro destino", "start")]
        )}
    rows = [
        [button(f'{row["label"]} · {row["detail"]}'[:75], f'add:{session["option_key"]}:{index}')]
        for index, row in enumerate(results)
    ]
    return {"response": message(
        f"¡Encontré estas opciones disponibles en {dest_name}!\n"
        "Selecciona la que más te guste para ver el detalle y agregar a tu cotización:",
        *rows
    )}


def build_graph(api: Turismo, extractor):
    async def show_availability(session: dict, criteria: Search) -> dict:
        clear_search_buttons(session)
        session["search"] = criteria.model_dump(mode="json")
        question = missing_search_details(criteria)
        if question:
            return message(question)
        assert criteria.start is not None and criteria.adults is not None and criteria.destination
        if criteria.start < today():
            return message("Elige una fecha de hoy en adelante.")
        if criteria.kind == "hotel":
            assert criteria.end is not None
            if not 1 <= (criteria.end - criteria.start).days <= 30:
                return message("Elige una estancia de 1 a 30 noches.")
            if criteria.adults > 10 or (criteria.children or 0) > 10:
                return message("La consulta de habitación admite hasta 10 adultos y 10 menores.")

        destination_key = canonical(criteria.destination)
        region = session.get("resolved_region")
        if not region or region["query"] != destination_key:
            region, candidates = await find_regions(api, criteria.destination)
            if candidates:
                choices = [
                    {"id": candidate["id"], "name": candidate["name"],
                     "label": " · ".join(filter(None, [candidate["name"], candidate.get("stateName")]))}
                    for candidate in candidates
                ]
                return search_choices(session, "region", choices, "¿Cuál de estos destinos buscas?")
            if region is None:
                return message(f'No encontré «{criteria.destination}» en el catálogo. ¿Qué municipio o zona buscas?')
            region = {"id": region["id"], "name": region["name"], "query": destination_key}
            session["resolved_region"] = region

        results = await options(api, criteria, region["id"])
        if results:
            session["options"] = results
            session["option_key"] = token_hex(6)
            rows = [
                [button(f'{row["label"]} · {row["detail"]}'[:75], f'add:{session["option_key"]}:{index}')]
                for index, row in enumerate(results)
            ]
            return message("Selecciona una opción para agregarla a tu cotización.", *rows)

        dates = await availability(api, criteria, region["id"], flex_days=7)
        nearby = [day["date"] for day in dates if day["date"] != criteria.start.isoformat()][:3]
        summary = f'No encontré cupo en {region["name"]} para tu grupo el {criteria.start:%d/%m/%Y}.'
        if nearby:
            choices = []
            for day in nearby:
                alternative = date.fromisoformat(day)
                label = f"{alternative:%d/%m/%Y}"
                if criteria.kind == "hotel" and criteria.end is not None:
                    label += f" al {alternative + (criteria.end - criteria.start):%d/%m/%Y}"
                choices.append({"date": day, "label": label})
            return search_choices(session, "date", choices, summary + " Tengo estas fechas cercanas.")

        if criteria.adults + (criteria.children or 0) > 1:
            smaller = await availability(api, criteria, region["id"], smaller_group=True)
            if smaller:
                return message(summary + " Hay opciones para grupos más pequeños en esa fecha. Puedes ajustar los viajeros o elegir otra fecha.")
        return message(summary + " Puedes probar otra fecha o destino.")

    async def search(state: Turn) -> dict:
        session = state["session"]
        previous = Search.model_validate(session.get("search", {}))
        user_text = state["text"].strip()
        data = Search()
        parsed = None

        # Detección determinista de fechas, destinos y cantidades en español
        range_start, range_end = parse_spanish_date_range(user_text, today().year)
        single_date = parse_spanish_date(user_text, today().year)
        nights = parse_nights(user_text)

        adults_answer = re.fullmatch(r"(\d{1,2})(?:\s+adultos?)?[.!]?", user_text, re.IGNORECASE)
        solo_match = re.search(
            r"\b(solo\s+yo|yo\s+solo|voy\s+solo|viajo\s+solo|nom[aá]s\s+yo|"
            r"1\s+persona|una\s+persona|un\s+adulto|para\s+m[ií]\s+solo)\b",
            user_text,
            re.IGNORECASE,
        )
        pareja_match = re.search(
            r"\b(en\s+pareja|con\s+mi\s+(?:esposa|esposo|pareja|novia|novio)|"
            r"2\s+personas|dos\s+personas|2\s+adultos|somos\s+dos|mi\s+pareja)\b",
            user_text,
            re.IGNORECASE,
        )
        # "somos 3", "viajamos 4", "para 2": el numero de personas sin la palabra adultos
        grupo_match = re.search(
            r"\b(?:somos|viajamos|seremos|ser[ií]amos|van|para)\s+(\d{1,2})\b",
            user_text,
            re.IGNORECASE,
        )

        kind_hotel = bool(re.search(r"\b(hotel|hoteles|hospedaje|habitaci[oó]n|cuarto|resort|suite)\b", user_text, re.IGNORECASE))
        kind_paquete = bool(re.search(r"\b(paquete|paquetes|tour|tours|viaje|circuito)\b", user_text, re.IGNORECASE))
        kind_exp = bool(re.search(r"\b(experiencia|experiencias|actividad|actividades|cenote|snorkel|paseo)\b", user_text, re.IGNORECASE))

        dest_match = None
        for dest in ["Cancún", "Cancun", "Playa del Carmen", "Solidaridad", "Mérida", "Merida", "Valladolid", "Yucatán", "Yucatan", "Chiapas", "Palenque"]:
            if re.search(rf"\b{re.escape(dest)}\b", user_text, re.IGNORECASE):
                dest_match = dest
                break
        if not dest_match and re.search(r"\btemptation\b", user_text, re.IGNORECASE):
            dest_match = "Cancún"
            kind_hotel = True

        try:
            if "|" in user_text:
                data = parse_form(user_text, previous.kind)
            elif adults_answer and previous.kind and previous.destination and previous.start:
                data = Search(adults=int(adults_answer[1]))
            elif previous.kind == "hotel" and previous.start and not previous.end and (nights or single_date or range_end):
                # El usuario responde a la fecha de salida de hotel
                if nights:
                    data = Search(end=previous.start + timedelta(days=nights))
                elif range_end and range_end > previous.start:
                    data = Search(start=range_start, end=range_end)
                elif single_date:
                    if single_date >= previous.start:
                        data = Search(end=single_date)
                    else:
                        data = Search(start=single_date)
            elif extractor is not None:
                extracted = await extractor.ainvoke([
                    ("system",
                     "Extrae datos explícitos de la búsqueda turística en México y devuelve JSON con estructura:\n"
                     '{"kind":"hotel","destination":"Cancún","start":"2026-12-01","end":"2026-12-10","adults":2,"children":0,"reply":"...","quick_replies":[{"label":"2 personas","field":"adults","value":"2"}]}\n'
                     "REGLAS:\n"
                     "1. kind: 'hotel', 'paquete' o 'experiencia'. Usa null si no se menciona.\n"
                     "2. destination: ciudad, estado o región (ej: 'Cancún', 'Playa del Carmen', 'Mérida', 'Valladolid', 'Yucatán').\n"
                     "   - Si menciona 'Temptation', el destino es 'Cancún' y el kind es 'hotel'.\n"
                     "   - Usa null si no se menciona ningún destino.\n"
                     "3. HOTELES (kind='hotel'): 'start' es entrada y 'end' es salida.\n"
                     f"   - Si en el contexto ya existe 'start' (ej: {previous.start}) y el usuario da una fecha posterior (ej: '10 de diciembre'), ESA FECHA ES 'end'. NUNCA sobrescribas 'start'.\n"
                     "   - Si el usuario dice un rango como 'del 1 al 10 de diciembre', start='2026-12-01', end='2026-12-10'.\n"
                     "4. Para viajeros: 'solo yo' o 'voy solo' = adults:1; 'en pareja' = adults:2.\n"
                     f"5. Hoy es {today().isoformat()}. Resuelve fechas relativas desde hoy.\n"
                     f"Contexto de la búsqueda actual: {previous.model_dump_json()}\n"
                     "6. reply: frase breve y natural que reconozca lo que dijo el usuario y pida SOLO el dato que falta (máximo 300 caracteres).\n"
                     "7. quick_replies: hasta 6 botones para responder sin escribir. Cada uno {\"label\":\"...\",\"field\":\"...\",\"value\":\"...\"} con field en kind, destination, adults, date o nights. En date el value es YYYY-MM-DD; en adults y nights un número; en kind hotel, paquete o experiencia; en destination el nombre del destino. Usa [] si no aportan.\n"
                     "Devuelve únicamente los campos que el último mensaje proporciona o corrige."
                    ),
                    ("human", user_text[:2000]),
                ])
                parsed = extracted.get("parsed")
                data = Search()
                if parsed is not None:
                    if parsed.kind:
                        data.kind = parsed.kind
                    if parsed.destination:
                        data.destination = parsed.destination
                    if parsed.adults:
                        data.adults = parsed.adults
                    if parsed.children is not None:
                        data.children = parsed.children
                    for campo in ("start", "end"):
                        valor = getattr(parsed, campo)
                        if valor:
                            try:
                                setattr(data, campo, date.fromisoformat(valor))
                            except ValueError:
                                pass
                # Enriquecimiento determinista si el LLM no capturó alguno de los campos evidentes:
                if not data.destination and dest_match:
                    data.destination = dest_match
                if not data.kind:
                    if kind_hotel:
                        data.kind = "hotel"
                    elif kind_paquete:
                        data.kind = "paquete"
                    elif kind_exp:
                        data.kind = "experiencia"
                if not data.start and range_start:
                    data.start = range_start
                if not data.end and range_end:
                    data.end = range_end
                if not data.adults:
                    if solo_match:
                        data.adults = 1
                    elif pareja_match:
                        data.adults = 2
                    elif grupo_match:
                        data.adults = int(grupo_match.group(1))
            else:
                # Modo offline / determinista sin LLM
                data = Search()
                if dest_match:
                    data.destination = dest_match
                if kind_hotel:
                    data.kind = "hotel"
                elif kind_paquete:
                    data.kind = "paquete"
                elif kind_exp:
                    data.kind = "experiencia"

                if range_start and range_end:
                    data.start = range_start
                    data.end = range_end
                elif single_date:
                    data.start = single_date

                if solo_match:
                    data.adults = 1
                elif pareja_match:
                    data.adults = 2
                elif grupo_match:
                    data.adults = int(grupo_match.group(1))
                elif adults_answer:
                    data.adults = int(adults_answer[1])

            # Regla de seguridad post-extractor: si es hotel, ya teníamos start y vino un start posterior sin end:
            if previous.kind == "hotel" and previous.start and not previous.end:
                if data.start and not data.end and data.start >= previous.start:
                    data.end = data.start
                    data.start = previous.start

            if data.kind and previous.kind and data.kind != previous.kind:
                previous = Search()
            changes = data.model_dump(exclude_none=True)
            if (previous.kind == "hotel" and previous.start and previous.end
                    and previous.start < previous.end and data.start and data.end is None):
                changes["end"] = data.start + (previous.end - previous.start)
            criteria = Search.model_validate({**previous.model_dump(exclude_none=True), **changes})
        except ValueError:
            return {"response": message("Revisa el formato y las cantidades.\n" +
                                        (missing_search_details(previous) or search_prompt(previous.kind)))}

        session["search"] = criteria.model_dump(mode="json")
        question = missing_search_details(criteria)
        if question:
            # El agente propone texto y botones; si no lo hace, se usa la
            # interfaz determinista de respaldo.
            texto = parsed.reply.strip() if parsed and parsed.reply else ""
            if len(texto) > 10:
                filas = botones_dinamicos(parsed.quick_replies if parsed else [])
                if not filas:
                    filas = botones_por_defecto(criteria)
                return {"response": message(texto, *filas)}
            return {"response": missing_search_response(criteria)}

        return await run_search_options(api, session, criteria)

    async def interaction(state: Turn) -> dict:
        session = state["session"]
        action = state["action"]
        if action == "start":
            session["awaiting_name"] = True
            session.pop("search", None)
            return {"response": welcome()}
        if action.startswith("adults:"):
            count = int(action.split(":")[1])
            criteria = Search.model_validate(session.get("search", {}))
            criteria.adults = count
            session["search"] = criteria.model_dump(mode="json")
            if missing_search_details(criteria):
                return {"response": missing_search_response(criteria)}
            return await run_search_options(api, session, criteria)
        if action.startswith("date:"):
            value = action.partition(":")[2]
            criteria = Search.model_validate(session.get("search", {}))
            criteria.start = date.fromisoformat(value)
            criteria.end = None
            session["search"] = criteria.model_dump(mode="json")
            session.pop("options", None)
            if missing_search_details(criteria):
                return {"response": missing_search_response(criteria)}
            return await run_search_options(api, session, criteria)
        if action.startswith("nights:"):
            noches = int(action.partition(":")[2])
            criteria = Search.model_validate(session.get("search", {}))
            if criteria.start is None:
                return {"response": missing_search_response(criteria)}
            criteria.end = criteria.start + timedelta(days=noches)
            session["search"] = criteria.model_dump(mode="json")
            session.pop("options", None)
            if missing_search_details(criteria):
                return {"response": missing_search_response(criteria)}
            return await run_search_options(api, session, criteria)
        if action.startswith("search:") and action.split(":")[1] in EXAMPLES:
            kind = action.split(":")[1]
            current = session.get("search", {})
            current["kind"] = kind
            session["search"] = current
            session.pop("options", None)
            criteria = Search.model_validate(current)
            if missing_search_details(criteria):
                return {"response": missing_search_response(criteria)}
            return await run_search_options(api, session, criteria)
        if action.startswith("dest:"):
            nombre = action.partition(":")[2].strip()
            criteria = Search.model_validate(session.get("search", {}))
            if nombre:
                criteria.destination = nombre[:100]
            session["search"] = criteria.model_dump(mode="json")
            session.pop("options", None)
            session.pop("sugerencias_destino", None)
            if missing_search_details(criteria):
                return {"response": missing_search_response(criteria)}
            return await run_search_options(api, session, criteria)
        if action == "clear":
            for key in ("basket", "quote", "options", "search", "traveler"):
                session.pop(key, None)
            clear_search_buttons(session)
            return {"response": welcome()}
        if action.startswith("pick:"):
            parts = action.split(":")
            choices = session.get("search_choices")
            if not choices or len(parts) != 3 or parts[1] != choices["key"] or not parts[2].isdigit():
                return {"response": message("Estas opciones vencieron. Envía una nueva búsqueda.")}
            index = int(parts[2])
            if index >= len(choices["values"]):
                return {"response": message("Opción no disponible.")}
            choice = choices["values"][index]
            criteria = Search.model_validate(session["search"])
            if choices["kind"] == "region":
                criteria.destination = choice["name"]
                session["resolved_region"] = {
                    "id": choice["id"], "name": choice["name"], "query": canonical(choice["name"]),
                }
            else:
                start = date.fromisoformat(choice["date"])
                if criteria.kind == "hotel" and criteria.start and criteria.end:
                    criteria.end = start + (criteria.end - criteria.start)
                criteria.start = start
            return {"response": await show_availability(session, criteria)}
        if action.startswith("add:"):
            parts = action.split(":")
            results = session.get("options", [])
            if len(parts) != 3 or parts[1] != session.get("option_key") or not parts[2].isdigit():
                return {"response": message("Estas opciones vencieron. Inicia otra búsqueda con /start.")}
            index = int(parts[2])
            if index >= len(results):
                return {"response": message("Opción no disponible.")}
            basket = session.setdefault("basket", [])
            row = results[index]
            if row not in basket and len(basket) < 10:
                basket.append(row)
                session.pop("quote", None)
            return {"response": basket_message(basket)}
        if action == "basket":
            return {"response": basket_message(session.get("basket", []))}
        if action == "quote":
            basket = session.get("basket", [])
            if not basket:
                return {"response": basket_message(basket)}
            quote = await api.request("POST", "/quotes", auth=True, json={
                "items": [row["item"] for row in basket],
            })
            session["quote"] = quote
            summary = [
                f'Cotización {quote["reference"]}',
                *[f'• {item["title"]}: {money(item["total"], quote["currency"])}' for item in quote["items"]],
                f'Total: {money(quote["total"], quote["currency"])}',
                f'Vence: {quote["expiresAt"]} (UTC).',
            ]
            # Para el MVP: cualquier cotización de un solo ítem soportado puede proceder al pago
            can_checkout = (
                len(basket) == 1
                and basket[0]["item"]["type"] in _CHECKOUT_TYPES
            )
            rows = []
            if can_checkout:
                rows.append([button("Confirmar y continuar al pago", f'checkout:{quote["quoteId"]}')])
            else:
                summary.append("Para pagar, agrega un solo servicio por cotización.")
            return {"response": message("\n".join(summary), *rows)}

        # --- Checkout directo (aparta inventario por 15 min y da enlace de pago) ---
        if action.startswith("checkout:"):
            quote_id = action.partition(":")[2]
            if quote_id != (session.get("quote") or {}).get("quoteId"):
                return {"response": message("Usa el botón de la cotización más reciente.")}
            previous = session.get("booking")
            if previous and previous["status"] in {"pending_payment", "capturing"}:
                return {"response": await booking_status(api, state["chat_id"], session)}
            return {"response": await _do_checkout(api, state["chat_id"], session, quote_id)}

        if action == "status":
            return {"response": await booking_status(api, state["chat_id"], session)}
        return {"response": welcome()}

    # --- Nodo de búsqueda y atención conversacional ---
    _original_search = search

    async def search_or_traveler(state: Turn) -> dict:
        """
        Si el viajero tiene una reserva y envía su nombre o correo,
        lo guarda en la sesión para el comprobante. De lo contrario,
        realiza la búsqueda normal.
        """
        session = state["session"]
        text = state["text"].strip()
        booking = session.get("booking")

        # Si el usuario tiene una reserva activa o confirmada y envía un correo o nombre
        if booking:
            email_re = re.compile(r"^[^@\s]+@[^@\s]+\.[^@\s]+$")
            traveler = session.setdefault("traveler", {})
            if email_re.match(text):
                traveler["email"] = text
                return {"response": message(
                    f"Correo {text} registrado. Tu comprobante oficial y notificaciones se enviarán aquí.",
                    [button("Ver mi reserva", "status")]
                )}
            elif not traveler.get("name") and len(text) >= 3 and not text.startswith("/") and "|" not in text:
                traveler["name"] = text
                return {"response": message(
                    f"Mucho gusto, {text}. Si lo deseas, compárteme también tu correo electrónico para enviarte el comprobante.",
                    [button("Ver mi reserva", "status")]
                )}

        return await _original_search(state)

    graph = StateGraph(Turn)
    graph.add_node("search", search_or_traveler)
    graph.add_node("interaction", interaction)
    graph.add_conditional_edges(START, lambda turn: "interaction" if turn["action"] else "search",
                                {"interaction": "interaction", "search": "search"})
    graph.add_edge("search", END)
    graph.add_edge("interaction", END)
    return graph.compile()


async def _do_checkout(api: Turismo, chat_id: int, session: dict, quote_id: str) -> dict:
    """Ejecuta el checkout con los datos del viajero ya capturados."""
    traveler = session.get("traveler", {})
    session.pop("pending_checkout", None)
    payload: dict = {
        "quoteId": quote_id,
        "travelerRef": f'telegram:{chat_id}',
    }
    if traveler.get("name"):
        payload["travelerName"] = traveler["name"]
    if traveler.get("email"):
        payload["travelerEmail"] = traveler["email"]
    booking = await api.request("POST", "/bookings/checkout", auth=True, json=payload)
    session["booking"] = booking
    return render_booking(booking)


def basket_message(basket: list[dict]) -> dict:
    if not basket:
        return welcome()
    items = "\n".join(f'• {row["label"]} · {row["detail"]}' for row in basket)
    return message(
        "Tu selección actual:\n" + items,
        [button("Cotizar ahora", "quote"), button("Agregar otro servicio", "start")],
        [button("Vaciar selección", "clear")],
    )


async def booking_status(api: Turismo, chat_id: int, session: dict) -> dict:
    booking = session.get("booking")
    if not booking:
        return message(
            "Todavía no tienes ninguna reserva en este chat.\n"
            "Usa los botones de abajo para buscar y reservar.",
            [button("Buscar paquetes", "search:paquete"),
             button("Buscar hoteles", "search:hotel")],
        )
    updated = await api.request("GET", f'/bookings/{booking["bookingId"]}', auth=True,
                                params={"travelerRef": f"telegram:{chat_id}"})
    session["booking"] = updated
    # El QR se envía una sola vez, cuando el pago queda confirmado.
    if updated.get("status") == "confirmed" and not session.get("ticket_sent"):
        session["ticket_pending"] = True
    return render_booking(updated)


def render_booking(booking: dict) -> dict:
    status = booking["status"]
    if status == "confirmed":
        ticket = booking.get("ticket") or {}
        reference = booking.get("reference") or booking["bookingId"]
        lines = [f"Tu pago fue confirmado. Clave única de reserva: {reference}"]
        if ticket.get("packageName"):
            lines.append(f'Paquete: {ticket["packageName"]}')
        if ticket.get("roomTypeName"):
            lines.append(f'Habitación: {ticket["roomTypeName"]}')
        if ticket.get("experienceName"):
            lines.append(f'Experiencia: {ticket["experienceName"]}')
        if ticket.get("partnerName"):
            lines.append(f'Proveedor: {ticket["partnerName"]}')
        if ticket.get("departureDate"):
            lines.append(f'Fecha de salida: {ticket["departureDate"]}')
        if ticket.get("checkIn") and ticket.get("checkOut"):
            lines.append(f'Estancia: {ticket["checkIn"]} al {ticket["checkOut"]}')
        if ticket.get("date") and ticket.get("startTime"):
            lines.append(f'Horario: {ticket["date"]} a las {ticket["startTime"]}')
        if ticket.get("seats"):
            lines.append(f'Viajeros: {ticket["seats"]}')
        if ticket.get("total") is not None:
            lines.append(f'Total pagado: {money(float(ticket["total"]), ticket.get("currency", booking["currency"]))}')
        lines.append("En un momento te envío el QR para presentarlo al proveedor.")
        
        # Sugerencia de venta cruzada sutil (Cross-selling para MVP)
        rows = [[button("Ver estado de mi reserva", "status")]]
        if ticket.get("roomTypeName"):
            lines.append("\nTip: Si deseas tours o actividades para tus fechas, puedes pulsar 'Buscar experiencias'.")
            rows.append([button("Buscar experiencias", "search:experiencia")])
        elif ticket.get("experienceName"):
            lines.append("\nTip: ¿Necesitas hospedaje cerca? Puedes pulsar 'Buscar hoteles'.")
            rows.append([button("Buscar hoteles", "search:hotel")])
            
        return message("\n".join(lines), *rows)
    if status == "expired":
        return message(
            "El tiempo para pagar venció y el lugar fue liberado.\n"
            "Puedes volver a cotizar para verificar disponibilidad.",
            [button("Cotizar de nuevo", "quote")],
        )
    if status == "payment_failed":
        return message(
            "PayPal no pudo procesar el pago. Intenta con una nueva cotización.",
            [button("Cotizar de nuevo", "quote")],
        )
    if status == "capturing":
        return message(
            "Estamos verificando la confirmación de tu pago, esto puede tomar unos segundos.",
            [button("Revisar estado", "status")],
        )
    link = booking.get("paymentUrl")
    rows = [[{"text": "Pagar con PayPal", "url": link}]] if link else []
    return message(
        f'Tu lugar está apartado por {money(booking["total"], booking["currency"])}.\n'
        f'Tienes 15 minutos para completar el pago antes de que se libere el cupo.\n'
        f'Vence: {booking["expiresAt"]} (UTC).',
        *rows, [button("Ver estado de mi reserva", "status")],
    )


def friendly_error(exc: TurismoError) -> dict:
    msgs = {
        "QUOTE_EXPIRED": "La cotización venció. Vuelve a cotizar para verificar precio y cupo disponible.",
        "INSUFFICIENT_AVAILABILITY": "Ya no hay suficiente disponibilidad para tu selección. Prueba otra fecha u opción.",
        "DUPLICATE_QUOTE_INVENTORY": "Algunos servicios comparten el mismo cupo. Vacía tu selección y agrégalos de nuevo uno a la vez.",
        "PAYPAL_NOT_CONFIGURED": "El pago en línea no está disponible en este momento. Contacta directamente al proveedor.",
        "DEPARTURE_NOT_AVAILABLE": "La salida que elegiste ya no tiene cupo. Busca otra fecha o destino.",
        "BOOKING_ITEM_NOT_SUPPORTED": "Por el momento el pago en línea solo está disponible para paquetes completos. Puedes cotizar y el proveedor te contactará para confirmar.",
    }
    rows = [[button("Volver a cotizar", "quote")]] if exc.code in {"QUOTE_EXPIRED", "INSUFFICIENT_AVAILABILITY"} else []
    return message(msgs.get(exc.code, "Ocurrió un error inesperado. Puedes intentarlo de nuevo o escribir /start para reiniciar."), *rows)
