// Flujo 02 — Un hotel carga habitaciones e inventario y queda visible.
//
// Todo pasa por endpoints: el administrador da de alta el hotel, el owner
// activa su cuenta, carga dos habitaciones con tarifas y cierre rápido, y el
// catálogo público empieza a ofrecerlas.
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
const HOTEL_EMAIL = `flujo-hotel-${RUN}@e2e.local`;
const HOTEL_PASSWORD = "HotelFlujo123!";
const IMAGE = "https://picsum.photos/seed/flujo-hotel/1200/800";

const checkIn = futureDate(10);
const checkOut = futureDate(13);

// Estado del recorrido.
let adminToken = "";
let hotelToken = "";
let hotelPartnerId = "";
let hotelCategoryId = "";
let regionId = "";
let roomTypeId = "";
let suiteTypeId = "";

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
  assert.ok(match);

  const token = match[1];
  assert.ok(token);
  return token;
}

function futureDate(daysFromNow: number): string {
  return new Date(Date.now() + daysFromNow * 86_400_000)
    .toISOString()
    .slice(0, 10);
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

describe("Flujo 02 · el hotel carga habitaciones e inventario", () => {
  it("Paso 1 · la API está en pie", async () => {
    const response = await fetch(`${origin}/health`);
    assert.equal(response.status, 200);
  });

  it("Paso 2 · el administrador inicia sesión", async () => {
    const session = await login(
      METACONFIG.superUser.email,
      METACONFIG.superUser.password
    );
    adminToken = session.accessToken;
  });

  it("Paso 3 · obtiene la categoría hotel y una región activa", async () => {
    const categories = await api(
      "GET",
      "/partner-categories?includeInactive=true"
    );
    assert.equal(categories.status, 200);

    const code = categories.body.data.find(
      (item: { code: string }) => item.code === "hotel"
    );
    assert.ok(code, "debe existir la categoría hotel");

    const regions = await api(
      "GET",
      "/regions?status=all&type=municipality&limit=1"
    );
    assert.equal(regions.status, 200);
    assert.ok(regions.body.data.length > 0);

    hotelCategoryId = code.id as string;
    regionId = regions.body.data[0].id as string;
  });

  it("Paso 4 · el administrador da de alta el hotel", async () => {
    const created = await api("POST", "/partners", {
      token: adminToken,
      body: {
        categoryId: hotelCategoryId,
        regionId,
        commercialName: `Hotel Flujo ${RUN}`,
        legalName: `Hotel Flujo ${RUN} S.A. de C.V.`,
        description:
          "Hotel creado por el flujo automatizado para validar el portal de hotel.",
        address: "Av. Flujo 300, Zona Hotelera",
        contactName: "Contacto Hotel",
        contactEmail: HOTEL_EMAIL,
        contactPhone: "9611234567",
        ownerName: "Owner Hotel",
        ownerEmail: HOTEL_EMAIL,
        invite: false,
      },
    });

    assert.equal(created.status, 201);
    assert.equal(created.body.data.status, "pending");
    hotelPartnerId = created.body.data.partnerId as string;
  });

  it("Paso 5 · el administrador aprueba y se envía la invitación", async () => {
    MailService.clearCapturedMails();

    const approved = await api("PATCH", `/partners/${hotelPartnerId}/approve`, {
      token: adminToken,
    });

    assert.equal(approved.status, 200);
    assert.equal(MailService.capturedMails().length, 1);
  });

  it("Paso 6 · el owner activa su cuenta con el token del correo", async () => {
    const activated = await api("POST", "/auth/activate", {
      body: { token: extractTokenFromLastMail(), password: HOTEL_PASSWORD },
    });

    assert.equal(activated.status, 200);
  });

  it("Paso 7 · el hotel entra y su sesión indica la categoría", async () => {
    const session = await login(HOTEL_EMAIL, HOTEL_PASSWORD);

    assert.equal(session.user.partner.id, hotelPartnerId);
    assert.equal(session.user.partner.categoryCode, "hotel");
    hotelToken = session.accessToken;
  });

  it("Paso 8 · crea una habitación con imágenes", async () => {
    const created = await api("POST", "/hotels/room-types", {
      token: hotelToken,
      body: {
        name: `Doble Flujo ${RUN}`,
        description: "Habitación con dos camas y balcón.",
        maxAdults: 2,
        maxChildren: 1,
        totalUnits: 4,
        basePrice: 1200,
        amenities: ["wifi", "desayuno"],
        images: [IMAGE],
      },
    });

    assert.equal(created.status, 201);
    assert.deepEqual(created.body.data.images, [IMAGE]);
    roomTypeId = created.body.data.id as string;
  });

  it("Paso 9 · crea una segunda habitación familiar", async () => {
    const created = await api("POST", "/hotels/room-types", {
      token: hotelToken,
      body: {
        name: `Suite Flujo ${RUN}`,
        description: "Suite con sala y dos habitaciones.",
        maxAdults: 4,
        maxChildren: 2,
        totalUnits: 2,
        basePrice: 2200,
        amenities: ["wifi", "cocina"],
      },
    });

    assert.equal(created.status, 201);
    suiteTypeId = created.body.data.id as string;
  });

  it("Paso 10 · carga inventario para el rango de fechas", async () => {
    const inventory = await api(
      "PUT",
      `/hotels/room-types/${roomTypeId}/inventory`,
      {
        token: hotelToken,
        body: { from: checkIn, to: checkOut, units: 3, price: 1500 },
      }
    );

    assert.equal(inventory.status, 200);
    assert.equal(inventory.body.data.created, 4);
  });

  it("Paso 11 · actualiza la tarifa del mismo rango", async () => {
    const inventory = await api(
      "PUT",
      `/hotels/room-types/${roomTypeId}/inventory`,
      {
        token: hotelToken,
        body: { from: checkIn, to: checkOut, price: 1600 },
      }
    );

    assert.equal(inventory.status, 200);
    assert.equal(inventory.body.data.updated, 4);
  });

  it("Paso 12 · consulta su inventario ordenado por fecha", async () => {
    const inventory = await api(
      "GET",
      `/hotels/room-types/${roomTypeId}/inventory?from=${checkIn}&to=${checkOut}`,
      { token: hotelToken }
    );

    assert.equal(inventory.status, 200);
    assert.equal(inventory.body.data.length, 4);
    assert.equal(inventory.body.data[0].date, checkIn);
    assert.equal(inventory.body.data[0].price, 1600);
    assert.equal(inventory.body.data[0].units, 3);
  });

  it("Paso 13 · la habitación aparece en el catálogo público", async () => {
    const catalog = await api(
      "GET",
      `/hotels/room-types?partnerId=${hotelPartnerId}&guests=2`
    );

    assert.equal(catalog.status, 200);
    const room = catalog.body.data.find(
      (item: { id: string }) => item.id === roomTypeId
    );
    assert.ok(room, "la habitación debía estar en el catálogo");
    assert.ok(room.images.length > 0);
    assert.deepEqual(room.amenities, ["wifi", "desayuno"]);
  });

  it("Paso 14 · la disponibilidad calcula las tres noches", async () => {
    const availability = await api(
      "GET",
      `/hotels/availability?checkIn=${checkIn}&checkOut=${checkOut}&adults=2&children=1&partnerId=${hotelPartnerId}`
    );

    assert.equal(availability.status, 200);
    const room = availability.body.data.find(
      (item: { roomTypeId: string }) => item.roomTypeId === roomTypeId
    );
    assert.ok(room, "debía aparecer disponible");
    assert.equal(room.nights, 3);
    assert.equal(room.totalPrice, 4800);
    assert.equal(room.nightly.length, 3);
  });

  it("Paso 15 · un grupo más grande que la capacidad no la ve", async () => {
    const availability = await api(
      "GET",
      `/hotels/availability?checkIn=${checkIn}&checkOut=${checkOut}&adults=3&children=0&partnerId=${hotelPartnerId}`
    );

    assert.ok(
      !availability.body.data.some(
        (item: { roomTypeId: string }) => item.roomTypeId === roomTypeId
      ),
      "una habitación doble no debe ofrecerse a tres adultos"
    );

    const suite = availability.body.data.find(
      (item: { roomTypeId: string }) => item.roomTypeId === suiteTypeId
    );
    assert.ok(suite, "la suite sí debe aceptar tres adultos");
  });

  it("Paso 16 · el cierre rápido oculta la fecha y reabrirla la devuelve", async () => {
    const close = await api(
      "PUT",
      `/hotels/room-types/${roomTypeId}/inventory`,
      {
        token: hotelToken,
        body: { from: checkIn, to: checkIn, isClosed: true },
      }
    );
    assert.equal(close.status, 200);

    const availabilityUrl = `/hotels/availability?checkIn=${checkIn}&checkOut=${checkOut}&adults=1&children=0&partnerId=${hotelPartnerId}`;

    const closed = await api("GET", availabilityUrl);
    assert.ok(
      !closed.body.data.some(
        (item: { roomTypeId: string }) => item.roomTypeId === roomTypeId
      )
    );

    await api("PUT", `/hotels/room-types/${roomTypeId}/inventory`, {
      token: hotelToken,
      body: { from: checkIn, to: checkIn, isClosed: false },
    });

    const reopened = await api("GET", availabilityUrl);
    assert.ok(
      reopened.body.data.some(
        (item: { roomTypeId: string }) => item.roomTypeId === roomTypeId
      )
    );
  });

  it("Paso 17 · una agencia no puede editar la habitación del hotel", async () => {
    const agency = await login("agencia.test@plataforma.com", "Test1234!");

    const forbidden = await api("PATCH", `/hotels/room-types/${roomTypeId}`, {
      token: agency.accessToken,
      body: { basePrice: 100 },
    });

    assert.equal(forbidden.status, 403);
    assert.equal(forbidden.body.code, "ROOM_TYPE_ACCESS_DENIED");
  });
});
