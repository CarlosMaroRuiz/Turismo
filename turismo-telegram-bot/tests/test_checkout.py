import json
from datetime import timedelta
from pathlib import Path
from tempfile import TemporaryDirectory
from unittest.mock import patch
import unittest

import httpx
from fastapi.testclient import TestClient

from turismo_bot.app import Bot, app
from turismo_bot.catalog import Search, today
from turismo_bot.clients import Telegram, Turismo
from turismo_bot.store import Store
from turismo_bot.workflow import build_graph


class BotCheckoutTest(unittest.IsolatedAsyncioTestCase):
    async def test_checkout_and_payment_notice_after_restart(self):
        sent = []
        checkouts = []
        date = (today() + timedelta(days=7)).isoformat()

        def service(request):
            path = request.url.path
            if request.url.host == "api.telegram.org":
                if path.endswith("/sendMessage"):
                    sent.append(json.loads(request.content))
                return httpx.Response(200, json={"ok": True})
            if path.endswith("/auth/service-token"):
                data = {"accessToken": "test-token", "expiresIn": "15m"}
            elif path.endswith("/regions"):
                data = [{"id": "region", "name": "Palenque"}]
            elif path.endswith("/packages/availability"):
                data = [{"departureId": "departure", "packageName": "Ruta", "date": date}]
            elif path.endswith("/quotes"):
                self.assertEqual(request.headers["Authorization"], "Bearer test-token")
                self.assertEqual(json.loads(request.content)["items"][0]["departureId"], "departure")
                data = {"quoteId": "quote-123", "reference": "QT-TEST", "currency": "MXN",
                        "items": [{"title": "Ruta", "total": 1500}], "total": 1500, "expiresAt": date}
            elif path.endswith("/bookings/checkout"):
                checkouts.append(json.loads(request.content))
                data = {"bookingId": "booking-456", "status": "pending_payment", "total": 1500,
                        "currency": "MXN", "expiresAt": date, "paymentUrl": "https://paypal.example/approve"}
            elif path.endswith("/bookings/booking-456"):
                self.assertEqual(request.url.params["travelerRef"], "telegram:42")
                data = {"bookingId": "booking-456", "status": "confirmed", "total": 1500,
                        "currency": "MXN", "expiresAt": date, "paymentUrl": None}
            else:
                self.fail(f"Ruta sin simular: {path}")
            return httpx.Response(200, json={"ok": True, "data": data})

        temp = TemporaryDirectory()
        self.addCleanup(temp.cleanup)
        filename = str(Path(temp.name) / "state.sqlite3")
        store = Store(filename)
        self.addCleanup(store.db.close)
        async with httpx.AsyncClient(transport=httpx.MockTransport(service)) as http:
            api = Turismo(http, "https://turismo.test/api/v1", "client", "secret")
            telegram = Telegram(http, "test-token")
            bot = Bot(store, api, telegram, build_graph(api, None))
            chat = {"id": 42, "type": "private"}

            async def update(number, *, text="", action=""):
                body = {"update_id": number}
                if action:
                    body["callback_query"] = {
                        "id": str(number), "data": action, "from": {"id": 42}, "message": {"chat": chat},
                    }
                else:
                    body["message"] = {"chat": chat, "text": text}
                store.enqueue(body)
                row = store.next_update()
                if row:
                    await bot.process(row)

            await update(1, text="/start")
            await update(2, action="search:paquete")
            await update(3, text=f"Palenque | {date} | 2 | 0")
            chosen = sent[-1]["reply_markup"]["inline_keyboard"][0][0]["callback_data"]
            await update(4, action=chosen)
            await update(5, action="quote")
            await update(6, action="checkout:quote-123")
            await update(6, action="checkout:quote-123")
            self.assertEqual(checkouts, [{"quoteId": "quote-123", "travelerRef": "telegram:42"}])
            link = sent[-1]["reply_markup"]["inline_keyboard"][0][0]["url"]
            self.assertEqual(link, "https://paypal.example/approve")

            with store.db:
                store.db.execute("UPDATE sessions SET next_check = 0")
            store.db.close()
            store = Store(filename)
            self.addCleanup(store.db.close)
            bot = Bot(store, api, telegram, build_graph(api, None))
            await bot.check_booking(store.next_booking())
            notice = store.next_notice()
            self.assertIn("booking-456", json.loads(notice["payload"])["text"])
            self.assertEqual(store.load(42)["booking"]["status"], "confirmed")


class SearchTest(unittest.IsolatedAsyncioTestCase):
    async def test_alternative_rechecks_hotel_and_preserves_length_and_group(self):
        start = today() + timedelta(days=7)
        end = start + timedelta(days=2)
        alternate = start + timedelta(days=1)
        calls = []

        def catalog(request):
            if request.url.path.endswith("/regions"):
                data = [{"id": "region", "name": "Benito Juárez", "aliases": ["Cancún"]}]
            else:
                params = request.url.params
                calls.append(dict(params))
                if params.get("flexDays") == "7":
                    data = [{"date": str(alternate)}]
                elif params["checkIn"] == str(alternate):
                    data = [{"roomTypeId": "suite", "roomTypeName": "Suite Familiar", "partnerName": "Hotel",
                             "checkIn": str(alternate), "checkOut": str(alternate + timedelta(days=2))}]
                else:
                    data = []
            return httpx.Response(200, json={"ok": True, "data": data})

        async with httpx.AsyncClient(transport=httpx.MockTransport(catalog)) as http:
            graph = build_graph(Turismo(http, "https://turismo.test/api/v1", "client", "secret"), None)
            initial = await graph.ainvoke({
                "chat_id": 1, "text": f"Cancún | {start} | {end} | 4 | 1", "action": "",
                "session": {"search": {"kind": "hotel"}},
            })
            choice = initial["response"]["reply_markup"]["inline_keyboard"][0][0]["callback_data"]
            chosen = await graph.ainvoke({
                "chat_id": 1, "text": "", "action": choice, "session": initial["session"],
            })
            self.assertEqual(chosen["session"]["options"][0]["item"]["roomTypeId"], "suite")
            self.assertEqual(calls[-1]["checkOut"], str(alternate + timedelta(days=2)))
            self.assertEqual((calls[-1]["adults"], calls[-1]["children"]), ("4", "1"))
            self.assertNotIn("flexDays", calls[-1])
            stale = await graph.ainvoke({
                "chat_id": 1, "text": "", "action": choice, "session": chosen["session"],
            })
            self.assertIn("vencieron", stale["response"]["text"])
            self.assertEqual(len(calls), 3)

    async def test_ambiguous_destination_presents_regions_before_querying_availability(self):
        start = today() + timedelta(days=7)
        def catalog(request):
            if request.url.path.endswith("/regions"):
                data = [{"id": "north", "name": "Riviera Norte"}, {"id": "south", "name": "Riviera Sur"}]
            else:
                self.assertEqual(request.url.params["regionId"], "south")
                data = [{"departureId": "departure", "packageName": "Tour", "date": str(start)}]
            return httpx.Response(200, json={"ok": True, "data": data})

        async with httpx.AsyncClient(transport=httpx.MockTransport(catalog)) as http:
            graph = build_graph(Turismo(http, "https://turismo.test/api/v1", "client", "secret"), None)
            initial = await graph.ainvoke({
                "chat_id": 1, "text": f"Riviera | {start} | 2 | 0", "action": "",
                "session": {"search": {"kind": "paquete"}},
            })
            choices = initial["response"]["reply_markup"]["inline_keyboard"]
            self.assertEqual([row[0]["text"] for row in choices], ["Riviera Norte", "Riviera Sur"])
            result = await graph.ainvoke({
                "chat_id": 1, "text": "", "action": choices[1][0]["callback_data"], "session": initial["session"],
            })
            self.assertEqual(result["session"]["search"]["destination"], "Riviera Sur")
            self.assertEqual(result["session"]["options"][0]["label"], "Tour")

    async def test_partial_search_asks_only_for_adults_and_accepts_a_number(self):
        departure = today() + timedelta(days=7)

        class Extractor:
            calls = 0

            async def ainvoke(self, messages):
                self.calls += 1
                return {"parsed": Search(kind="paquete", destination="Benito Juárez", start=departure)}

        async def catalog(request):
            match request.url.path:
                case "/api/v1/regions":
                    self.assertEqual(request.url.params["search"], "Benito Juárez")
                    data = [{"id": "region", "name": "Benito Juárez"}]
                case "/api/v1/packages/availability":
                    data = [{"departureId": "salida", "packageName": "Escapada Caribeña", "date": str(departure)}]
                case _:
                    self.fail(f"Ruta inesperada: {request.url.path}")
            return httpx.Response(200, json={"ok": True, "data": data})

        extractor = Extractor()
        async with httpx.AsyncClient(transport=httpx.MockTransport(catalog)) as http:
            api = Turismo(http, "https://turismo.test/api/v1", "client", "secret")
            graph = build_graph(api, extractor)
            turn = await graph.ainvoke({
                "chat_id": 1, "text": "Quiero un paquete para adultos en Benito Juárez",
                "action": "", "session": {"search": {"kind": "paquete"}},
            })
            self.assertEqual(turn["response"]["text"], "¿Cuántos adultos viajan? Puedes responder con el número.")
            result = await graph.ainvoke({
                "chat_id": 1, "text": "2", "action": "", "session": turn["session"],
            })
            self.assertEqual(result["session"]["options"][0]["item"]["adults"], 2)
            self.assertIn("Escapada Caribeña", result["response"]["reply_markup"]["inline_keyboard"][0][0]["text"])
            self.assertEqual(extractor.calls, 1)


class WebhookTest(unittest.TestCase):
    def test_requires_the_configured_secret(self):
        settings = {
            "TELEGRAM_BOT_TOKEN": "bot-test",
            "TELEGRAM_WEBHOOK_SECRET": "webhook-secret-test",
            "TURISMO_CLIENT_ID": "turismo-test",
            "TURISMO_CLIENT_SECRET": "turismo-secret",
            "BOT_DATABASE": ":memory:",
            "DEEPSEEK_API_KEY": "",
        }
        with patch.dict("os.environ", settings), TestClient(app) as client:
            self.assertEqual(client.get("/health").status_code, 200)
            payload = {"update_id": 1, "message": {"chat": {"id": -1, "type": "group"}}}
            self.assertEqual(client.post("/telegram/webhook", json=payload).status_code, 401)
            headers = {"X-Telegram-Bot-Api-Secret-Token": settings["TELEGRAM_WEBHOOK_SECRET"]}
            self.assertEqual(client.post("/telegram/webhook", json=payload, headers=headers).status_code, 204)
