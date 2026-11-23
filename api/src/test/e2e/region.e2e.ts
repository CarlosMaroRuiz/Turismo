import { after, before, describe, it } from "node:test";
import assert from "node:assert/strict";
import { In } from "typeorm";
import { AppDataSource } from "../../core/bd/index.js";
import { Region } from "../../core/bd/entities/Region.entity.js";
import { State } from "../../core/bd/entities/State.entity.js";
import { METACONFIG } from "../../core/metaconfig/index.js";
import { apiRequest } from "./helpers/api-client.js";

interface LoginData {
  accessToken: string;
  user: {
    id: string;
    email: string;
    role: string;
  };
}

interface StateData {
  id: string;
  code: string;
  name: string;
  slug: string;
  aliases: string[];
  isActive: boolean;
}

interface RegionData {
  id: string;
  stateId: string;
  stateName: string | null;
  parentId: string | null;
  parentName: string | null;
  type: "municipality" | "zone";
  name: string;
  slug: string;
  aliases: string[];
  lat: number | null;
  lng: number | null;
  status: "active" | "inactive";
}

const TEST_SLUGS = [
  "municipio-e2e-prueba",
  "municipio-e2e-actualizado",
  "zona-e2e-prueba",
  "zona-e2e-sin-padre",
  "municipio-e2e-con-padre",
  "zona-e2e-padre-zona",
  "zona-e2e-otro-estado",
];

async function cleanupTestRegions(): Promise<void> {
  const repo = AppDataSource.getRepository(Region);
  const existing = await repo.find({
    where: { slug: In(TEST_SLUGS) },
  });

  if (existing.length === 0) return;

  // Eliminar primero zonas (hijas) y luego municipios (padres) por la FK parent_id
  const zones = existing.filter((r) => r.type === "zone");
  const municipalities = existing.filter((r) => r.type === "municipality");

  if (zones.length > 0) {
    await repo.delete({ id: In(zones.map((z) => z.id)) });
  }
  if (municipalities.length > 0) {
    await repo.delete({ id: In(municipalities.map((m) => m.id)) });
  }
}

describe("E2E: /api/regions", () => {
  let superUserToken = "";
  let activeStateId = "";
  let secondStateId = "";
  let createdMunicipalityId = "";
  let createdZoneId = "";

  before(async () => {
    if (!AppDataSource.isInitialized) {
      await AppDataSource.initialize();
    }

    await cleanupTestRegions();

    // Obtener estados sembrados en la BD
    const stateRepo = AppDataSource.getRepository(State);
    const activeState = await stateRepo.findOne({ where: { isActive: true } });
    assert.ok(activeState, "Debe existir al menos un State activo en la BD");
    activeStateId = activeState.id;

    const allStates = await stateRepo.find({ take: 2 });
    const otherState = allStates.find((s) => s.id !== activeStateId);
    secondStateId = otherState ? otherState.id : "";

    // Iniciar sesión como super_user
    const loginRes = await apiRequest<LoginData>("/auth/login", {
      method: "POST",
      body: {
        email: METACONFIG.superUser.email,
        password: METACONFIG.superUser.password,
      },
    });

    assert.equal(loginRes.status, 200);
    assert.ok(loginRes.body.data?.accessToken);
    superUserToken = loginRes.body.data.accessToken;
  });

  after(async () => {
    await cleanupTestRegions();
    if (AppDataSource.isInitialized) {
      await AppDataSource.destroy();
    }
  });

  // =========================================================================
  // 1. CONSULTAS PÚBLICAS DE ESTADOS
  // =========================================================================

  it("GET /regions/states -> 200 lista solo estados activos por defecto", async () => {
    const { status, body } = await apiRequest<StateData[]>("/regions/states");

    assert.equal(status, 200);
    assert.equal(body.ok, true);
    assert.ok(Array.isArray(body.data));
    assert.ok(body.data.length >= 1);
    assert.ok(body.data.every((s) => s.isActive === true));
  });

  it("GET /regions/states?includeInactive=true -> 200 lista todos los estados", async () => {
    const { status, body } = await apiRequest<StateData[]>(
      "/regions/states?includeInactive=true"
    );

    assert.equal(status, 200);
    assert.equal(body.ok, true);
    assert.ok(Array.isArray(body.data));
    assert.ok(body.data.some((s) => s.id === activeStateId));
  });

  // =========================================================================
  // 2. SEGURIDAD Y VALIDACIONES DE CREACIÓN (POST /regions)
  // =========================================================================

  it("POST /regions -> 401 si no se envía token", async () => {
    const { status, body } = await apiRequest("/regions", {
      method: "POST",
      body: {
        stateId: activeStateId,
        type: "municipality",
        name: "Municipio Sin Token",
      },
    });

    assert.equal(status, 401);
    assert.equal(body.ok, false);
  });

  it("POST /regions -> 422 cuando falla Zod (nombre corto o UUID inválido)", async () => {
    const { status, body } = await apiRequest("/regions", {
      method: "POST",
      token: superUserToken,
      body: {
        stateId: "no-es-uuid",
        type: "municipality",
        name: "A",
      },
    });

    assert.equal(status, 422);
    assert.equal(body.ok, false);
  });

  it("POST /regions -> 422 si type es 'municipality' pero se envía parentId", async () => {
    const { status, body } = await apiRequest("/regions", {
      method: "POST",
      token: superUserToken,
      body: {
        stateId: activeStateId,
        parentId: "11111111-1111-4111-8111-111111111111",
        type: "municipality",
        name: "Municipio Con Padre",
        slug: "municipio-e2e-con-padre",
      },
    });

    assert.equal(status, 422);
    assert.equal(body.ok, false);
  });

  it("POST /regions -> 422 si type es 'zone' y no se envía parentId", async () => {
    const { status, body } = await apiRequest("/regions", {
      method: "POST",
      token: superUserToken,
      body: {
        stateId: activeStateId,
        type: "zone",
        name: "Zona Sin Padre",
        slug: "zona-e2e-sin-padre",
      },
    });

    assert.equal(status, 422);
    assert.equal(body.ok, false);
  });

  it("POST /regions -> 404 si el stateId no existe en la BD", async () => {
    const { status, body } = await apiRequest("/regions", {
      method: "POST",
      token: superUserToken,
      body: {
        stateId: "00000000-0000-4000-8000-000000000000",
        type: "municipality",
        name: "Municipio Estado Inexistente",
      },
    });

    assert.equal(status, 404);
    assert.equal(body.ok, false);
  });

  // =========================================================================
  // 3. CREACIÓN JERÁRQUICA EXITOSA Y REGLAS DE NEGOCIO
  // =========================================================================

  it("POST /regions -> 201 crea un municipio generando slug automáticamente", async () => {
    const { status, body } = await apiRequest<RegionData>("/regions", {
      method: "POST",
      token: superUserToken,
      body: {
        stateId: activeStateId,
        type: "municipality",
        name: "Municipio E2E Prueba",
        aliases: ["Alias E2E 1", "Alias E2E 2"],
        lat: 16.7516,
        lng: -93.1029,
      },
    });

    assert.equal(status, 201);
    assert.equal(body.ok, true);
    assert.equal(body.data.type, "municipality");
    assert.equal(body.data.slug, "municipio-e2e-prueba");
    assert.equal(body.data.parentId, null);
    assert.equal(body.data.status, "active");
    assert.deepEqual(body.data.aliases, ["Alias E2E 1", "Alias E2E 2"]);

    createdMunicipalityId = body.data.id;
  });

  it("POST /regions -> 409 si ya existe una región con el mismo slug", async () => {
    const { status, body } = await apiRequest("/regions", {
      method: "POST",
      token: superUserToken,
      body: {
        stateId: activeStateId,
        type: "municipality",
        name: "Municipio E2E Prueba",
      },
    });

    assert.equal(status, 409);
    assert.equal(body.ok, false);
  });

  it("POST /regions -> 404 si el parentId de una zona no existe", async () => {
    const { status, body } = await apiRequest("/regions", {
      method: "POST",
      token: superUserToken,
      body: {
        stateId: activeStateId,
        parentId: "00000000-0000-4000-8000-000000000000",
        type: "zone",
        name: "Zona Padre Inexistente",
      },
    });

    assert.equal(status, 404);
    assert.equal(body.ok, false);
  });

  it("POST /regions -> 400 si la zona intenta asociarse a un municipio de otro estado", async () => {
    if (!secondStateId) return; // Solo aplica si hay >= 2 estados en BD

    const { status, body } = await apiRequest("/regions", {
      method: "POST",
      token: superUserToken,
      body: {
        stateId: secondStateId,
        parentId: createdMunicipalityId,
        type: "zone",
        name: "Zona E2E Otro Estado",
        slug: "zona-e2e-otro-estado",
      },
    });

    assert.equal(status, 400);
    assert.equal(body.ok, false);
  });

  it("POST /regions -> 201 crea una zona hija vinculada al municipio", async () => {
    const { status, body } = await apiRequest<RegionData>("/regions", {
      method: "POST",
      token: superUserToken,
      body: {
        stateId: activeStateId,
        parentId: createdMunicipalityId,
        type: "zone",
        name: "Zona E2E Prueba",
        aliases: ["Sector Turístico E2E"],
        lat: 16.76,
        lng: -93.11,
      },
    });

    assert.equal(status, 201);
    assert.equal(body.ok, true);
    assert.equal(body.data.type, "zone");
    assert.equal(body.data.slug, "zona-e2e-prueba");
    assert.equal(body.data.parentId, createdMunicipalityId);
    assert.equal(body.data.parentName, "Municipio E2E Prueba");

    createdZoneId = body.data.id;
  });

  it("POST /regions -> 400 si una zona intenta usar otra zona como parentId", async () => {
    const { status, body } = await apiRequest("/regions", {
      method: "POST",
      token: superUserToken,
      body: {
        stateId: activeStateId,
        parentId: createdZoneId,
        type: "zone",
        name: "Zona E2E Padre Zona",
        slug: "zona-e2e-padre-zona",
      },
    });

    assert.equal(status, 400);
    assert.equal(body.ok, false);
  });

  // =========================================================================
  // 4. CONSULTAS, FILTROS Y DETALLE (GET /regions y GET /regions/:id)
  // =========================================================================

  it("GET /regions -> 400 cuando se envía un filtro type o status inválido", async () => {
    const badType = await apiRequest("/regions?type=pais");
    assert.equal(badType.status, 400);

    const badStatus = await apiRequest("/regions?status=pendiente");
    assert.equal(badStatus.status, 400);
  });

  it("GET /regions -> 200 filtra correctamente por stateId, type, parentId y search", async () => {
    // Filtro por parentId + type=zone
    const byParent = await apiRequest<RegionData[]>(
      `/regions?stateId=${activeStateId}&type=zone&parentId=${createdMunicipalityId}`
    );
    assert.equal(byParent.status, 200);
    assert.equal(byParent.body.data.length, 1);
    assert.equal(byParent.body.data[0]?.id, createdZoneId);

    // Filtro por búsqueda de texto
    const bySearch = await apiRequest<RegionData[]>(
      "/regions?search=municipio-e2e"
    );
    assert.equal(bySearch.status, 200);
    assert.ok(bySearch.body.data.some((r) => r.id === createdMunicipalityId));
  });

  it("GET /regions/:id -> 200 devuelve detalle de la región y 404 si no existe", async () => {
    const okRes = await apiRequest<RegionData>(`/regions/${createdZoneId}`);
    assert.equal(okRes.status, 200);
    assert.equal(okRes.body.data.id, createdZoneId);
    assert.equal(okRes.body.data.parentId, createdMunicipalityId);

    const notFoundRes = await apiRequest(
      "/regions/00000000-0000-4000-8000-000000000000"
    );
    assert.equal(notFoundRes.status, 404);
  });

  // =========================================================================
  // 5. ACTUALIZACIÓN Y TOGGLE DE ESTADO (PATCH /regions/:id)
  // =========================================================================

  it("PATCH /regions/:id -> 401 sin token y 200 actualiza datos con super_user", async () => {
    const unauth = await apiRequest(`/regions/${createdMunicipalityId}`, {
      method: "PATCH",
      body: { name: "Intento Sin Token" },
    });
    assert.equal(unauth.status, 401);

    const updated = await apiRequest<RegionData>(
      `/regions/${createdMunicipalityId}`,
      {
        method: "PATCH",
        token: superUserToken,
        body: {
          name: "Municipio E2E Actualizado",
          slug: "municipio-e2e-actualizado",
          aliases: ["Nuevo Alias E2E"],
        },
      }
    );

    assert.equal(updated.status, 200);
    assert.equal(updated.body.data.name, "Municipio E2E Actualizado");
    assert.equal(updated.body.data.slug, "municipio-e2e-actualizado");
    assert.deepEqual(updated.body.data.aliases, ["Nuevo Alias E2E"]);
  });

  it("PATCH /regions/:id/toggle-status -> 200 desactiva región y oculta en listado público por defecto", async () => {
    const toggleOff = await apiRequest<RegionData>(
      `/regions/${createdZoneId}/toggle-status`,
      {
        method: "PATCH",
        token: superUserToken,
      }
    );

    assert.equal(toggleOff.status, 200);
    assert.equal(toggleOff.body.data.status, "inactive");

    // Por defecto GET /regions solo devuelve status=active
    const publicList = await apiRequest<RegionData[]>(
      `/regions?parentId=${createdMunicipalityId}`
    );
    assert.equal(publicList.status, 200);
    assert.ok(!publicList.body.data.some((r) => r.id === createdZoneId));

    // Con ?status=all sí aparece
    const adminList = await apiRequest<RegionData[]>(
      `/regions?parentId=${createdMunicipalityId}&status=all`
    );
    assert.equal(adminList.status, 200);
    assert.ok(adminList.body.data.some((r) => r.id === createdZoneId));

    // Reactivar
    const toggleOn = await apiRequest<RegionData>(
      `/regions/${createdZoneId}/toggle-status`,
      {
        method: "PATCH",
        token: superUserToken,
      }
    );
    assert.equal(toggleOn.status, 200);
    assert.equal(toggleOn.body.data.status, "active");
  });
});