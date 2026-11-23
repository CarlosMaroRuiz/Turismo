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


def today() -> date:
    return datetime.now(ZoneInfo("America/Mexico_City")).date()


def canonical(text: str) -> str:
    return "".join(c for c in normalize("NFD", text.casefold()) if not combining(c)).strip()


async def options(api: Turismo, search: Search) -> list[dict]:
    assert search.destination and search.start and search.adults
    regions = await api.request("GET", "/regions", params={"search": search.destination, "limit": 10})
    matches = [
        region for region in regions
        if canonical(search.destination) in {canonical(name) for name in [region["name"], *region.get("aliases", [])]}
    ]
    if len(matches) != 1:
        return []
    region = matches[0]
    common = {"adults": search.adults, "children": search.children or 0}
    starting = search.start.isoformat()
    parameters = {"regionId": region["id"], "limit": 5}
    if search.kind == "hotel":
        assert search.end
        ending = search.end.isoformat()
        rooms = await api.request("GET", "/hotels/availability", params={
            **parameters, **common, "checkIn": starting, "checkOut": ending,
        })
        return [
            {
                "label": f'{row["roomTypeName"]} · {row["partnerName"]}',
                "detail": f'{starting} al {ending}',
                "item": {"type": "room_stay", "roomTypeId": row["roomTypeId"],
                         "checkIn": starting, "checkOut": ending, **common},
            }
            for row in rooms
        ]
    people = common["adults"] + common["children"]
    if search.kind == "experiencia":
        slots = await api.request("GET", "/experiences/availability", params={
            **parameters, "date": starting, "people": people,
        })
        return [
            {
                "label": row["experienceName"], "detail": f'{row["date"]} · {row["startTime"]}',
                "item": {"type": "experience_slot", "slotId": row["slotId"], **common},
            }
            for row in slots
        ]

    packages = await api.request("GET", "/packages", params=parameters)
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
                    "label": package["name"], "detail": starting,
                    "item": {"type": "package_departure", "departureId": departure["id"], **common},
                })
    return results[:5]
