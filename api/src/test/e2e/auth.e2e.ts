import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { apiRequest } from "./helpers/api-client.js";
import type {
  LoginResponse,
  UserProfileResponse,
} from "../../features/auth/responses/index.js";

const TEST_ADMIN = {
  email: process.env.SUPER_USER_EMAIL ?? "admin@plataforma.com",
  password: process.env.SUPER_USER_PASSWORD ?? "Admin1234!",
};

describe("E2E: /api/auth", () => {
  let accessToken = "";

  it("POST /auth/login -> 422 cuando falla la validación de Zod", async () => {
    const { status, body } = await apiRequest("/auth/login", {
      method: "POST",
      body: { email: "correo-invalido", password: "" },
    });

    assert.equal(status, 422);
    assert.equal(body.ok, false);
    assert.ok(body.errors?.email);
    assert.ok(body.errors?.password);
  });

  it("POST /auth/login -> 401 con credenciales incorrectas", async () => {
    const { status, body } = await apiRequest("/auth/login", {
      method: "POST",
      body: { email: TEST_ADMIN.email, password: "PasswordIncorrecto999" },
    });

    assert.equal(status, 401);
    assert.equal(body.ok, false);
  });

  it("POST /auth/login -> 200 y entrega accessToken + perfil", async () => {
    const { status, body } = await apiRequest<LoginResponse>("/auth/login", {
      method: "POST",
      body: TEST_ADMIN,
    });

    assert.equal(status, 200);
    assert.equal(body.ok, true);
    assert.ok(body.data.accessToken);
    assert.equal(body.data.user.email, TEST_ADMIN.email);

    accessToken = body.data.accessToken;
  });

  it("GET /auth/me -> 401 sin token", async () => {
    const { status, body } = await apiRequest("/auth/me");

    assert.equal(status, 401);
    assert.equal(body.ok, false);
  });

  it("GET /auth/me -> 200 con token válido", async () => {
    const { status, body } = await apiRequest<UserProfileResponse>("/auth/me", {
      token: accessToken,
    });

    assert.equal(status, 200);
    assert.equal(body.ok, true);
    assert.equal(body.data.email, TEST_ADMIN.email);
  });

  it("POST /auth/activate -> 400 con token inexistente", async () => {
    const { status, body } = await apiRequest("/auth/activate", {
      method: "POST",
      body: {
        token: "token_que_no_existe_en_bd",
        password: "NuevaPassword123",
      },
    });

    assert.equal(status, 400);
    assert.equal(body.ok, false);
  });
});