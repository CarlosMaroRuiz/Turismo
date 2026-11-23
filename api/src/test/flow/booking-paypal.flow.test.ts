import "../setup/test-env.js";
import assert from "node:assert/strict";
import { once } from "node:events";
import { test } from "node:test";

process.env.PAYPAL_MODE = "sandbox";
process.env.PAYPAL_CLIENT_ID = "test-merchant";
process.env.PAYPAL_CLIENT_SECRET = "test-secret";
process.env.PAYPAL_WEBHOOK_ID = "test-hook";
process.env.PAYPAL_PUBLIC_API_URL = "https://turismo.test";

const { App } = await import("../../core/server/App.js");
const { AppDataSource } = await import("../../core/bd/index.js");
const { ApiClient } = await import("../../core/bd/entities/ApiClient.js");
const { Booking } = await import("../../core/bd/entities/Booking.js");
const { PackageDeparture } = await import("../../core/bd/entities/PackageDeparture.js");

test("el último cupo se aparta una sola vez y la captura confirma una sola reserva", async (t) => {
  await AppDataSource.initialize();
  t.after(() => AppDataSource.destroy());
  await AppDataSource.getRepository(ApiClient).update({ clientId: "test-service-client" }, {
    scopes: ["catalog:read", "quote:write", "booking:write"],
  });
  const departure = await AppDataSource.getRepository(PackageDeparture).findOneByOrFail({ totalSeats: 20, soldSeats: 0 });
  await AppDataSource.getRepository(PackageDeparture).update(departure.id, { totalSeats: 1 });

  const server = new App().instance.listen(0, "127.0.0.1");
  await once(server, "listening");
  t.after(() => new Promise<void>((resolve, reject) => server.close((error) => error ? reject(error) : resolve())));
  const address = server.address();
  assert.ok(address && typeof address === "object");
  const root = `http://127.0.0.1:${address.port}/api/v1`;

  const actualFetch = globalThis.fetch;
  let order: { id: string; status: string; purchase_units: unknown[] } | undefined;
  let orderRequests = 0;
  let captureRequests = 0;
  let approved = false;
  let captured = false;
  let signatureAccepted = false;
  t.mock.method(globalThis, "fetch", async (input: string, init?: RequestInit) => {
    const url = new URL(input);
    if (url.hostname !== "api-m.sandbox.paypal.com") return actualFetch(input, init);

    if (url.pathname === "/v1/oauth2/token") {
      return Response.json({ access_token: "paypal-test", expires_in: 500 });
    }
    if (url.pathname === "/v1/notifications/verify-webhook-signature") {
      assert.match(String(init?.body), /"webhook_event":\{ "id":/);
      return Response.json({ verification_status: signatureAccepted ? "SUCCESS" : "FAILURE" });
    }
    if (url.pathname === "/v2/checkout/orders") {
      orderRequests++;
      const body = JSON.parse(String(init?.body));
      order = { id: `ORDER-${orderRequests}`, status: "PAYER_ACTION_REQUIRED", purchase_units: body.purchase_units };
      return Response.json({
        ...order,
        links: [{ rel: "payer-action", href: "https://www.sandbox.paypal.com/checkoutnow?token=ORDER-1" }],
      });
    }
    assert.ok(order, "La orden debe existir");
    if (url.pathname.endsWith("/capture")) {
      captureRequests++;
      captured = true;
    }
    if (!captured) return Response.json({ ...order, status: approved ? "APPROVED" : order.status });
    const [unit] = order.purchase_units as { amount: object; reference_id: string }[];
    assert.ok(unit);
    return Response.json({
      ...order,
      status: "COMPLETED",
      purchase_units: [{ ...unit, payments: {
        captures: [{ id: "CAPTURE-1", status: "COMPLETED", amount: unit.amount }],
      } }],
    });
  });

  const tokenResponse = await actualFetch(root + "/auth/service-token", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ clientId: "test-service-client", secret: "test-service-secret-1234" }),
  });
  assert.equal(tokenResponse.status, 200);
  const { data: token } = await tokenResponse.json();

  async function api(path: string, body?: object) {
    const response = await actualFetch(root + path, {
      method: body ? "POST" : "GET",
      headers: { authorization: `Bearer ${token.accessToken}`, "content-type": "application/json" },
      ...(body ? { body: JSON.stringify(body) } : {}),
    });
    return { status: response.status, body: await response.json() };
  }

  const selection = { items: [{ type: "package_departure", departureId: departure.id, adults: 1 }] };
  const region = await api("/regions?search=Cancun");
  assert.equal(region.status, 200);
  assert.ok(region.body.data.some(({ name }: { name: string }) => name === "Benito Juárez"));
  const quotes = await Promise.all([api("/quotes", selection), api("/quotes", selection)]);
  assert.deepEqual(quotes.map(({ status }) => status), [201, 201], JSON.stringify(quotes));
  const [first, second] = quotes;
  assert.ok(first && second);
  const requests = [
    { quoteId: first.body.data.quoteId, travelerRef: "telegram:1" },
    { quoteId: second.body.data.quoteId, travelerRef: "telegram:2" },
  ];
  const checkouts = await Promise.all(requests.map((body) => api("/bookings/checkout", body)));
  assert.deepEqual(checkouts.map(({ status }) => status).sort(), [200, 409], JSON.stringify(checkouts));
  const winner = checkouts.findIndex(({ status }) => status === 200);
  const buyer = requests[winner]!;
  const booking = checkouts[winner]!.body.data;
  assert.match(booking.paymentUrl, /^https:\/\/www\.sandbox\.paypal\.com\//);
  assert.equal(orderRequests, 1);
  assert.equal((await api("/bookings/checkout", buyer)).body.data.bookingId, booking.bookingId);
  assert.equal((await api("/bookings/" + booking.bookingId + "?travelerRef=telegram:999")).status, 404);
  assert.equal((await api("/quotes", selection)).body.code, "INSUFFICIENT_AVAILABILITY");

  const webhook = () => actualFetch(root + "/bookings/paypal/webhook", {
    method: "POST",
    headers: {
      "content-type": "application/json",
      "paypal-auth-algo": "SHA256withRSA",
      "paypal-cert-url": "https://example.test/cert",
      "paypal-transmission-id": "test-transmission",
      "paypal-transmission-sig": "signature",
      "paypal-transmission-time": "2026-11-22T00:00:00Z",
    },
    body: '{ "id":"test-event", "event_type":"CHECKOUT.ORDER.APPROVED", "resource":{"id":"ORDER-1"}}',
  });
  assert.equal((await webhook()).status, 401);
  assert.equal(captureRequests, 0);
  approved = signatureAccepted = true;
  assert.equal((await webhook()).status, 204);
  assert.equal((await webhook()).status, 204);
  assert.equal(captureRequests, 1);
  const confirmed = await AppDataSource.getRepository(Booking).findOneByOrFail({ id: booking.bookingId });
  assert.equal(confirmed.status, "confirmed");
  assert.equal(confirmed.paypalCaptureId, "CAPTURE-1");
  assert.equal((await AppDataSource.getRepository(PackageDeparture).findOneByOrFail({ id: departure.id })).soldSeats, 1);
  assert.equal((await api("/bookings/" + booking.bookingId + "?travelerRef=" + buyer.travelerRef)).body.data.status, "confirmed");

  const anotherDeparture = await AppDataSource.getRepository(PackageDeparture)
    .findOneByOrFail({ totalSeats: 20, soldSeats: 4 });
  await AppDataSource.getRepository(PackageDeparture).update(anotherDeparture.id, { totalSeats: 5 });
  const anotherSelection = { items: [{ ...selection.items[0], departureId: anotherDeparture.id }] };
  const offered = await api("/quotes", anotherSelection);
  assert.equal(offered.status, 201);
  const pending = await api("/bookings/checkout", { quoteId: offered.body.data.quoteId, travelerRef: "telegram:3" });
  assert.equal(pending.status, 200);
  assert.equal((await api("/quotes", anotherSelection)).body.code, "INSUFFICIENT_AVAILABILITY");
  await AppDataSource.getRepository(Booking).update(pending.body.data.bookingId, {
    expiresAt: new Date(Date.now() - 60_000),
  });
  const expired = await api("/bookings/" + pending.body.data.bookingId + "?travelerRef=telegram:3");
  assert.equal(expired.body.data.status, "expired");
  assert.equal(expired.body.data.paymentUrl, null);
  assert.equal((await api("/quotes", anotherSelection)).status, 201);
});
