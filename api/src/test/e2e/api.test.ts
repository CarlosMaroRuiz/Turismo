// PRIMER import: fija NODE_ENV=test y la base de datos de pruebas.
import "../setup/test-env.js";

import { after, before, describe, it } from "node:test";
import assert from "node:assert/strict";
import type { Server } from "node:http";

import { App } from "../../core/server/App.js";
import { AppDataSource } from "../../core/bd/index.js";
import { MailService } from "../../core/mail/index.js";
import { METACONFIG } from "../../core/metaconfig/index.js";
import { User, UserStatus } from "../../core/bd/entities/User.js";
import { Role, RoleCode } from "../../core/bd/entities/Role.js";
import { Partner, PartnerStatus } from "../../core/bd/entities/Partner.js";
import { PartnerCategory } from "../../core/bd/entities/PartnerCategory.js";
import {
  PartnerUser,
  PartnerUserRole,
} from "../../core/bd/entities/PartnerUser.js";
import { Region } from "../../core/bd/entities/Region.entity.js";
import { ExperienceSlot } from "../../core/bd/entities/ExperienceSlot.js";
import { Quote } from "../../core/bd/entities/Quote.js";
import { PasswordService } from "../../core/security/PasswordService.js";

interface ApiBody {
  ok: boolean;
  code?: string;
  message: string;
  // Las respuestas cambian por endpoint; se inspeccionan campo a campo.
  data?: any;
  meta?: any;
  errors?: Record<string, string[]>;
}

interface Session {
  accessToken: string;
  refreshToken: string;
  expiresIn: string;
  user: { id: string; role: string; mustChangePassword: boolean; partner: any };
}

let server: Server | undefined;
let origin = "";
let apiBase = "";

const RUN = Date.now().toString(36);

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

async function login(email: string, password: string): Promise<Session> {
  const { status, body } = await api("POST", "/auth/login", {
    body: { email, password },
  });
  assert.equal(status, 200, `login ${email} debía responder 200`);
  return body.data as Session;
}

async function adminSession(): Promise<Session> {
  return login(METACONFIG.superUser.email, METACONFIG.superUser.password);
}

async function partnerSession(): Promise<Session> {
  return login("agencia.test@plataforma.com", "Test1234!");
}

async function firstCategory(code: string): Promise<PartnerCategory> {
  const category = await AppDataSource.getRepository(PartnerCategory).findOne({
    where: { code },
  });
  assert.ok(category, `La categoría ${code} debe existir tras el seed`);
  return category;
}

async function firstRegion(): Promise<Region> {
  const region = await AppDataSource.getRepository(Region).findOne({
    where: { type: "municipality" as Region["type"] },
  });
  assert.ok(region, "Debe existir un municipio tras el seed");
  return region;
}

function registrationBody(
  categoryId: string,
  regionId: string,
  ownerEmail: string
) {
  return {
    categoryId,
    regionId,
    commercialName: `Socio E2E ${RUN}`,
    legalName: "Socio E2E S.A. de C.V.",
    address: "Calle de Prueba 123, Centro",
    contactName: "Contacto E2E",
    contactEmail: ownerEmail,
    contactPhone: "9611234567",
    ownerName: "Owner E2E",
    ownerEmail,
  };
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

describe("Contrato y versionado", () => {
  it("GET /api/v1/openapi.json publica el contrato generado desde Zod", async () => {
    const doc = (await (await fetch(`${apiBase}/openapi.json`)).json()) as any;

    assert.equal(doc.openapi, "3.1.0");
    assert.ok(doc.paths["/auth/login"]);
    assert.ok(doc.paths["/partners"]);
    assert.ok(doc.components.securitySchemes.bearerAuth);
    assert.ok(
      doc.paths["/auth/login"].post.requestBody.content["application/json"]
        .schema
    );
  });

  it("La versión anterior (/api) ya no existe", async () => {
    const response = await fetch(`${origin}/api/auth/login`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({}),
    });

    assert.equal(response.status, 404);
    const body = (await response.json()) as ApiBody;
    assert.equal(body.code, "ROUTE_NOT_FOUND");
  });
});

describe("Autenticación", () => {
  it("login devuelve access + refresh y /auth/me el perfil", async () => {
    const session = await adminSession();
    assert.ok(session.accessToken);
    assert.ok(session.refreshToken);
    assert.equal(session.user.role, RoleCode.SUPER_USER);

    const me = await api("GET", "/auth/me", { token: session.accessToken });
    assert.equal(me.status, 200);
    assert.equal(me.body.data.email, METACONFIG.superUser.email);
  });

  it("credenciales incorrectas → 401 INVALID_CREDENTIALS", async () => {
    const { status, body } = await api("POST", "/auth/login", {
      body: { email: METACONFIG.superUser.email, password: "NoEsLaCorrecta1" },
    });

    assert.equal(status, 401);
    assert.equal(body.code, "INVALID_CREDENTIALS");
  });

  it("datos inválidos → 422 VALIDATION_ERROR con errores por campo", async () => {
    const { status, body } = await api("POST", "/auth/login", {
      body: { email: "no-es-correo", password: "" },
    });

    assert.equal(status, 422);
    assert.equal(body.code, "VALIDATION_ERROR");
    assert.ok(body.errors?.email);
    assert.ok(body.errors?.password);
  });

  it("refresh rota el token y el anterior queda revocado", async () => {
    const session = await partnerSession();

    const renewed = await api("POST", "/auth/refresh", {
      body: { refreshToken: session.refreshToken },
    });
    assert.equal(renewed.status, 200);
    assert.notEqual(renewed.body.data.refreshToken, session.refreshToken);

    const reused = await api("POST", "/auth/refresh", {
      body: { refreshToken: session.refreshToken },
    });
    assert.equal(reused.status, 401);
    assert.equal(reused.body.code, "REFRESH_TOKEN_REVOKED");
  });

  it("logout revoca el refresh token", async () => {
    const session = await partnerSession();

    const logout = await api("POST", "/auth/logout", {
      body: { refreshToken: session.refreshToken },
    });
    assert.equal(logout.status, 200);

    const afterLogout = await api("POST", "/auth/refresh", {
      body: { refreshToken: session.refreshToken },
    });
    assert.equal(afterLogout.status, 401);
  });

  it("mustChangePassword bloquea la operación hasta cambiar la contraseña", async () => {
    const repo = AppDataSource.getRepository(User);
    const role = await AppDataSource.getRepository(Role).findOneByOrFail({
      code: RoleCode.SUPER_USER,
    });

    const user = repo.create({
      roleId: role.id,
      name: "Admin Pendiente",
      email: `pendiente-${RUN}@e2e.local`,
      phone: null,
      passwordHash: await PasswordService.hash("Inicial1234!"),
      status: UserStatus.ACTIVE,
      mustChangePassword: true,
    });
    await repo.save(user);

    const session = await login(`pendiente-${RUN}@e2e.local`, "Inicial1234!");
    assert.equal(session.user.mustChangePassword, true);

    const blocked = await api("GET", "/partners", { token: session.accessToken });
    assert.equal(blocked.status, 403);
    assert.equal(blocked.body.code, "PASSWORD_CHANGE_REQUIRED");

    const changed = await api("POST", "/auth/change-password", {
      token: session.accessToken,
      body: {
        currentPassword: "Inicial1234!",
        newPassword: "Definitiva1234!",
      },
    });
    assert.equal(changed.status, 200);
    assert.equal(changed.body.data.user.mustChangePassword, false);

    const allowed = await api("GET", "/partners", {
      token: changed.body.data.accessToken,
    });
    assert.equal(allowed.status, 200);
  });

  it("cambiar la contraseña invalida el token anterior", async () => {
    const repo = AppDataSource.getRepository(User);
    const role = await AppDataSource.getRepository(Role).findOneByOrFail({
      code: RoleCode.SUPER_USER,
    });

    const email = `rotacion-${RUN}@e2e.local`;
    await repo.save(
      repo.create({
        roleId: role.id,
        name: "Admin Rotación",
        email,
        phone: null,
        passwordHash: await PasswordService.hash("Inicial1234!"),
        status: UserStatus.ACTIVE,
        mustChangePassword: false,
      })
    );

    const session = await login(email, "Inicial1234!");

    const changed = await api("POST", "/auth/change-password", {
      token: session.accessToken,
      body: {
        currentPassword: "Inicial1234!",
        newPassword: "Definitiva1234!",
      },
    });
    assert.equal(changed.status, 200);

    const oldToken = await api("GET", "/auth/me", {
      token: session.accessToken,
    });
    assert.equal(oldToken.status, 401);
    assert.equal(oldToken.body.code, "TOKEN_REVOKED");
  });
});

describe("Regiones", () => {
  it("lista paginada con meta", async () => {
    const { status, body } = await api("GET", "/regions?limit=2&page=1");

    assert.equal(status, 200);
    assert.ok(Array.isArray(body.data));
    assert.equal(body.meta.page, 1);
    assert.equal(body.meta.limit, 2);
    assert.ok(body.meta.total >= 1);
  });

  it("filtro de tipo inválido → 400", async () => {
    const { status, body } = await api("GET", "/regions?type=pais");
    assert.equal(status, 400);
    assert.equal(body.ok, false);
  });

  it("una zona sin municipio padre → 422", async () => {
    const admin = await adminSession();

    const { status } = await api("POST", "/regions", {
      token: admin.accessToken,
      body: {
        stateId: "00000000-0000-4000-8000-000000000000",
        type: "zone",
        name: "Zona Sin Padre",
      },
    });

    assert.equal(status, 422);
  });

  it("crea un municipio con slug automático y 404 en el detalle inexistente", async () => {
    const admin = await adminSession();
    const region = await firstRegion();

    const created = await api("POST", "/regions", {
      token: admin.accessToken,
      body: {
        stateId: region.stateId,
        type: "municipality",
        name: `Municipio E2E ${RUN}`,
      },
    });

    assert.equal(created.status, 201);
    assert.equal(created.body.data.slug, `municipio-e2e-${RUN}`);

    const missing = await api(
      "GET",
      "/regions/00000000-0000-4000-8000-000000000000"
    );
    assert.equal(missing.status, 404);
  });
});

describe("Categorías de socio", () => {
  it("crea, detecta duplicado y da de baja lógica", async () => {
    const admin = await adminSession();
    const code = `tour-operator-${RUN}`;

    const created = await api("POST", "/partner-categories", {
      token: admin.accessToken,
      body: { code, name: "Operador de tours" },
    });
    assert.equal(created.status, 201);
    assert.equal(created.body.data.code, code);

    const duplicate = await api("POST", "/partner-categories", {
      token: admin.accessToken,
      body: { code, name: "Duplicada" },
    });
    assert.equal(duplicate.status, 409);
    assert.equal(duplicate.body.code, "CATEGORY_CODE_TAKEN");

    const removed = await api(
      "DELETE",
      `/partner-categories/${created.body.data.id}`,
      { token: admin.accessToken }
    );
    assert.equal(removed.status, 200);
    assert.equal(removed.body.data.isActive, false);

    const publicList = await api("GET", "/partner-categories");
    assert.ok(
      !publicList.body.data.some((c: { code: string }) => c.code === code)
    );
  });

  it("un socio no puede crear categorías → 403", async () => {
    const partner = await partnerSession();

    const { status } = await api("POST", "/partner-categories", {
      token: partner.accessToken,
      body: { code: "otra-categoria", name: "Otra" },
    });

    assert.equal(status, 403);
  });
});

describe("Socios", () => {
  it("registro público → 201 y correo duplicado → 409", async () => {
    const category = await firstCategory("agency");
    const region = await firstRegion();
    const email = `registro-${RUN}@e2e.local`;

    const created = await api(
      "POST",
      "/partners/register",
      { body: registrationBody(category.id, region.id, email) }
    );
    assert.equal(created.status, 201);
    assert.equal(created.body.data.status, "pending");

    const duplicate = await api("POST", "/partners/register", {
      body: registrationBody(category.id, region.id, email),
    });
    assert.equal(duplicate.status, 409);
    assert.equal(duplicate.body.code, "EMAIL_ALREADY_REGISTERED");
  });

  it("alta del administrador y recategorización", async () => {
    const admin = await adminSession();
    const agency = await firstCategory("agency");
    const hotel = await firstCategory("hotel");
    const region = await firstRegion();
    const email = `alta-${RUN}@e2e.local`;

    const created = await api("POST", "/partners", {
      token: admin.accessToken,
      body: {
        ...registrationBody(agency.id, region.id, email),
        invite: false,
      },
    });
    assert.equal(created.status, 201);

    const recategorized = await api(
      "PATCH",
      `/partners/${created.body.data.partnerId}`,
      { token: admin.accessToken, body: { categoryId: hotel.id } }
    );
    assert.equal(recategorized.status, 200);
    assert.equal(recategorized.body.data.categoryId, hotel.id);

    const invalid = await api(
      "PATCH",
      `/partners/${created.body.data.partnerId}`,
      {
        token: admin.accessToken,
        body: { categoryId: "00000000-0000-4000-8000-000000000000" },
      }
    );
    assert.equal(invalid.status, 404);
    assert.equal(invalid.body.code, "CATEGORY_NOT_AVAILABLE");
  });

  it("un socio no puede recategorizarse a sí mismo → 403", async () => {
    const partner = await partnerSession();
    const hotel = await firstCategory("hotel");

    const { status, body } = await api(
      "PATCH",
      `/partners/${partner.user.partner.id}`,
      { token: partner.accessToken, body: { categoryId: hotel.id } }
    );

    assert.equal(status, 403);
    assert.equal(body.code, "ADMIN_ONLY_FIELDS");
  });

  it("un socio no ve el listado global ni el detalle de otro socio", async () => {
    const partner = await partnerSession();
    const admin = await adminSession();

    const list = await api("GET", "/partners", {
      token: partner.accessToken,
    });
    assert.equal(list.status, 403);

    const others = await AppDataSource.getRepository(Partner).find({
      take: 5,
    });
    const other = others.find((p) => p.id !== partner.user.partner.id);
    assert.ok(other, "Debe existir otro socio en la base de test");

    const detail = await api("GET", `/partners/${other.id}`, {
      token: partner.accessToken,
    });
    assert.equal(detail.status, 403);

    const own = await api("GET", `/partners/${partner.user.partner.id}`, {
      token: admin.accessToken,
    });
    assert.equal(own.status, 200);
  });

  it("aprobar envía el correo de activación (transporte falso)", async () => {
    const admin = await adminSession();
    const category = await firstCategory("agency");
    const region = await firstRegion();
    const email = `aprobacion-${RUN}@e2e.local`;

    const created = await api("POST", "/partners", {
      token: admin.accessToken,
      body: registrationBody(category.id, region.id, email),
    });
    assert.equal(created.status, 201);

    MailService.clearCapturedMails();

    const approved = await api(
      "PATCH",
      `/partners/${created.body.data.partnerId}/approve`,
      { token: admin.accessToken }
    );
    assert.equal(approved.status, 200);

    const mails = MailService.capturedMails();
    assert.equal(mails.length, 1);
    assert.equal(mails[0]?.to, email);
    assert.ok(mails[0]?.html.includes("token="));
  });

  it("suspender corta el acceso del socio en la siguiente petición", async () => {
    const admin = await adminSession();
    const partner = await partnerSession();
    const partnerId = partner.user.partner.id;

    const suspended = await api("PATCH", `/partners/${partnerId}/suspend`, {
      token: admin.accessToken,
      body: { reason: "Suspensión temporal de prueba automatizada" },
    });
    assert.equal(suspended.status, 200);

    const blocked = await api("GET", `/partners/${partnerId}`, {
      token: partner.accessToken,
    });
    assert.equal(blocked.status, 403);
    assert.equal(blocked.body.code, "PARTNER_INACTIVE");

    const reactivated = await api(
      "PATCH",
      `/partners/${partnerId}/reactivate`,
      { token: admin.accessToken }
    );
    assert.equal(reactivated.status, 200);

    const allowed = await api("GET", `/partners/${partnerId}`, {
      token: partner.accessToken,
    });
    assert.equal(allowed.status, 200);
  });

  it("listado paginado con meta coherente", async () => {
    const admin = await adminSession();

    const { status, body } = await api("GET", "/partners?limit=1&page=1", {
      token: admin.accessToken,
    });

    assert.equal(status, 200);
    assert.equal(body.meta.limit, 1);
    assert.equal(body.data.length, 1);
  });
});

describe("Credenciales de servicio", () => {
  it("emite token, valida scopes y separa usuarios de servicios", async () => {
    const issued = await api("POST", "/auth/service-token", {
      body: {
        clientId: "test-service-client",
        secret: "test-service-secret-1234",
      },
    });
    assert.equal(issued.status, 200);
    assert.deepEqual(issued.body.data.scopes, ["catalog:read", "quote:write"]);

    const serviceToken = issued.body.data.accessToken as string;

    const whoami = await api("GET", "/service/whoami", { token: serviceToken });
    assert.equal(whoami.status, 200);
    assert.equal(whoami.body.data.clientId, "test-service-client");

    const wrongSecret = await api("POST", "/auth/service-token", {
      body: {
        clientId: "test-service-client",
        secret: "secreto-incorrecto",
      },
    });
    assert.equal(wrongSecret.status, 401);
    assert.equal(wrongSecret.body.code, "INVALID_SERVICE_CREDENTIALS");

    const admin = await adminSession();

    const userOnService = await api("GET", "/service/whoami", {
      token: admin.accessToken,
    });
    assert.equal(userOnService.status, 403);
    assert.equal(userOnService.body.code, "SERVICE_TOKEN_REQUIRED");

    const serviceOnUser = await api("GET", "/auth/me", {
      token: serviceToken,
    });
    assert.equal(serviceOnUser.status, 403);
    assert.equal(serviceOnUser.body.code, "USER_TOKEN_REQUIRED");
  });
});

/** Crea un socio con su owner activo para probar permisos por categoría. */
async function createPartnerWithOwner(params: {
  categoryCode: string;
  partnerName: string;
  email: string;
}): Promise<{ email: string; password: string; partnerId: string }> {
  const category = await firstCategory(params.categoryCode);
  const region = await firstRegion();
  const role = await AppDataSource.getRepository(Role).findOneByOrFail({
    code: RoleCode.PARTNER,
  });
  const password = "Partner1234!";

  const partnerRepo = AppDataSource.getRepository(Partner);
  const partner = await partnerRepo.save(
    partnerRepo.create({
      categoryId: category.id,
      regionId: region.id,
      commercialName: params.partnerName,
      legalName: `${params.partnerName} S.A. de C.V.`,
      slug: `e2e-${params.categoryCode}-${RUN}-${Math.random()
        .toString(36)
        .slice(2, 6)}`,
      description: null,
      address: "Calle de Prueba 456, Centro",
      lat: null,
      lng: null,
      contactName: "Contacto E2E",
      contactEmail: params.email,
      contactPhone: "9611234567",
      status: PartnerStatus.ACTIVE,
      statusReason: null,
      approvedAt: new Date(),
    })
  );

  const userRepo = AppDataSource.getRepository(User);
  const user = await userRepo.save(
    userRepo.create({
      roleId: role.id,
      name: "Owner E2E",
      email: params.email,
      phone: null,
      passwordHash: await PasswordService.hash(password),
      status: UserStatus.ACTIVE,
      mustChangePassword: false,
    })
  );

  const linkRepo = AppDataSource.getRepository(PartnerUser);
  await linkRepo.save(
    linkRepo.create({
      partnerId: partner.id,
      userId: user.id,
      role: PartnerUserRole.OWNER,
      isActive: true,
    })
  );

  return { email: params.email, password, partnerId: partner.id };
}

const packageBaseBody = (regionId: string, name: string) => ({
  destinationRegionId: regionId,
  name,
  summary: "Paquete de prueba con hospedaje, traslados y tour guiado.",
  description:
    "Paquete generado por la suite automatizada para validar el catálogo público y las reglas de publicación.",
  nights: 2,
  cancellationPolicy:
    "Cancelación gratuita hasta 7 días antes de la salida. Después aplica penalización.",
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
});

function futureDate(daysFromNow: number): string {
  return new Date(Date.now() + daysFromNow * 86400000)
    .toISOString()
    .slice(0, 10);
}

async function createPublishedPackage(
  token: string,
  label: string
): Promise<{ packageId: string; departureId: string }> {
  const region = await firstRegion();
  const name = `Paquete ${label} ${RUN}`;

  const created = await api("POST", "/packages", {
    token,
    body: packageBaseBody(region.id, name),
  });
  assert.equal(created.status, 201, "el paquete debía crearse");
  const packageId = created.body.data.id as string;

  const departure = await api("POST", `/packages/${packageId}/departures`, {
    token,
    body: {
      departureDate: futureDate(30),
      totalSeats: 10,
      adultPrice: 4500,
      childPrice: 2800,
    },
  });
  assert.equal(departure.status, 201, "la salida debía crearse");
  const departureId = departure.body.data.id as string;

  const published = await api("PATCH", `/packages/${packageId}/status`, {
    token,
    body: { status: "published" },
  });
  assert.equal(published.status, 200, "el paquete debía publicarse");

  return { packageId, departureId };
}

describe("Paquetes", () => {
  it("la agencia crea un borrador, no puede publicarlo incompleto y luego lo publica", async () => {
    const agency = await partnerSession();
    const region = await firstRegion();
    const name = `Escapada E2E ${RUN}`;

    const created = await api("POST", "/packages", {
      token: agency.accessToken,
      body: packageBaseBody(region.id, name),
    });

    assert.equal(created.status, 201);
    assert.equal(created.body.data.status, "draft");
    assert.equal(created.body.data.days, 3);
    const packageId = created.body.data.id as string;

    const incomplete = await api("PATCH", `/packages/${packageId}/status`, {
      token: agency.accessToken,
      body: { status: "published" },
    });
    assert.equal(incomplete.status, 422);
    assert.ok(incomplete.body.errors?.departures);

    const departureDate = futureDate(30);
    const departure = await api("POST", `/packages/${packageId}/departures`, {
      token: agency.accessToken,
      body: { departureDate, totalSeats: 10, adultPrice: 4500 },
    });
    assert.equal(departure.status, 201);
    assert.equal(departure.body.data.availableSeats, 10);

    const duplicated = await api(
      "POST",
      `/packages/${packageId}/departures`,
      {
        token: agency.accessToken,
        body: { departureDate, totalSeats: 5, adultPrice: 4000 },
      }
    );
    assert.equal(duplicated.status, 409);
    assert.equal(duplicated.body.code, "DEPARTURE_DATE_TAKEN");

    const published = await api("PATCH", `/packages/${packageId}/status`, {
      token: agency.accessToken,
      body: { status: "published" },
    });
    assert.equal(published.status, 200);
    assert.equal(published.body.data.status, "published");
    assert.equal(Number(published.body.data.minPriceAdult), 4500);

    const catalog = await api(
      "GET",
      `/packages?search=${encodeURIComponent(name)}`
    );
    assert.equal(catalog.status, 200);
    assert.ok(
      catalog.body.data.some((item: { id: string }) => item.id === packageId)
    );

    const detail = await api("GET", `/packages/${packageId}`);
    assert.equal(detail.status, 200);
    assert.equal(detail.body.data.items.length, 1);
    assert.equal(detail.body.data.itinerary.length, 1);
    assert.equal(detail.body.data.departures.length, 1);
    assert.equal(detail.body.data.taxesIncluded, true);
  });

  it("un borrador no se ve por id anónimo y otro socio no puede editarlo", async () => {
    const agency = await partnerSession();
    const region = await firstRegion();

    const created = await api("POST", "/packages", {
      token: agency.accessToken,
      body: packageBaseBody(region.id, `Borrador E2E ${RUN}`),
    });
    assert.equal(created.status, 201);
    const packageId = created.body.data.id as string;

    const anonymous = await api("GET", `/packages/${packageId}`);
    assert.equal(anonymous.status, 404);
    assert.equal(anonymous.body.code, "PACKAGE_NOT_FOUND");

    const owner = await api("GET", `/packages/${packageId}`, {
      token: agency.accessToken,
    });
    assert.equal(owner.status, 200);

    const rival = await createPartnerWithOwner({
      categoryCode: "agency",
      partnerName: `Agencia Rival ${RUN}`,
      email: `rival-${RUN}@e2e.local`,
    });
    const rivalSession = await login(rival.email, rival.password);

    const forbidden = await api("PATCH", `/packages/${packageId}`, {
      token: rivalSession.accessToken,
      body: { summary: "Intento de edición de un paquete ajeno." },
    });
    assert.equal(forbidden.status, 403);
    assert.equal(forbidden.body.code, "PACKAGE_ACCESS_DENIED");
  });

  it("un hotel no puede crear paquetes → 403 PARTNER_NOT_AGENCY", async () => {
    const hotel = await createPartnerWithOwner({
      categoryCode: "hotel",
      partnerName: `Hotel E2E ${RUN}`,
      email: `hotel-${RUN}@e2e.local`,
    });
    const session = await login(hotel.email, hotel.password);
    const region = await firstRegion();

    const response = await api("POST", "/packages", {
      token: session.accessToken,
      body: packageBaseBody(region.id, `Paquete de Hotel ${RUN}`),
    });

    assert.equal(response.status, 403);
    assert.equal(response.body.code, "PARTNER_NOT_AGENCY");
  });

  it("cerrar una salida la quita del detalle público", async () => {
    const agency = await partnerSession();
    const { packageId, departureId } = await createPublishedPackage(
      agency.accessToken,
      "Cierre de salida"
    );

    const closed = await api(
      "PATCH",
      `/packages/${packageId}/departures/${departureId}`,
      { token: agency.accessToken, body: { status: "closed" } }
    );
    assert.equal(closed.status, 200);

    const detail = await api("GET", `/packages/${packageId}`);
    assert.equal(detail.body.data.departures.length, 0);

    const ownerDetail = await api("GET", `/packages/${packageId}`, {
      token: agency.accessToken,
    });
    assert.equal(ownerDetail.body.data.departures.length, 1);
  });
});

describe("Hoteles", () => {
  let hotelSession: Session;
  let hotelPartnerId = "";
  let roomTypeId = "";
  const checkIn = futureDate(10);
  const checkOut = futureDate(13);

  before(async () => {
    const hotel = await createPartnerWithOwner({
      categoryCode: "hotel",
      partnerName: `Hotel Inventario ${RUN}`,
      email: `hotel-inv-${RUN}@e2e.local`,
    });
    hotelPartnerId = hotel.partnerId;
    hotelSession = await login(hotel.email, hotel.password);

    const created = await api("POST", "/hotels/room-types", {
      token: hotelSession.accessToken,
      body: {
        name: "Doble con vista al mar",
        description: "Habitación con balcón y desayuno incluido.",
        maxAdults: 2,
        maxChildren: 1,
        totalUnits: 5,
        basePrice: 1200,
        amenities: ["wifi", "desayuno"],
      },
    });

    assert.equal(created.status, 201);
    roomTypeId = created.body.data.id as string;
  });

  it("una agencia no puede crear habitaciones → 403 PARTNER_NOT_HOTEL", async () => {
    const agency = await partnerSession();

    const response = await api("POST", "/hotels/room-types", {
      token: agency.accessToken,
      body: { name: "Suite intento", basePrice: 900 },
    });

    assert.equal(response.status, 403);
    assert.equal(response.body.code, "PARTNER_NOT_HOTEL");
  });

  it("el catálogo público muestra la habitación y filtra por huéspedes", async () => {
    const list = await api(
      "GET",
      `/hotels/room-types?partnerId=${hotelPartnerId}&guests=2`
    );

    assert.equal(list.status, 200);
    const item = list.body.data.find(
      (roomType: { id: string }) => roomType.id === roomTypeId
    );
    assert.ok(item);
    assert.equal(item.basePrice, 1200);
    assert.deepEqual(item.amenities, ["wifi", "desayuno"]);

    const tooManyGuests = await api(
      "GET",
      `/hotels/room-types?partnerId=${hotelPartnerId}&guests=9`
    );
    assert.ok(
      !tooManyGuests.body.data.some(
        (roomType: { id: string }) => roomType.id === roomTypeId
      )
    );
  });

  it("carga inventario por rango, lo actualiza y lo devuelve ordenado", async () => {
    const first = await api(
      "PUT",
      `/hotels/room-types/${roomTypeId}/inventory`,
      {
        token: hotelSession.accessToken,
        body: { from: checkIn, to: checkOut, units: 3, price: 1500 },
      }
    );

    assert.equal(first.status, 200);
    assert.equal(first.body.data.created, 4);

    const second = await api(
      "PUT",
      `/hotels/room-types/${roomTypeId}/inventory`,
      {
        token: hotelSession.accessToken,
        body: { from: checkIn, to: checkOut, price: 1500 },
      }
    );
    assert.equal(second.status, 200);
    assert.equal(second.body.data.updated, 4);

    const inventory = await api(
      "GET",
      `/hotels/room-types/${roomTypeId}/inventory?from=${checkIn}&to=${checkOut}`,
      { token: hotelSession.accessToken }
    );
    assert.equal(inventory.status, 200);
    assert.equal(inventory.body.data.length, 4);
    assert.equal(inventory.body.data[0].date, checkIn);
    assert.equal(inventory.body.data[0].price, 1500);
    assert.equal(inventory.body.data[0].units, 3);
  });

  it("la disponibilidad calcula el total de la estancia y respeta la capacidad", async () => {
    const availability = await api(
      "GET",
      `/hotels/availability?checkIn=${checkIn}&checkOut=${checkOut}&partnerId=${hotelPartnerId}&adults=2&children=1`
    );

    assert.equal(availability.status, 200);
    const item = availability.body.data.find(
      (a: { roomTypeId: string }) => a.roomTypeId === roomTypeId
    );
    assert.ok(item, "la habitación debía aparecer disponible");
    assert.equal(item.nights, 3);
    assert.equal(item.totalPrice, 4500);
    assert.equal(item.nightly.length, 3);

    const overCapacity = await api(
      "GET",
      `/hotels/availability?checkIn=${checkIn}&checkOut=${checkOut}&partnerId=${hotelPartnerId}&adults=3&children=0`
    );
    assert.ok(
      !overCapacity.body.data.some(
        (a: { roomTypeId: string }) => a.roomTypeId === roomTypeId
      ),
      "no debe aparecer si supera la capacidad"
    );
  });

  it("el cierre rápido oculta la fecha y reabrirla la devuelve", async () => {
    const close = await api(
      "PUT",
      `/hotels/room-types/${roomTypeId}/inventory`,
      {
        token: hotelSession.accessToken,
        body: { from: checkIn, to: checkIn, isClosed: true },
      }
    );
    assert.equal(close.status, 200);

    const availabilityUrl = `/hotels/availability?checkIn=${checkIn}&checkOut=${checkOut}&partnerId=${hotelPartnerId}&adults=1&children=0`;

    const closed = await api("GET", availabilityUrl);
    assert.ok(
      !closed.body.data.some(
        (a: { roomTypeId: string }) => a.roomTypeId === roomTypeId
      ),
      "una fecha cerrada no debe ofrecerse"
    );

    await api("PUT", `/hotels/room-types/${roomTypeId}/inventory`, {
      token: hotelSession.accessToken,
      body: { from: checkIn, to: checkIn, isClosed: false },
    });

    const reopened = await api("GET", availabilityUrl);
    assert.ok(
      reopened.body.data.some(
        (a: { roomTypeId: string }) => a.roomTypeId === roomTypeId
      )
    );
  });

  it("otro hotel no puede modificar la habitación ajena → 403", async () => {
    const other = await createPartnerWithOwner({
      categoryCode: "hotel",
      partnerName: `Hotel Ajeno ${RUN}`,
      email: `hotel-ajeno-${RUN}@e2e.local`,
    });
    const otherSession = await login(other.email, other.password);

    const forbidden = await api(
      "PATCH",
      `/hotels/room-types/${roomTypeId}`,
      { token: otherSession.accessToken, body: { basePrice: 100 } }
    );

    assert.equal(forbidden.status, 403);
    assert.equal(forbidden.body.code, "ROOM_TYPE_ACCESS_DENIED");
  });

  it("fechas inválidas en disponibilidad → 400 INVALID_DATE_RANGE", async () => {
    const response = await api(
      "GET",
      `/hotels/availability?checkIn=${checkOut}&checkOut=${checkIn}`
    );

    assert.equal(response.status, 400);
    assert.equal(response.body.code, "INVALID_DATE_RANGE");
  });
});

describe("Experiencias", () => {
  let attractionSession: Session;
  let attractionPartnerId = "";
  let experienceId = "";
  const slotDate = futureDate(5);

  before(async () => {
    const attraction = await createPartnerWithOwner({
      categoryCode: "attraction",
      partnerName: `Atractivos E2E ${RUN}`,
      email: `atractivo-${RUN}@e2e.local`,
    });
    attractionPartnerId = attraction.partnerId;
    attractionSession = await login(attraction.email, attraction.password);

    const region = await firstRegion();
    const created = await api("POST", "/experiences", {
      token: attractionSession.accessToken,
      body: {
        regionId: region.id,
        name: `Ruta del Cacao ${RUN}`,
        description:
          "Recorrido guiado por una hacienda cacaotera con degustación al final del tour.",
        durationMinutes: 180,
        minAge: 6,
        priceAdult: 850,
        priceChild: 450,
        requirements: "Calzado cómodo y bloqueador biodegradable.",
      },
    });

    assert.equal(created.status, 201);
    experienceId = created.body.data.id as string;
  });

  it("un hotel no puede crear experiencias → 403 PARTNER_NOT_ATTRACTION", async () => {
    const hotel = await createPartnerWithOwner({
      categoryCode: "hotel",
      partnerName: `Hotel Intruso ${RUN}`,
      email: `hotel-intruso-${RUN}@e2e.local`,
    });
    const hotelSession = await login(hotel.email, hotel.password);
    const region = await firstRegion();

    const response = await api("POST", "/experiences", {
      token: hotelSession.accessToken,
      body: {
        regionId: region.id,
        name: "Experiencia intrusa",
        description: "Intento de creación de una experiencia por un hotel.",
        durationMinutes: 60,
        priceAdult: 100,
      },
    });

    assert.equal(response.status, 403);
    assert.equal(response.body.code, "PARTNER_NOT_ATTRACTION");
  });

  it("crea turnos, rechaza duplicados y fechas pasadas", async () => {
    const created = await api(
      "POST",
      `/experiences/${experienceId}/slots`,
      {
        token: attractionSession.accessToken,
        body: { date: slotDate, startTime: "09:00", capacity: 4 },
      }
    );
    assert.equal(created.status, 201);
    assert.equal(created.body.data.remaining, 4);

    const duplicated = await api(
      "POST",
      `/experiences/${experienceId}/slots`,
      {
        token: attractionSession.accessToken,
        body: { date: slotDate, startTime: "09:00", capacity: 6 },
      }
    );
    assert.equal(duplicated.status, 409);
    assert.equal(duplicated.body.code, "SLOT_TAKEN");

    const past = await api("POST", `/experiences/${experienceId}/slots`, {
      token: attractionSession.accessToken,
      body: { date: futureDate(-3), startTime: "10:00", capacity: 4 },
    });
    assert.equal(past.status, 400);
    assert.equal(past.body.code, "SLOT_DATE_PAST");
  });

  it("el catálogo y el detalle muestran la experiencia y sus turnos", async () => {
    const list = await api(
      "GET",
      `/experiences?partnerId=${attractionPartnerId}`
    );
    assert.equal(list.status, 200);
    assert.ok(
      list.body.data.some(
        (experience: { id: string }) => experience.id === experienceId
      )
    );

    const detail = await api("GET", `/experiences/${experienceId}`);
    assert.equal(detail.status, 200);
    assert.equal(detail.body.data.priceAdult, 850);
    assert.equal(detail.body.data.slots.length, 1);
    assert.equal(detail.body.data.slots[0].startTime, "09:00");
  });

  it("la disponibilidad respeta el cupo y el cierre de turno", async () => {
    const availableUrl = `/experiences/availability?date=${slotDate}&partnerId=${attractionPartnerId}&people=3`;

    const available = await api("GET", availableUrl);
    assert.equal(available.status, 200);
    const item = available.body.data.find(
      (entry: { experienceId: string }) => entry.experienceId === experienceId
    );
    assert.ok(item, "el turno debía aparecer con cupo para 3 personas");
    assert.equal(item.remaining, 4);
    assert.equal(item.priceAdult, 850);

    const tooMany = await api(
      "GET",
      `/experiences/availability?date=${slotDate}&partnerId=${attractionPartnerId}&people=5`
    );
    assert.ok(
      !tooMany.body.data.some(
        (entry: { experienceId: string }) => entry.experienceId === experienceId
      ),
      "no debe ofrecerse si el grupo supera el aforo restante"
    );

    const closed = await api(
      "PATCH",
      `/experiences/${experienceId}/slots/${item.slotId}`,
      { token: attractionSession.accessToken, body: { status: "closed" } }
    );
    assert.equal(closed.status, 200);

    const afterClose = await api("GET", availableUrl);
    assert.ok(
      !afterClose.body.data.some(
        (entry: { experienceId: string }) => entry.experienceId === experienceId
      ),
      "un turno cerrado no debe ofrecerse"
    );

    await api(
      "PATCH",
      `/experiences/${experienceId}/slots/${item.slotId}`,
      { token: attractionSession.accessToken, body: { status: "open" } }
    );
  });

  it("no se puede bajar el aforo por debajo de lo reservado", async () => {
    const slotRepo = AppDataSource.getRepository(ExperienceSlot);
    const slot = await slotRepo.findOne({ where: { experienceId } });
    assert.ok(slot, "el turno debía existir");

    await slotRepo.update({ id: slot.id }, { booked: 3 });

    const response = await api(
      "PATCH",
      `/experiences/${experienceId}/slots/${slot.id}`,
      { token: attractionSession.accessToken, body: { capacity: 2 } }
    );

    assert.equal(response.status, 400);
    assert.equal(response.body.code, "CAPACITY_BELOW_BOOKED");
  });

  it("otro operador no puede editar la experiencia ajena → 403", async () => {
    const other = await createPartnerWithOwner({
      categoryCode: "attraction",
      partnerName: `Atractivos Ajenos ${RUN}`,
      email: `atractivo-ajeno-${RUN}@e2e.local`,
    });
    const otherSession = await login(other.email, other.password);

    const forbidden = await api("PATCH", `/experiences/${experienceId}`, {
      token: otherSession.accessToken,
      body: { priceAdult: 1 },
    });

    assert.equal(forbidden.status, 403);
    assert.equal(forbidden.body.code, "EXPERIENCE_ACCESS_DENIED");
  });
});

describe("Cotizaciones", () => {
  let serviceToken = "";
  let packageDepartureId = "";
  let roomTypeId = "";
  let slotId = "";
  const checkIn = futureDate(20);
  const checkOut = futureDate(22);

  before(async () => {
    const issued = await api("POST", "/auth/service-token", {
      body: {
        clientId: "test-service-client",
        secret: "test-service-secret-1234",
      },
    });
    assert.equal(issued.status, 200);
    serviceToken = issued.body.data.accessToken as string;

    // Paquete con promoción del 10%
    const agency = await partnerSession();
    const region = await firstRegion();

    const pkg = await api("POST", "/packages", {
      token: agency.accessToken,
      body: {
        ...packageBaseBody(region.id, `Paquete Promo ${RUN}`),
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
    assert.equal(pkg.status, 201);

    const departure = await api(
      "POST",
      `/packages/${pkg.body.data.id}/departures`,
      {
        token: agency.accessToken,
        body: {
          departureDate: futureDate(30),
          totalSeats: 10,
          adultPrice: 4500,
          childPrice: 2800,
        },
      }
    );
    assert.equal(departure.status, 201);
    packageDepartureId = departure.body.data.id as string;

    const published = await api(
      "PATCH",
      `/packages/${pkg.body.data.id}/status`,
      { token: agency.accessToken, body: { status: "published" } }
    );
    assert.equal(published.status, 200);

    // Hotel con inventario tarifado
    const hotel = await createPartnerWithOwner({
      categoryCode: "hotel",
      partnerName: `Hotel Cotiza ${RUN}`,
      email: `hotel-cotiza-${RUN}@e2e.local`,
    });
    const hotelSession = await login(hotel.email, hotel.password);
    const roomType = await api("POST", "/hotels/room-types", {
      token: hotelSession.accessToken,
      body: {
        name: "Doble estándar",
        maxAdults: 2,
        maxChildren: 1,
        totalUnits: 4,
        basePrice: 1200,
      },
    });
    assert.equal(roomType.status, 201);
    roomTypeId = roomType.body.data.id as string;

    const inventory = await api(
      "PUT",
      `/hotels/room-types/${roomTypeId}/inventory`,
      {
        token: hotelSession.accessToken,
        body: { from: checkIn, to: checkOut, units: 3, price: 1500 },
      }
    );
    assert.equal(inventory.status, 200);

    // Atractivo con turno
    const attraction = await createPartnerWithOwner({
      categoryCode: "attraction",
      partnerName: `Atractivos Cotiza ${RUN}`,
      email: `atractivo-cotiza-${RUN}@e2e.local`,
    });
    const attractionSession = await login(attraction.email, attraction.password);
    const experience = await api("POST", "/experiences", {
      token: attractionSession.accessToken,
      body: {
        regionId: region.id,
        name: `Cenote Sagrado ${RUN}`,
        description:
          "Nado en cenote con guía certificado y equipo de snorkel incluido.",
        durationMinutes: 120,
        priceAdult: 850,
        priceChild: 450,
      },
    });
    assert.equal(experience.status, 201);
    const experienceId = experience.body.data.id as string;

    const slot = await api(
      "POST",
      `/experiences/${experienceId}/slots`,
      {
        token: attractionSession.accessToken,
        body: { date: futureDate(6), startTime: "09:00", capacity: 4 },
      }
    );
    assert.equal(slot.status, 201);
    slotId = slot.body.data.id as string;
  });

  it("cotiza paquete, estancia y turno en un solo desglose", async () => {
    const quote = await api("POST", "/quotes", {
      token: serviceToken,
      body: {
        items: [
          {
            type: "package_departure",
            departureId: packageDepartureId,
            adults: 2,
            children: 0,
          },
          { type: "room_stay", roomTypeId, checkIn, checkOut, adults: 2, children: 1 },
          { type: "experience_slot", slotId, adults: 2, children: 0 },
        ],
      },
    });

    assert.equal(quote.status, 201);
    assert.equal(quote.body.data.items.length, 3);
    assert.equal(quote.body.data.subtotal, 13700);
    assert.equal(quote.body.data.discountTotal, 900);
    assert.equal(quote.body.data.taxesTotal, 0);
    assert.equal(quote.body.data.total, 12800);
    assert.ok(quote.body.data.reference.startsWith("QT-"));

    const fetched = await api("GET", `/quotes/${quote.body.data.quoteId}`, {
      token: serviceToken,
    });
    assert.equal(fetched.status, 200);
    assert.equal(fetched.body.data.total, 12800);
  });

  it("una cotización vencida responde 410 QUOTE_EXPIRED", async () => {
    const quote = await api("POST", "/quotes", {
      token: serviceToken,
      body: {
        items: [{ type: "experience_slot", slotId, adults: 1, children: 0 }],
      },
    });
    assert.equal(quote.status, 201);

    await AppDataSource.getRepository(Quote).update(
      { id: quote.body.data.quoteId },
      { expiresAt: new Date(Date.now() - 60_000) }
    );

    const expired = await api("GET", `/quotes/${quote.body.data.quoteId}`, {
      token: serviceToken,
    });
    assert.equal(expired.status, 410);
    assert.equal(expired.body.code, "QUOTE_EXPIRED");
  });

  it("exige credencial de servicio, no token de usuario", async () => {
    const body = {
      items: [{ type: "experience_slot", slotId, adults: 1 }],
    };

    const anonymous = await api("POST", "/quotes", { body });
    assert.equal(anonymous.status, 401);

    const admin = await adminSession();
    const withUserToken = await api("POST", "/quotes", {
      token: admin.accessToken,
      body,
    });
    assert.equal(withUserToken.status, 403);
    assert.equal(withUserToken.body.code, "SERVICE_TOKEN_REQUIRED");
  });

  it("rechaza cupo insuficiente, capacidad de habitación y salidas inexistentes", async () => {
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

    const missingDeparture = await api("POST", "/quotes", {
      token: serviceToken,
      body: {
        items: [
          {
            type: "package_departure",
            departureId: "00000000-0000-4000-8000-000000000000",
            adults: 1,
          },
        ],
      },
    });
    assert.equal(missingDeparture.status, 404);
    assert.equal(missingDeparture.body.code, "DEPARTURE_NOT_FOUND");
  });

  it("una cotización vacía → 422", async () => {
    const response = await api("POST", "/quotes", {
      token: serviceToken,
      body: { items: [] },
    });

    assert.equal(response.status, 422);
    assert.equal(response.body.code, "VALIDATION_ERROR");
  });
});

describe("Datos de demostración y campos nuevos", () => {
  it("el login del socio trae categoryId y categoryCode", async () => {
    const agency = await partnerSession();

    assert.ok(agency.user.partner.categoryId);
    assert.equal(agency.user.partner.categoryCode, "agency");
  });

  it("los proveedores de demostración existen y pueden iniciar sesión", async () => {
    const hotel = await login("hotel.demo@plataforma.com", "Hotel1234!");
    assert.equal(hotel.user.partner.categoryCode, "hotel");
    assert.ok(hotel.user.partner.logoUrl);

    const attraction = await login(
      "atractivo.demo@plataforma.com",
      "Atractivo1234!"
    );
    assert.equal(attraction.user.partner.categoryCode, "attraction");
  });

  it("el admin ve categoryName y regionName en el listado de socios", async () => {
    const admin = await adminSession();

    const list = await api("GET", "/partners?limit=1", {
      token: admin.accessToken,
    });

    assert.equal(list.status, 200);
    const first = list.body.data[0];
    assert.ok(first.categoryName, "debe traer el nombre de la categoría");
    assert.ok(first.regionName, "debe traer el nombre de la región");
    assert.ok("logoUrl" in first);
  });

  it("el catálogo de demostración tiene habitaciones con inventario", async () => {
    const hotel = await login("hotel.demo@plataforma.com", "Hotel1234!");
    const catalog = await api(
      "GET",
      `/hotels/room-types?limit=50&partnerId=${hotel.user.partner.id}`
    );

    assert.equal(catalog.status, 200);
    const demoRoom = catalog.body.data.find(
      (room: { name: string }) => room.name === "Doble estándar"
    );
    assert.ok(demoRoom, "debe existir la habitación de demostración");
    assert.ok(demoRoom.images.length > 0);
    assert.equal(demoRoom.basePrice, 1500);
  });

  it("la disponibilidad del hotel demo devuelve noches y total", async () => {
    const hotel = await login("hotel.demo@plataforma.com", "Hotel1234!");
    const checkIn = futureDate(3);
    const checkOut = futureDate(5);

    const availability = await api(
      "GET",
      `/hotels/availability?checkIn=${checkIn}&checkOut=${checkOut}&adults=2&children=0&partnerId=${hotel.user.partner.id}`
    );

    assert.equal(availability.status, 200);
    const demo = availability.body.data.find(
      (item: { roomTypeName: string }) => item.roomTypeName === "Doble estándar"
    );
    assert.ok(demo, "la habitación demo debe estar disponible");
    assert.equal(demo.nights, 2);
    assert.equal(demo.totalPrice, 3000);
  });

  it("la experiencia demo tiene turnos disponibles", async () => {
    const attraction = await login(
      "atractivo.demo@plataforma.com",
      "Atractivo1234!"
    );
    const date = futureDate(3);
    const availability = await api(
      "GET",
      `/experiences/availability?date=${date}&people=2&partnerId=${attraction.user.partner.id}`
    );

    assert.equal(availability.status, 200);
    const demo = availability.body.data.find(
      (item: { experienceName: string }) => item.experienceName === "Ruta del Cacao"
    );
    assert.ok(demo, "la experiencia demo debe ofrecer turnos");
    assert.equal(demo.priceAdult, 850);
  });

  it("paquetes, habitaciones y experiencias aceptan y devuelven imágenes", async () => {
    const agency = await partnerSession();
    const region = await firstRegion();
    const image = "https://picsum.photos/seed/e2e-media/1200/800";

    const pkg = await api("POST", "/packages", {
      token: agency.accessToken,
      body: { ...packageBaseBody(region.id, `Paquete Media ${RUN}`), images: [image] },
    });
    assert.equal(pkg.status, 201);
    assert.deepEqual(pkg.body.data.images, [image]);

    const hotel = await login("hotel.demo@plataforma.com", "Hotel1234!");
    const room = await api("POST", "/hotels/room-types", {
      token: hotel.accessToken,
      body: {
        name: `Habitación media ${RUN}`,
        maxAdults: 2,
        maxChildren: 0,
        totalUnits: 2,
        basePrice: 900,
        images: [image],
      },
    });
    assert.equal(room.status, 201);
    assert.deepEqual(room.body.data.images, [image]);

    const attraction = await login(
      "atractivo.demo@plataforma.com",
      "Atractivo1234!"
    );
    const experience = await api("POST", "/experiences", {
      token: attraction.accessToken,
      body: {
        regionId: region.id,
        name: `Experiencia media ${RUN}`,
        description: "Experiencia creada para validar el campo de imágenes.",
        durationMinutes: 60,
        priceAdult: 300,
        images: [image],
      },
    });
    assert.equal(experience.status, 201);
    assert.deepEqual(experience.body.data.images, [image]);
  });
});
