from datetime import date
import re
from secrets import token_hex
from typing import TypedDict

from langgraph.graph import END, START, StateGraph

from .catalog import Search, ServiceKind, availability, canonical, find_regions, options, today
from .clients import Turismo, TurismoError


def button(text: str, action: str) -> dict:
    return {"text": text, "callback_data": action}


def message(text: str, *rows: list[dict]) -> dict:
    result = {"text": text}
    if rows:
        result["reply_markup"] = {"inline_keyboard": list(rows)}
    return result


def money(value: float, currency: str) -> str:
    return f"${value:,.2f} {currency}"


def welcome() -> dict:
    return message(
        "¿Qué servicio quieres buscar? Puedes combinar servicios en una cotización.",
        [button("Paquetes", "search:paquete"), button("Hoteles", "search:hotel"),
         button("Experiencias", "search:experiencia")],
        [button("Ver selección", "basket"), button("Consultar reserva", "status")],
    )


EXAMPLES = {
    "paquete": "San Cristóbal de las Casas | AAAA-MM-DD | 2 | 0",
    "hotel": "San Cristóbal de las Casas | AAAA-MM-DD | AAAA-MM-DD | 2 | 0",
    "experiencia": "San Cristóbal de las Casas | AAAA-MM-DD | 2 | 0",
}


def search_prompt(kind: ServiceKind | None) -> str:
    if kind is None:
        return "Indica si buscas un paquete, hotel o experiencia."
    dates = "entrada y salida" if kind == "hotel" else "fecha"
    return (f"Dime el destino, {dates} y cuántos adultos viajan. Indica también si viajan menores.\n"
            f"Puedes escribirlo como mensaje o usar este formato: {EXAMPLES[kind]}")


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
        try:
            adults_answer = re.fullmatch(r"(\d{1,2})(?:\s+adultos?)?[.!]?", user_text, re.IGNORECASE)
            if "|" in user_text:
                data = parse_form(user_text, previous.kind)
            elif adults_answer and previous.kind and previous.destination and previous.start:
                data = Search(adults=int(adults_answer[1]))
            elif extractor is not None:
                extracted = await extractor.ainvoke([
                    ("system", "Extrae solo datos explícitos de la búsqueda turística. "
                     'Devuelve un objeto JSON con esta estructura: {"kind":"hotel","destination":"Palenque",'
                     '"start":"2030-02-01","end":"2030-02-03","adults":2,"children":0}. '
                     "kind admite paquete, hotel o experiencia. Usa null para campos ausentes. "
                     "Si el mensaje dice «para adultos» sin un número, devuelve adults como null. "
                     "Un mensaje breve puede responder únicamente a un dato pendiente. "
                     "Si corrige solo el día del mes, usa el mes y año de la fecha guardada. "
                     "Si dice «ahora somos N» y no menciona menores, interpreta N como adultos. "
                     f"Resuelve fechas relativas desde {today().isoformat()}. "
                     f"Usa como contexto la búsqueda actual: {previous.model_dump_json()}. "
                     "Devuelve solo los campos que el último mensaje proporciona o corrige."),
                    ("human", user_text[:2000]),
                ])
                data = extracted["parsed"]
                if data is None:
                    return {"response": message(
                        "No pude interpretar el mensaje.\n" +
                        (missing_search_details(previous) or search_prompt(previous.kind))
                    )}
            else:
                return {"response": message(missing_search_details(previous) or search_prompt(previous.kind))}
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

        return {"response": await show_availability(session, criteria)}

    async def interaction(state: Turn) -> dict:
        session = state["session"]
        action = state["action"]
        if action == "start":
            clear_search_buttons(session)
            return {"response": welcome()}
        if action.startswith("search:") and action.split(":")[1] in EXAMPLES:
            kind = action.split(":")[1]
            session["search"] = {"kind": kind}
            clear_search_buttons(session)
            return {"response": message(search_prompt(kind))}
        if action == "clear":
            for key in ("basket", "quote", "search", "resolved_region"):
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
            rows = []
            if len(basket) == 1 and basket[0]["item"]["type"] == "package_departure":
                rows.append([button("Confirmar selección", f'checkout:{quote["quoteId"]}')])
            else:
                summary.append("El pago está disponible para una salida de paquete por compra.")
            return {"response": message("\n".join(summary), *rows)}
        if action.startswith("checkout:"):
            quote_id = action.partition(":")[2]
            if quote_id != (session.get("quote") or {}).get("quoteId"):
                return {"response": message("Usa el botón de la cotización más reciente.")}
            previous = session.get("booking")
            if previous and previous["status"] in {"pending_payment", "capturing"}:
                return {"response": await booking_status(api, state["chat_id"], session)}
            booking = await api.request("POST", "/bookings/checkout", auth=True, json={
                "quoteId": quote_id, "travelerRef": f'telegram:{state["chat_id"]}',
            })
            session["booking"] = booking
            return {"response": render_booking(booking)}
        if action == "status":
            return {"response": await booking_status(api, state["chat_id"], session)}
        return {"response": welcome()}

    graph = StateGraph(Turn)
    graph.add_node("search", search)
    graph.add_node("interaction", interaction)
    graph.add_conditional_edges(START, lambda turn: "interaction" if turn["action"] else "search",
                                {"interaction": "interaction", "search": "search"})
    graph.add_edge("search", END)
    graph.add_edge("interaction", END)
    return graph.compile()


def basket_message(basket: list[dict]) -> dict:
    if not basket:
        return welcome()
    items = "\n".join(f'• {row["label"]} · {row["detail"]}' for row in basket)
    return message(
        "Tu selección\n" + items,
        [button("Cotizar", "quote"), button("Agregar otro servicio", "start")],
        [button("Vaciar selección", "clear")],
    )


async def booking_status(api: Turismo, chat_id: int, session: dict) -> dict:
    booking = session.get("booking")
    if not booking:
        return message("Todavía no tienes una reserva en este chat.")
    updated = await api.request("GET", f'/bookings/{booking["bookingId"]}', auth=True,
                                params={"travelerRef": f"telegram:{chat_id}"})
    session["booking"] = updated
    return render_booking(updated)


def render_booking(booking: dict) -> dict:
    status = booking["status"]
    if status == "confirmed":
        return message(f'Pago confirmado. Tu folio de reserva es {booking["bookingId"]}.')
    if status == "expired":
        return message("El apartado venció. Vuelve a cotizar para comprobar el cupo.",
                       [button("Cotizar", "quote")])
    if status == "payment_failed":
        return message("PayPal rechazó el pago. Genera una nueva cotización para intentarlo otra vez.",
                       [button("Cotizar", "quote")])
    if status == "capturing":
        return message("Estamos verificando tu pago.", [button("Consultar reserva", "status")])
    link = booking.get("paymentUrl")
    rows = [[{"text": "Pagar con PayPal", "url": link}]] if link else []
    return message(
        f'Apartado creado por {money(booking["total"], booking["currency"])}. '
        f'Vence {booking["expiresAt"]} (UTC).',
        *rows, [button("Consultar reserva", "status")],
    )


def friendly_error(exc: TurismoError) -> dict:
    messages = {
        "QUOTE_EXPIRED": "La cotización venció. Vuelve a cotizar para actualizar precio y cupo.",
        "INSUFFICIENT_AVAILABILITY": "Cambió el cupo disponible. Elige otra fecha u opción.",
        "DUPLICATE_QUOTE_INVENTORY": "Hay servicios que comparten el mismo cupo. Vacía la selección y agrégalos una sola vez.",
        "PAYPAL_NOT_CONFIGURED": "El pago con PayPal todavía no está disponible.",
        "DEPARTURE_NOT_AVAILABLE": "La salida elegida ya no está disponible.",
    }
    rows = [[button("Cotizar", "quote")]] if exc.code == "QUOTE_EXPIRED" else []
    return message(messages.get(exc.code, "No pude completar la operación. Intenta de nuevo en unos minutos."), *rows)
