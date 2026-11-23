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


async def find_regions(api: Turismo, destination: str) -> tuple[dict | None, list[dict]]:
    regions = await api.request("GET", "/regions", params={"search": destination, "limit": 20})
    exact = [
        region for region in regions
        if canonical(destination) in {canonical(name) for name in [region["name"], *region.get("aliases", [])]}
    ]
    return (exact[0], []) if len(exact) == 1 else (None, (exact or regions)[:6])


async def availability(
    api: Turismo, search: Search, region_id: str, *, flex_days: int = 0, smaller_group: bool = False,
) -> list[dict]:
    assert search.start and search.adults
    adults, children = (1, 0) if smaller_group else (search.adults, search.children or 0)
    params = {"regionId": region_id, "limit": 4 if flex_days else 5}
    if flex_days:
        params["flexDays"] = flex_days
    if search.kind == "hotel":
        assert search.end
        return await api.request("GET", "/hotels/availability", params={
            **params, "adults": adults, "children": children,
            "checkIn": search.start.isoformat(), "checkOut": search.end.isoformat(),
        })
    path = "/experiences/availability" if search.kind == "experiencia" else "/packages/availability"
    return await api.request("GET", path, params={
        **params, "date": search.start.isoformat(), "people": adults + children,
    })


async def options(api: Turismo, search: Search, region_id: str) -> list[dict]:
    common = {"adults": search.adults, "children": search.children or 0}
    rows = await availability(api, search, region_id)
    if search.kind == "hotel":
        return [
            {
                "label": f'{row["roomTypeName"]} · {row["partnerName"]}',
                "detail": f'{row["checkIn"]} al {row["checkOut"]}',
                "item": {"type": "room_stay", "roomTypeId": row["roomTypeId"],
                         "checkIn": row["checkIn"], "checkOut": row["checkOut"], **common},
            }
            for row in rows
        ]
    if search.kind == "experiencia":
        return [
            {
                "label": row["experienceName"], "detail": f'{row["date"]} · {row["startTime"]}',
                "item": {"type": "experience_slot", "slotId": row["slotId"], **common},
            }
            for row in rows
        ]

    return [
        {
            "label": row["packageName"], "detail": row["date"],
            "item": {"type": "package_departure", "departureId": row["departureId"], **common},
        }
        for row in rows
    ]
