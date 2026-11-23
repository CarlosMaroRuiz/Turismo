import { after, before, describe, it } from "node:test";
import assert from "node:assert/strict";
import { AppDataSource } from "../../core/bd/index.js";
import { PartnerCategory } from "../../core/bd/entities/PartnerCategory.js";
import { METACONFIG } from "../../core/metaconfig/index.js";
import { apiRequest } from "./helpers/api-client.js";

interface LoginData {
  accessToken: string;
}

interface PartnerCategoryData {
  id: string;
  code: string;
  name: string;
  isActive: boolean;
}

describe("E2E: /api/partner-categories", () => {
  let superUserToken = "";
  let targetCategoryId = "";
  let originalName = "";
  let originalIsActive = true;

  before(async () => {
    if (!AppDataSource.isInitialized) {
      await AppDataSource.initialize();
    }

    const category = await AppDataSource.getRepository(PartnerCategory).findOne(
      { where: {} }
    );
    assert.ok(category, "Debe existir al menos una PartnerCategory sembrada");

    targetCategoryId = category.id;
    originalName = category.name;
    originalIsActive = category.isActive;

    const loginRes = await apiRequest<LoginData>("/auth/login", {
      method: "POST",
      body: {
        email: METACONFIG.superUser.email,
        password: METACONFIG.superUser.password,
      },
    });

    assert.equal(loginRes.status, 200);
    superUserToken = loginRes.body.data.accessToken;
  });

  after(async () => {
    // Restaurar valores originales de la categoría sembrada
    if (AppDataSource.isInitialized && targetCategoryId) {
      await AppDataSource.getRepository(PartnerCategory).update(
        { id: targetCategoryId },
        { name: originalName, isActive: originalIsActive }
      );
      await AppDataSource.destroy();
    }
  });

  it("GET /partner-categories -> 200 lista solo categorías activas por defecto", async () => {
    const { status, body } = await apiRequest<PartnerCategoryData[]>(
      "/partner-categories"
    );

    assert.equal(status, 200);
    assert.equal(body.ok, true);
    assert.ok(Array.isArray(body.data));
    assert.ok(body.data.every((c) => c.isActive === true));
  });

  it("GET /partner-categories/:id -> 200 devuelve detalle y 404 si no existe", async () => {
    const okRes = await apiRequest<PartnerCategoryData>(
      `/partner-categories/${targetCategoryId}`
    );
    assert.equal(okRes.status, 200);
    assert.equal(okRes.body.data.id, targetCategoryId);

    const notFoundRes = await apiRequest(
      "/partner-categories/00000000-0000-4000-8000-000000000000"
    );
    assert.equal(notFoundRes.status, 404);
  });

  it("PATCH /partner-categories/:id -> 401 sin token y 422 con body vacío", async () => {
    const unauth = await apiRequest(
      `/partner-categories/${targetCategoryId}`,
      {
        method: "PATCH",
        body: { name: "Sin Token" },
      }
    );
    assert.equal(unauth.status, 401);

    const invalid = await apiRequest(
      `/partner-categories/${targetCategoryId}`,
      {
        method: "PATCH",
        token: superUserToken,
        body: {},
      }
    );
    assert.equal(invalid.status, 422);
  });

  it("PATCH /partner-categories/:id -> 200 actualiza el nombre visible", async () => {
    const { status, body } = await apiRequest<PartnerCategoryData>(
      `/partner-categories/${targetCategoryId}`,
      {
        method: "PATCH",
        token: superUserToken,
        body: { name: "Categoría E2E Temporal" },
      }
    );

    assert.equal(status, 200);
    assert.equal(body.data.name, "Categoría E2E Temporal");
  });

  it("PATCH /partner-categories/:id/toggle-status -> 200 desactiva y oculta en listado público", async () => {
    const offRes = await apiRequest<PartnerCategoryData>(
      `/partner-categories/${targetCategoryId}/toggle-status`,
      {
        method: "PATCH",
        token: superUserToken,
      }
    );
    assert.equal(offRes.status, 200);
    assert.equal(offRes.body.data.isActive, false);

    // No aparece en GET /partner-categories por defecto
    const publicList = await apiRequest<PartnerCategoryData[]>(
      "/partner-categories"
    );
    assert.ok(!publicList.body.data.some((c) => c.id === targetCategoryId));

    // Sí aparece con ?includeInactive=true
    const fullList = await apiRequest<PartnerCategoryData[]>(
      "/partner-categories?includeInactive=true"
    );
    assert.ok(fullList.body.data.some((c) => c.id === targetCategoryId));

    // Reactivar
    const onRes = await apiRequest<PartnerCategoryData>(
      `/partner-categories/${targetCategoryId}/toggle-status`,
      {
        method: "PATCH",
        token: superUserToken,
      }
    );
    assert.equal(onRes.status, 200);
    assert.equal(onRes.body.data.isActive, true);
  });
});