import asyncio
import re
import time
from typing import Any

import httpx


class TurismoError(Exception):
    def __init__(self, code: str, status: int):
        super().__init__(code)
        self.code = code
        self.status = status


class Turismo:
    def __init__(self, http: httpx.AsyncClient, base_url: str, client_id: str, secret: str):
        self.http = http
        self.base_url = base_url.rstrip("/")
        self.credentials = {"clientId": client_id, "secret": secret}
        self.access_token = ""
        self.token_deadline = 0.0
        self.token_lock = asyncio.Lock()

    async def _send(self, method: str, path: str, **kwargs: Any) -> Any:
        try:
            response = await self.http.request(method, self.base_url + path, **kwargs)
            body = response.json()
        except (httpx.RequestError, ValueError) as exc:
            raise TurismoError("TURISMO_UNAVAILABLE", 502) from exc
        if not isinstance(body, dict) or "ok" not in body:
            raise TurismoError("TURISMO_UNAVAILABLE", 502)
        if response.is_error or not body["ok"]:
            raise TurismoError(body.get("code", "TURISMO_ERROR"), response.status_code)
        return body["data"]

    async def _token(self, rejected: str = "") -> str:
        async with self.token_lock:
            if self.access_token != rejected and time.monotonic() < self.token_deadline:
                return self.access_token
            data = await self._send("POST", "/auth/service-token", json=self.credentials)
            ttl = re.fullmatch(r"(\d+)\s*([smhd])", str(data.get("expiresIn", "")))
            seconds = int(ttl[1]) * {"s": 1, "m": 60, "h": 3600, "d": 86400}[ttl[2]] if ttl else 60
            self.token_deadline = time.monotonic() + max(seconds - 10, 1)
            self.access_token = data["accessToken"]
            return self.access_token

    async def request(self, method: str, path: str, *, auth: bool = False, **kwargs: Any) -> Any:
        if not auth:
            return await self._send(method, path, **kwargs)
        token = await self._token()
        try:
            return await self._send(method, path, headers={"Authorization": f"Bearer {token}"}, **kwargs)
        except TurismoError as exc:
            if exc.status != 401:
                raise
        token = await self._token(rejected=token)
        return await self._send(method, path, headers={"Authorization": f"Bearer {token}"}, **kwargs)


class Telegram:
    def __init__(self, http: httpx.AsyncClient, token: str):
        self.http = http
        self.url = f"https://api.telegram.org/bot{token}/"

    async def call(self, method: str, payload: dict) -> None:
        try:
            response = await self.http.post(self.url + method, json=payload)
            success = response.is_success and response.json().get("ok")
        except (httpx.RequestError, ValueError) as exc:
            # httpx requests to Telegram carry the bot token in the URL.
            raise RuntimeError("Telegram no está disponible") from None
        if not success:
            raise RuntimeError(f"Telegram rechazó {method} (HTTP {response.status_code})")
