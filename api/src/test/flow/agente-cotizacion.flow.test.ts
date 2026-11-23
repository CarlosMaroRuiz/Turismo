// Flujo 03 — El agente cotiza un viaje multi-servicio.
//
// Todo pasa por endpoints: se prepara el catálogo (agencia, hotel y atractivo),
// el servicio de LLM pide su credencial y cotiza paquete + estancia + turno.
// Lo único fuera de HTTP es leer el buzón falso para activar cuentas.
import "../setup/test-env.js";

import { after, before, describe, it } from "node:test";
import assert from "node:assert/strict";
import type { Server } from "node:http";

import { App } from "../../core/server/App.js";
import { AppDataSource } from "../../core/bd/index.js";
import { MailService } from "../../core/mail/index.js";
import { METACONFIG } from "../../core/metaconfig/index.js";

interface ApiBody {
  ok: boolean;
  code?: string;
  message: string;
  data?: any;
  meta?: any;
  errors?: Record<string, string[]>;
}

let server: Server | undefined;
let apiBase = "";
let origin = "";

const RUN = Date.now().toString(36);
const PROVIDER_PASSWORD = "ProveedorFlujo123!";
const checkIn = futureDate(20);
const checkOut = futureDate(22);
const returnDate = futureDate(30);
const slotDate = futureDate(6);

// Estado del recorrido.
let adminToken = "";
let agencyToken = "";
let hotelToken = "";
let attractionToken = "";
let serviceToken = "";
let packageId = "";
let departureId = "";
let roomTypeId = "";
let slotId = "";
const categoryIds: Record<string, string> = {};
let regionId = "";

let quoteId = "";
let quoteTotal = 0;

async function api(
  method: string,
  path: string,
  options: { body?: unknown; token?: string } = {}
): Promise<{ status: number; body: ApiBody }> {
  const headers: Record<string, string> = {
    "Content-Type": "application/json",
  };
  if (options.token !== undefined) {
    headers.Authorization = `Bearer ${options.token}`;
  }

  const response = await fetch(`${apiBase}${path}`, {
    method,
    headers,
    ...(options.body !== undefined
      ? { body: JSON.stringify(options.body) }
      : {}),
  });

  return { status: response.status, body: (await response.json()) as ApiBody };
}

async function login(email: string, password: string) {
  const { status, body } = await api("POST", "/auth/login", {
    body: { email, password },
  });
  assert.equal(status, 200, `login de ${email} debía responder 200`);
  return body.data as {
    accessToken: string;
    user: { role: string; partner: any };
  };
}

function extractTokenFromLastMail(): string {
  const mails = MailService.capturedMails();
  assert.ok(mails.length > 0, "debía enviarse el correo de activación");

  const mail = mails[mails.length - 1];
  assert.ok(mail);

  const match = /token=([a-f0-9]{64})/.exec(mail.html);
  assert.ok(match, "el enlace debe incluir un token SHA-256");

  const token = match[1];
  assert.ok(token);
  return token;
}

function futureDate(daysFromNow: number): string {
  return new Date(Date.now() + daysFromNow * 86_400_000)
    .toISOString()
    .slice(0, 10);
}

/** Alta completa de un proveedor: admin crea, aprueba y el owner activa. */
async function createProvider(
  categoryCode: string,
  label: string
): Promise<{ email: string; partnerId: string }> {
  const email = `flujo-${categoryCode}-${RUN}@e2e.local`;

  const created = await api("POST", "/partners", {
    token: adminToken,
    body: {
      categoryId: categoryIds[categoryCode],
      regionId,
      commercialName: `${label} ${RUN}`,
      legalName: `${label} ${RUN} S.A. de C.V.`,
      description: `Proveedor de pruebas del flujo de cotización (${categoryCode}).`,
      address: "Av. Flujo 200, Centro",
      contactName: "Contacto Flujo",
      contactEmail: email,
      contactPhone: "9611234567",
      ownerName: "Owner Flujo",
      ownerEmail: email,
      invite: false,
    },
  });
  assert.equal(created.status, 201, `alta de ${categoryCode} debía responder 201`);
  const partnerId = created.body.data.partnerId as string;

  MailService.clearCapturedMails();
  const approved = await api("PATCH", `/partners/${partnerId}/approve`, {
    token: adminToken,
  });
  assert.equal(approved.status, 200, `approve de ${categoryCode} debía responder 200`);
  assert.equal(MailService.capturedMails().length, 1);

  const activated = await api("POST", "/auth/activate", {
    body: {
      token: extractTokenFromLastMail(),
      password: PROVIDER_PASSWORD,
    },
  });
  assert.equal(activated.status, 200, `activate de ${categoryCode} debía responder 200`);

  return { email, partnerId };
}

before(async () => {
  if (!AppDataSource.isInitialized) {
    await AppDataSource.initialize();
  }

  const app = new App().instance;
  const running = app.listen(0, "127.0.0.1");

  await new Promise<void>((resolve) => {
    running.once("listening", () => resolve());
  });

  server = running;
  const address = running.address();
  if (address === null || typeof address === "string") {
    throw new Error("No se pudo obtener el puerto efímero del servidor de test");
  }

  origin = `http://127.0.0.1:${address.port}`;
  apiBase = `${origin}/api/v1`;
});

after(async () => {
  const running = server;
  if (running !== undefined) {
    await new Promise<void>((resolve) => running.close(() => resolve()));
  }
  if (AppDataSource.isInitialized) {
    await AppDataSource.destroy();
  }
});

describe("Flujo 03 · el agente cotiza un viaje multi-servicio", () => {
  it("Paso 1 · la API está en pie", async () => {
    const response = await fetch(`${origin}/health`);
    assert.equal(response.status, 200);
  });

  it("Paso 2 · el administrador inicia sesión", async () => {
    const session = await login(
      METACONFIG.superUser.email,
      METACONFIG.superUser.password
    );
    assert.equal(session.user.role, "super_user");
    adminToken = session.accessToken;
  });

  it("Paso 3 · carga el catálogo base y las tres categorías", async () => {
    const categories = await api(
      "GET",
      "/partner-categories?includeInactive=true"
    );
    assert.equal(categories.status, 200);

    for (const code of ["agency", "hotel", "attraction"]) {
      const category = categories.body.data.find(
        (item: { code: string }) => item.code === code
      );
      assert.ok(category, `debe existir la categoría ${code}`);
      categoryIds[code] = category.id;
    }

    const regions = await api(
      "GET",
      "/regions?status=all&type=municipality&limit=1"
    );
    assert.equal(regions.status, 200);
    regionId = regions.body.data[0].id;
  });

  it("Paso 4 · la agencia sembrada inicia sesión", async () => {
    const session = await login("agencia.test@plataforma.com", "Test1234!");
    assert.equal(session.user.role, "partner");
    agencyToken = session.accessToken;
  });

  it("Paso 5 · la agencia publica un paquete con promoción del 10 %", async () => {
    const created = await api("POST", "/packages", {
      token: agencyToken,
      body: {
        destinationRegionId: regionId,
        name: `Escapada Agente ${RUN}`,
        summary: "Tres días con hospedaje, traslados y tour guiado.",
        description:
          "Paquete del flujo de cotización: sirve para validar el desglose de promoción e impuestos del agente.",
        nights: 2,
        cancellationPolicy:
          "Cancelación gratuita hasta 7 días antes de la salida.",
        taxesIncluded: true,
        items: [
          {
            type: "lodging",
            description: "2 noches de hospedaje con desayuno",
            isIncluded: true,
            sortOrder: 1,
          },
        ],
        itinerary: [
          {
            dayNumber: 1,
            title: "Llegada",
            description: "Traslado del aeropuerto y check-in.",
          },
        ],
        promotions: [
          {
            name: "Reserva anticipada 10%",
            discountType: "percentage",
            discountValue: 10,
            validFrom: futureDate(0),
            validTo: futureDate(90),
          },
        ],
      },
    });

    assert.equal(created.status, 201);
    packageId = created.body.data.id as string;
  });

  it("Paso 6 · la agencia agrega la salida y publica", async () => {
    const departure = await api(
      "POST",
      `/packages/${packageId}/departures`,
      {
        token: agencyToken,
        body: {
          departureDate: returnDate,
          totalSeats: 10,
          adultPrice: 4500,
          childPrice: 2800,
        },
      }
    );
    assert.equal(departure.status, 201);
    departureId = departure.body.data.id as string;

    const published = await api("PATCH", `/packages/${packageId}/status`, {
      token: agencyToken,
      body: { status: "published" },
    });
    assert.equal(published.status, 200);
    assert.equal(published.body.data.status, "published");
  });

  it("Paso 7 · el administrador da de alta el hotel y el owner activa su cuenta", async () => {
    const hotel = await createProvider("hotel", "Hotel Agente");
    const session = await login(hotel.email, PROVIDER_PASSWORD);
    assert.equal(session.user.partner.id, hotel.partnerId);
    hotelToken = session.accessToken;
  });

  it("Paso 8 · el hotel crea su habitación y carga inventario tarifado", async () => {
    const roomType = await api("POST", "/hotels/room-types", {
      token: hotelToken,
      body: {
        name: "Doble estándar",
        description: "Habitación con desayuno incluido.",
        maxAdults: 2,
        maxChildren: 1,
        totalUnits: 4,
        basePrice: 1200,
        amenities: ["wifi", "desayuno"],
      },
    });
    assert.equal(roomType.status, 201);
    roomTypeId = roomType.body.data.id as string;

    const inventory = await api(
      "PUT",
      `/hotels/room-types/${roomTypeId}/inventory`,
      {
        token: hotelToken,
        body: { from: checkIn, to: checkOut, units: 3, price: 1500 },
      }
    );
    assert.equal(inventory.status, 200);
    assert.equal(inventory.body.data.created, 3);
  });

  it("Paso 9 · el administrador da de alta el atractivo y su owner activa la cuenta", async () => {
    const attraction = await createProvider("attraction", "Atractivo Agente");
    const session = await login(attraction.email, PROVIDER_PASSWORD);
    assert.equal(session.user.partner.id, attraction.partnerId);
    attractionToken = session.accessToken;
  });

  it("Paso 10 · el atractivo publica su experiencia con un turno", async () => {
    const experience = await api("POST", "/experiences", {
      token: attractionToken,
      body: {
        regionId,
        name: `Cenote del Flujo ${RUN}`,
        description:
          "Nado en cenote con guía certificado y equipo de snorkel incluido.",
        durationMinutes: 120,
        minAge: 6,
        priceAdult: 850,
        priceChild: 450,
      },
    });
    assert.equal(experience.status, 201);

    const slot = await api(
      "POST",
      `/experiences/${experience.body.data.id}/slots`,
      {
        token: attractionToken,
        body: { date: slotDate, startTime: "09:00", capacity: 4 },
      }
    );
    assert.equal(slot.status, 201);
    slotId = slot.body.data.id as string;
    assert.equal(slot.body.data.remaining, 4);
  });

  it("Paso 11 · el servicio de LLM obtiene su credencial con scope de cotización", async () => {
    const issued = await api("POST", "/auth/service-token", {
      body: {
        clientId: "test-service-client",
        secret: "test-service-secret-1234",
      },
    });

    assert.equal(issued.status, 200);
    assert.ok(issued.body.data.scopes.includes("quote:write"));
    serviceToken = issued.body.data.accessToken as string;
  });

  it("Paso 12 · cotiza paquete + estancia + turno en un solo desglose", async () => {
    const quote = await api("POST", "/quotes", {
      token: serviceToken,
      body: {
        items: [
          {
            type: "package_departure",
            departureId,
            adults: 2,
            children: 0,
          },
          {
            type: "room_stay",
            roomTypeId,
            checkIn,
            checkOut,
            adults: 2,
            children: 1,
          },
          { type: "experience_slot", slotId, adults: 2, children: 0 },
        ],
      },
    });

    assert.equal(quote.status, 201);
    assert.equal(quote.body.data.items.length, 3);

    // Paquete 2×4500 = 9000 con 10 % → 8100; habitación 2×1500 = 3000;
    // turno 2×850 = 1700. Subtotal 13700, descuento 900, total 12800.
    assert.equal(quote.body.data.subtotal, 13700);
    assert.equal(quote.body.data.discountTotal, 900);
    assert.equal(quote.body.data.taxesTotal, 0);
    assert.equal(quote.body.data.total, 12800);
    assert.ok(quote.body.data.reference.startsWith("QT-"));

    quoteId = quote.body.data.quoteId as string;
    quoteTotal = quote.body.data.total as number;
  });

  it("Paso 13 · la cotización se puede recuperar y vence en 15 minutos", async () => {
    const fetched = await api("GET", `/quotes/${quoteId}`, {
      token: serviceToken,
    });

    assert.equal(fetched.status, 200);
    assert.equal(fetched.body.data.total, quoteTotal);

    const minutesToExpire =
      (new Date(fetched.body.data.expiresAt).getTime() - Date.now()) / 60000;
    assert.ok(
      minutesToExpire > 14 && minutesToExpire <= 15.1,
      `la vigencia debía ser ~15 min y fue ${minutesToExpire.toFixed(2)}`
    );
  });

  it("Paso 14 · el desglose no depende de precios enviados por el cliente", async () => {
    const detail = await api("GET", `/quotes/${quoteId}`, {
      token: serviceToken,
    });

    const packageLine = detail.body.data.items.find(
      (line: { type: string }) => line.type === "package_departure"
    );
    assert.ok(packageLine);
    assert.equal(packageLine.subtotal, 9000);
    assert.equal(packageLine.discount, 900);
    assert.equal(packageLine.taxesIncluded, true);

    const roomLine = detail.body.data.items.find(
      (line: { type: string }) => line.type === "room_stay"
    );
    assert.equal(roomLine.quantity, 2);
    assert.equal(roomLine.quantityLabel, "noches");

    const slotLine = detail.body.data.items.find(
      (line: { type: string }) => line.type === "experience_slot"
    );
    assert.equal(slotLine.quantity, 2);
    assert.equal(slotLine.unitPrice, 850);
  });

  it("Paso 15 · rechaza cupo y capacidad insuficientes", async () => {
    const noSeats = await api("POST", "/quotes", {
      token: serviceToken,
      body: {
        items: [{ type: "experience_slot", slotId, adults: 5, children: 0 }],
      },
    });
    assert.equal(noSeats.status, 400);
    assert.equal(noSeats.body.code, "INSUFFICIENT_AVAILABILITY");

    const overCapacity = await api("POST", "/quotes", {
      token: serviceToken,
      body: {
        items: [
          { type: "room_stay", roomTypeId, checkIn, checkOut, adults: 3 },
        ],
      },
    });
    assert.equal(overCapacity.status, 400);
    assert.equal(overCapacity.body.code, "ROOM_CAPACITY_EXCEEDED");
  });

  it("Paso 16 · exige credencial de servicio, no token de usuario", async () => {
    const body = {
      items: [{ type: "experience_slot", slotId, adults: 1 }],
    };

    const anonymous = await api("POST", "/quotes", { body });
    assert.equal(anonymous.status, 401);

    const withUserToken = await api("POST", "/quotes", {
      token: adminToken,
      body,
    });
    assert.equal(withUserToken.status, 403);
    assert.equal(withUserToken.body.code, "SERVICE_TOKEN_REQUIRED");

    const withServiceToken = await api("POST", "/quotes", {
      token: serviceToken,
      body,
    });
    assert.equal(withServiceToken.status, 201);
  });
});
