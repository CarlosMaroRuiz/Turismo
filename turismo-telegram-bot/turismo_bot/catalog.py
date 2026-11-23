from datetime import date
from typing import Literal
from unicodedata import normalize, combining
from zoneinfo import ZoneInfo
from datetime import datetime

from pydantic import BaseModel, Field

from .clients import Turismo


ServiceKind = Literal["paquete", "hotel", "experiencia"]


class Search(BaseModel):
    kind: ServiceKind | None = None
    destination: str | None = Field(default=None, max_length=100)
    start: date | None = None
    end: date | None = None
    adults: int | None = Field(default=None, ge=1, le=20)
    children: int | None = Field(default=None, ge=0, le=20)
    reply: str | None = Field(default=None, max_length=2000)


CampoRapido = Literal["kind", "destination", "adults", "date", "nights"]


class QuickReply(BaseModel):
    """Boton que propone el modelo: etiqueta visible y dato que representa."""

    label: str = Field(min_length=1, max_length=40)
    field: CampoRapido
    value: str = Field(min_length=1, max_length=60)


class Extraccion(BaseModel):
    """
    Salida estructurada del agente para un turno de busqueda.

    Ademas de los datos, el modelo propone la respuesta y los botones, para que
    la interfaz se adapte a lo que pregunte en cada momento.
    """

    kind: ServiceKind | None = None
    destination: str | None = Field(default=None, max_length=100)
    start: str | None = None
    end: str | None = None
    adults: int | None = Field(default=None, ge=1, le=20)
    children: int | None = Field(default=None, ge=0, le=20)
    reply: str | None = Field(default=None, max_length=1000)
    quick_replies: list[QuickReply] = Field(default_factory=list, max_length=8)


def today() -> date:
    return datetime.now(ZoneInfo("America/Mexico_City")).date()


def canonical(text: str) -> str:
    return "".join(c for c in normalize("NFD", text.casefold()) if not combining(c)).strip()


def _region_score(query: str, region: dict) -> int:
    """
    Puntaje de coincidencia entre la consulta del usuario y un destino.
    Retorna 0 si no hay coincidencia útil.
    - 3: coincidencia exacta con nombre, alias o estado
    - 2: el nombre/alias/estado contiene la consulta completa (ej. "Cancún" en "Cancún Centro")
    - 1: la consulta contiene el nombre/alias/estado (ej. "Yucatán" o "Riviera Maya")
    """
    q = canonical(query)
    names = [canonical(region["name"]), *[canonical(a) for a in region.get("aliases", [])]]
    if region.get("stateName"):
        names.append(canonical(region["stateName"]))
    if q in names:
        return 3
    if any(q in n for n in names):
        return 2
    if any(n in q for n in names if len(n) >= 4):
        return 1
    return 0


async def options(api: Turismo, search: Search) -> list[dict]:
    assert search.destination and search.start and search.adults
    regions = await api.request("GET", "/regions", params={"search": search.destination, "limit": 10})

    scored = [(r, _region_score(search.destination, r)) for r in regions]
    best_score = max((s for _, s in scored), default=0)
    if best_score == 0:
        return []
    matches = [r for r, s in scored if s == best_score]
    common = {"adults": search.adults, "children": search.children or 0}
    starting = search.start.isoformat()

    if search.kind == "hotel":
        assert search.end
        ending = search.end.isoformat()
        for region in matches:
            rooms = await api.request("GET", "/hotels/availability", params={
                "regionId": region["id"], "limit": 5, **common, "checkIn": starting, "checkOut": ending,
            })
            if rooms:
                return [
                    {
                        "label": f'{row["roomTypeName"]} · {row["partnerName"]}',
                        "detail": f'{starting} al {ending} · ${row["totalPrice"]:,.0f} total',
                        "item": {"type": "room_stay", "roomTypeId": row["roomTypeId"],
                                 "checkIn": starting, "checkOut": ending, **common},
                    }
                    for row in rooms[:5]
                ]
        return []

    people = common["adults"] + common["children"]
    if search.kind == "experiencia":
        for region in matches:
            slots = await api.request("GET", "/experiences/availability", params={
                "regionId": region["id"], "limit": 5, "date": starting, "people": people,
            })
            if slots:
                return [
                    {
                        "label": row["experienceName"], "detail": f'{row["date"]} · {row["startTime"]}',
                        "item": {"type": "experience_slot", "slotId": row["slotId"], **common},
                    }
                    for row in slots[:5]
                ]
        return []

    for region in matches:
        packages = await api.request("GET", "/packages", params={"regionId": region["id"], "limit": 5})
        results = []
        for package in packages:
            if people < package["minTravelers"] or (
                package["maxTravelers"] is not None and people > package["maxTravelers"]
            ):
                continue
            detail = await api.request("GET", f'/packages/{package["id"]}')
            for departure in detail["departures"]:
                if departure["departureDate"] == starting and departure["availableSeats"] >= people:
                    results.append({
                        "label": package["name"],
                        "detail": f'{starting} · ${departure["adultPrice"]:,.0f} por adulto',
                        "item": {"type": "package_departure", "departureId": departure["id"], **common},
                    })
        if results:
            return results[:5]
    return []
