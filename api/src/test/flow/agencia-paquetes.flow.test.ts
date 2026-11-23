// Flujo 01 — de cero a paquete publicado, únicamente a través de endpoints.
//
// El super usuario viene del seeder (SUPER_USER_*); no se crea por API.
// La única lectura fuera de HTTP es el buzón falso, porque el token de
// activación solo existe dentro del correo que se envía al aprobar el socio.
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
  // Cada endpoint devuelve una forma distinta; se inspecciona campo a campo.
  data?: any;
  meta?: any;
  errors?: Record<string, string[]>;
}

let server: Server | undefined;
let apiBase = "";
let origin = "";

const RUN = Date.now().toString(36);
const AGENCY_EMAIL = `flujo-agencia-${RUN}@e2e.local`;
const AGENCY_NAME = `Agencia Flujo ${RUN}`;
const AGENCY_PASSWORD = "AgenciaFlujo123!";

// Estado que va pasando de paso en paso.
let adminToken = "";
let categoryId = "";
let regionId = "";
let agencyId = "";
let agencyToken = "";
let packageId = "";

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
    refreshToken: string;
    user: { id: string; role: string; partner: any };
  };
}

function extractActivationToken(): string {
  const mails = MailService.capturedMails();
  assert.ok(mails.length > 0, "debía enviarse el correo de activación");

  const mail = mails[mails.length - 1];
  assert.ok(mail, "el buzón falso debía tener al menos un correo");
  assert.ok(
    mail.html.includes("/activate-account?token="),
    "el correo debe incluir el enlace de activación"
  );

  const match = /token=([a-f0-9]{64})/.exec(mail.html);
  assert.ok(match, "el enlace debe incluir un token SHA-256 en hexadecimal");

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

describe("Flujo 01 · de cero a paquete publicado", () => {
  it("Paso 1 · la API está en pie", async () => {
    const response = await fetch(`${origin}/health`);
    assert.equal(response.status, 200);
  });

  it("Paso 2 · el administrador entra con las credenciales del seeder", async () => {
    const session = await login(
      METACONFIG.superUser.email,
      METACONFIG.superUser.password
    );

    assert.equal(session.user.role, "super_user");
    adminToken = session.accessToken;
  });

  it("Paso 3 · consulta los catálogos base (estados, regiones, categorías)", async () => {
    const states = await api("GET", "/regions/states");
    assert.equal(states.status, 200);
    assert.ok(states.body.data.length > 0, "debe haber estados activos");

    const categories = await api(
      "GET",
      "/partner-categories?includeInactive=true"
    );
    assert.equal(categories.status, 200);
    const agency = categories.body.data.find(
      (category: { code: string }) => category.code === "agency"
    );
    assert.ok(agency, "debe existir la categoría agency");
    categoryId = agency.id;

    const regions = await api(
      "GET",
      "/regions?status=all&type=municipality&limit=1"
    );
    assert.equal(regions.status, 200);
    assert.ok(regions.body.data.length > 0, "debe existir un municipio");
    regionId = regions.body.data[0].id;
  });

  it("Paso 4 · da de alta la agencia en estado pending", async () => {
    const created = await api("POST", "/partners", {
      token: adminToken,
      body: {
        categoryId,
        regionId,
        commercialName: AGENCY_NAME,
        legalName: `${AGENCY_NAME} S.A. de C.V.`,
        description: "Agencia receptiva de pruebas de flujo completo.",
        address: "Av. Flujo 100, Centro",
        contactName: "Contacto Flujo",
        contactEmail: AGENCY_EMAIL,
        contactPhone: "9611234567",
        ownerName: "Owner Flujo",
        ownerEmail: AGENCY_EMAIL,
        invite: false,
      },
    });

    assert.equal(created.status, 201);
    assert.equal(created.body.data.status, "pending");
    assert.equal(created.body.data.ownerEmail, AGENCY_EMAIL);

    agencyId = created.body.data.partnerId as string;
  });

  it("Paso 5 · el responsable todavía no puede entrar (cuenta invitada)", async () => {
    const attempt = await api("POST", "/auth/login", {
      body: { email: AGENCY_EMAIL, password: AGENCY_PASSWORD },
    });

    assert.equal(attempt.status, 401);
    assert.equal(attempt.body.code, "INVALID_CREDENTIALS");
  });

  it("Paso 6 · el administrador aprueba y se envía la invitación", async () => {
    MailService.clearCapturedMails();

    const approved = await api("PATCH", `/partners/${agencyId}/approve`, {
      token: adminToken,
    });

    assert.equal(approved.status, 200);
    assert.equal(MailService.capturedMails().length, 1);
  });

  it("Paso 7 · el responsable activa su cuenta con el token del correo", async () => {
    const token = extractActivationToken();

    const activated = await api("POST", "/auth/activate", {
      body: { token, password: AGENCY_PASSWORD },
    });

    assert.equal(activated.status, 200);
  });

  it("Paso 8 · el enlace de activación es de un solo uso", async () => {
    const token = extractActivationToken();

    const reused = await api("POST", "/auth/activate", {
      body: { token, password: "OtraClave123!" },
    });

    assert.equal(reused.status, 400);
    assert.equal(reused.body.code, "ACTIVATION_TOKEN_USED");
  });

  it("Paso 9 · la agencia ya puede iniciar sesión y queda ligada a su socio", async () => {
    const session = await login(AGENCY_EMAIL, AGENCY_PASSWORD);

    assert.equal(session.user.role, "partner");
    assert.equal(session.user.partner.id, agencyId);
    assert.equal(session.user.partner.role, "owner");

    agencyToken = session.accessToken;
  });

  it("Paso 10 · la agencia no puede ver el listado global de socios", async () => {
    const forbidden = await api("GET", "/partners", { token: agencyToken });

    assert.equal(forbidden.status, 403);
    assert.equal(forbidden.body.code, "ROLE_NOT_ALLOWED");
  });

  it("Paso 11 · la agencia crea su paquete en borrador", async () => {
    const created = await api("POST", "/packages", {
      token: agencyToken,
      body: {
        destinationRegionId: regionId,
        name: `Escapada Flujo ${RUN}`,
        summary: "Tres días con hospedaje, traslados y tour guiado.",
        description:
          "Paquete creado por el flujo automatizado para validar el recorrido completo de una agencia recién activada.",
        nights: 2,
        cancellationPolicy:
          "Cancelación gratuita hasta 7 días antes de la salida.",
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
            description: "Traslado del aeropuerto y check-in en el hotel.",
          },
        ],
      },
    });

    assert.equal(created.status, 201);
    assert.equal(created.body.data.status, "draft");

    packageId = created.body.data.id as string;
  });

  it("Paso 12 · no puede publicarlo sin una salida con cupo y precio", async () => {
    const attempt = await api("PATCH", `/packages/${packageId}/status`, {
      token: agencyToken,
      body: { status: "published" },
    });

    assert.equal(attempt.status, 422);
    assert.equal(attempt.body.code, "VALIDATION_ERROR");
    assert.ok(attempt.body.errors?.departures);
  });

  it("Paso 13 · agrega una fecha de salida", async () => {
    const departure = await api(
      "POST",
      `/packages/${packageId}/departures`,
      {
        token: agencyToken,
        body: {
          departureDate: futureDate(30),
          totalSeats: 10,
          adultPrice: 4500,
          childPrice: 2800,
        },
      }
    );

    assert.equal(departure.status, 201);
    assert.equal(departure.body.data.availableSeats, 10);
  });

  it("Paso 14 · publica el paquete", async () => {
    const published = await api("PATCH", `/packages/${packageId}/status`, {
      token: agencyToken,
      body: { status: "published" },
    });

    assert.equal(published.status, 200);
    assert.equal(published.body.data.status, "published");
    assert.equal(Number(published.body.data.minPriceAdult), 4500);
  });

  it("Paso 15 · el paquete aparece en el catálogo público", async () => {
    const catalog = await api(
      "GET",
      `/packages?search=${encodeURIComponent(`Escapada Flujo ${RUN}`)}`
    );

    assert.equal(catalog.status, 200);
    assert.ok(
      catalog.body.data.some((item: { id: string }) => item.id === packageId)
    );

    const detail = await api("GET", `/packages/${packageId}`);
    assert.equal(detail.status, 200);
    assert.equal(detail.body.data.departures.length, 1);
    assert.equal(detail.body.data.items.length, 1);
  });

  it("Paso 16 · otra agencia no puede editar el paquete ajeno", async () => {
    const rival = await login(
      "agencia.test@plataforma.com",
      "Test1234!"
    );

    const forbidden = await api("PATCH", `/packages/${packageId}`, {
      token: rival.accessToken,
      body: { summary: "Intento de edición desde otra agencia." },
    });

    assert.equal(forbidden.status, 403);
    assert.equal(forbidden.body.code, "PACKAGE_ACCESS_DENIED");
  });

  it("Paso 17 · suspender la agencia le corta el acceso en la siguiente petición", async () => {
    const suspended = await api("PATCH", `/partners/${agencyId}/suspend`, {
      token: adminToken,
      body: { reason: "Suspensión temporal del flujo automatizado." },
    });
    assert.equal(suspended.status, 200);

    const blocked = await api("GET", `/partners/${agencyId}`, {
      token: agencyToken,
    });
    assert.equal(blocked.status, 403);
    assert.equal(blocked.body.code, "PARTNER_INACTIVE");
  });

  it("Paso 18 · al reactivarla recupera el acceso y el paquete sigue publicado", async () => {
    const reactivated = await api(
      "PATCH",
      `/partners/${agencyId}/reactivate`,
      { token: adminToken }
    );
    assert.equal(reactivated.status, 200);

    const allowed = await api("GET", `/packages/${packageId}`, {
      token: agencyToken,
    });
    assert.equal(allowed.status, 200);
    assert.equal(allowed.body.data.status, "published");
  });
});
