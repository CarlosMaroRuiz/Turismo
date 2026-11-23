import crypto from "node:crypto";
import { after, before, describe, it } from "node:test";
import assert from "node:assert/strict";
import { AppDataSource } from "../../core/bd/index.js";
import { PartnerCategory } from "../../core/bd/entities/PartnerCategory.js";
import { Region } from "../../core/bd/entities/Region.entity.js";
import { Partner } from "../../core/bd/entities/Partner.js";
import { PartnerUser } from "../../core/bd/entities/PartnerUser.js";
import { User } from "../../core/bd/entities/User.js";
import { UserToken } from "../../core/bd/entities/UserToken.js";
import { METACONFIG } from "../../core/metaconfig/index.js";
import { apiRequest } from "./helpers/api-client.js";

const TARGET_OWNER_EMAIL =
  process.env.MAIL_TEST_END ?? "micuentaruiz2@gmail.com";
const REJECT_OWNER_EMAIL = "rechazo-e2e@example.com";
const STAFF_MEMBER_EMAIL = "staff-e2e@example.com";
const INVITE_OWNER_EMAIL = "reenvio-e2e@example.com";

interface LoginData {
  accessToken: string;
  user: {
    id: string;
    name: string;
    email: string;
    role: string;
    mustChangePassword: boolean;
    partner: {
      id: string;
      commercialName: string;
      role: string;
    } | null;
  };
}

interface PartnerRegistrationData {
  partnerId: string;
  commercialName: string;
  slug: string;
  status: string;
  ownerEmail: string;
}

interface PartnerSummaryData {
  id: string;
  commercialName: string;
  description: string | null;
  contactPhone: string;
  status: string;
  statusReason: string | null;
}

interface PartnerMemberData {
  id: string;
  partnerId: string;
  userId: string;
  name: string;
  email: string;
  userStatus: string;
  role: string;
  isActive: boolean;
}

async function cleanupTestEmails(emails: string[]): Promise<void> {
  for (const email of emails) {
    const user = await AppDataSource.getRepository(User).findOne({
      where: { email },
    });

    if (!user) continue;

    const links = await AppDataSource.getRepository(PartnerUser).find({
      where: { userId: user.id },
    });

    await AppDataSource.getRepository(UserToken).delete({ userId: user.id });
    await AppDataSource.getRepository(PartnerUser).delete({ userId: user.id });
    await AppDataSource.getRepository(User).delete({ id: user.id });

    for (const link of links) {
      const remainingMembers = await AppDataSource.getRepository(
        PartnerUser
      ).count({
        where: { partnerId: link.partnerId },
      });
      if (remainingMembers === 0) {
        await AppDataSource.getRepository(Partner).delete({
          id: link.partnerId,
        });
      }
    }
  }
}

describe("E2E: /api/partners", () => {
  let superUserToken = "";
  let categoryId = "";
  let regionId = "";
  let approvedPartnerId = "";
  let rejectedPartnerId = "";

  before(async () => {
    if (!AppDataSource.isInitialized) {
      await AppDataSource.initialize();
    }

    // Limpiar ejecuciones anteriores para que la suite sea 100% repetible
    await cleanupTestEmails([
      STAFF_MEMBER_EMAIL,
      TARGET_OWNER_EMAIL,
      REJECT_OWNER_EMAIL,
      INVITE_OWNER_EMAIL,
    ]);

    // Obtener IDs reales de categoría y región sembradas
    const category = await AppDataSource.getRepository(PartnerCategory).findOne({
      where: {},
    });
    const region = await AppDataSource.getRepository(Region).findOne({
      where: {},
    });

    assert.ok(category, "Debe existir al menos una PartnerCategory en la BD");
    assert.ok(region, "Debe existir al menos una Region en la BD");

    categoryId = category.id;
    regionId = region.id;

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
    await cleanupTestEmails([STAFF_MEMBER_EMAIL, INVITE_OWNER_EMAIL]);
    if (AppDataSource.isInitialized) {
      await AppDataSource.destroy();
    }
  });

  it("POST /partners/register -> 422 cuando falla la validación de Zod", async () => {
    const { status, body } = await apiRequest("/partners/register", {
      method: "POST",
      body: {
        commercialName: "A",
      },
    });

    assert.equal(status, 422);
    assert.equal(body.ok, false);
  });

  it("POST /partners/register -> 201 registra solicitud para el correo de prueba", async () => {
    const { status, body } = await apiRequest<PartnerRegistrationData>(
      "/partners/register",
      {
        method: "POST",
        body: {
          categoryId,
          regionId,
          commercialName: "EcoTours Cañón del Sumidero",
          legalName: "Operadora Turística Cañón del Sumidero S.A. de C.V.",
          description: "Recorridos guiados en lancha y senderismo.",
          address: "Malecón Chiapa de Corzo #120, Centro",
          lat: 16.7066,
          lng: -93.0152,
          contactName: "Carlos Ruiz",
          contactEmail: TARGET_OWNER_EMAIL,
          contactPhone: "9611234567",
          ownerName: "Carlos Ruiz",
          ownerEmail: TARGET_OWNER_EMAIL,
          ownerPhone: "9611234567",
        },
      }
    );

    assert.equal(status, 201);
    assert.equal(body.ok, true);
    assert.equal(body.data?.status, "pending");
    assert.equal(body.data?.ownerEmail, TARGET_OWNER_EMAIL);
    assert.ok(body.data?.partnerId);

    approvedPartnerId = body.data.partnerId;
  });

  it("POST /partners/register -> 409 si el correo del responsable ya está registrado", async () => {
    const { status, body } = await apiRequest("/partners/register", {
      method: "POST",
      body: {
        categoryId,
        regionId,
        commercialName: "Otra Agencia Duplicada",
        legalName: "Agencia Duplicada S.A.",
        address: "Av. Central #45, Tuxtla Gutiérrez",
        contactName: "Carlos Ruiz",
        contactEmail: TARGET_OWNER_EMAIL,
        contactPhone: "9617654321",
        ownerName: "Carlos Ruiz",
        ownerEmail: TARGET_OWNER_EMAIL,
      },
    });

    assert.equal(status, 409);
    assert.equal(body.ok, false);
  });

  it("GET /partners -> 401 sin token de autenticación", async () => {
    const { status, body } = await apiRequest("/partners");

    assert.equal(status, 401);
    assert.equal(body.ok, false);
  });

  it("GET /partners?status=pending -> 200 lista las solicitudes pendientes para super_user", async () => {
    const { status, body } = await apiRequest<PartnerSummaryData[]>(
      "/partners?status=pending",
      {
        token: superUserToken,
      }
    );

    assert.equal(status, 200);
    assert.equal(body.ok, true);
    assert.ok(Array.isArray(body.data));
    assert.ok(body.data.some((p) => p.id === approvedPartnerId));
  });

  it("PATCH /partners/:id/approve -> 200 aprueba el socio y envía correo de activación", async () => {
    const { status, body } = await apiRequest(
      `/partners/${approvedPartnerId}/approve`,
      {
        method: "PATCH",
        token: superUserToken,
      }
    );

    assert.equal(status, 200);
    assert.equal(body.ok, true);
  });

  it("PATCH /partners/:id/approve -> 400 si el socio ya no está en estado pending", async () => {
    const { status, body } = await apiRequest(
      `/partners/${approvedPartnerId}/approve`,
      {
        method: "PATCH",
        token: superUserToken,
      }
    );

    assert.equal(status, 400);
    assert.equal(body.ok, false);
  });

  it("POST /auth/activate + /auth/login -> 200 activa la cuenta del partner y valida permisos", async () => {
    const ownerUser = await AppDataSource.getRepository(User).findOne({
      where: { email: TARGET_OWNER_EMAIL },
    });
    assert.ok(ownerUser, "Debe existir el usuario dueño del partner aprobado");

    const plainToken = crypto.randomBytes(32).toString("hex");
    const tokenHash = crypto
      .createHash("sha256")
      .update(plainToken)
      .digest("hex");

    await AppDataSource.getRepository(UserToken).update(
      { userId: ownerUser.id },
      { tokenHash }
    );

    const activateRes = await apiRequest("/auth/activate", {
      method: "POST",
      body: {
        token: plainToken,
        password: "PartnerPassword123!",
      },
    });

    assert.equal(activateRes.status, 200);
    assert.equal(activateRes.body.ok, true);

    const loginRes = await apiRequest<LoginData>("/auth/login", {
      method: "POST",
      body: {
        email: TARGET_OWNER_EMAIL,
        password: "PartnerPassword123!",
      },
    });

    assert.equal(loginRes.status, 200);
    assert.equal(loginRes.body.data?.user.email, TARGET_OWNER_EMAIL);
    assert.equal(loginRes.body.data?.user.role, "partner");
    assert.equal(loginRes.body.data?.user.partner?.id, approvedPartnerId);
    assert.equal(loginRes.body.data?.user.partner?.role, "owner");

    // Verificar que un partner no puede acceder al listado general de socios (403)
    const forbiddenRes = await apiRequest("/partners", {
      token: loginRes.body.data!.accessToken,
    });

    assert.equal(forbiddenRes.status, 403);
    assert.equal(forbiddenRes.body.ok, false);
  });

  it("POST + PATCH /partners/:id/reject -> 200 rechaza una solicitud con motivo", async () => {
    const regRes = await apiRequest<PartnerRegistrationData>(
      "/partners/register",
      {
        method: "POST",
        body: {
          categoryId,
          regionId,
          commercialName: "Hotel Prueba Rechazo",
          legalName: "Hotel Prueba S.A.",
          address: "Calle Segunda Norte #88, San Cristóbal",
          contactName: "Ana López",
          contactEmail: REJECT_OWNER_EMAIL,
          contactPhone: "9671112233",
          ownerName: "Ana López",
          ownerEmail: REJECT_OWNER_EMAIL,
        },
      }
    );

    assert.equal(regRes.status, 201);
    rejectedPartnerId = regRes.body.data!.partnerId;

    const rejectRes = await apiRequest(
      `/partners/${rejectedPartnerId}/reject`,
      {
        method: "PATCH",
        token: superUserToken,
        body: {
          reason: "Documentación fiscal incompleta en la solicitud inicial.",
        },
      }
    );

    assert.equal(rejectRes.status, 200);
    assert.equal(rejectRes.body.ok, true);
  });

  it("GET + PATCH /partners/:id -> 200 permite ver y editar el perfil del propio socio y bloquea otros socios (403)", async () => {
    const ownerLogin = await apiRequest<LoginData>("/auth/login", {
      method: "POST",
      body: {
        email: TARGET_OWNER_EMAIL,
        password: "PartnerPassword123!",
      },
    });
    assert.equal(ownerLogin.status, 200);
    const ownerToken = ownerLogin.body.data!.accessToken;

    // Puede consultar su propio socio
    const ownRes = await apiRequest<PartnerSummaryData>(
      `/partners/${approvedPartnerId}`,
      { token: ownerToken }
    );
    assert.equal(ownRes.status, 200);
    assert.equal(ownRes.body.data?.id, approvedPartnerId);

    // No puede consultar otro socio (403)
    const otherRes = await apiRequest(`/partners/${rejectedPartnerId}`, {
      token: ownerToken,
    });
    assert.equal(otherRes.status, 403);

    // Owner actualiza descripción y teléfono de contacto
    const updateRes = await apiRequest<PartnerSummaryData>(
      `/partners/${approvedPartnerId}`,
      {
        method: "PATCH",
        token: ownerToken,
        body: {
          description: "Tours actualizados desde el panel del owner",
          contactPhone: "9619998877",
        },
      }
    );
    assert.equal(updateRes.status, 200);
    assert.equal(
      updateRes.body.data?.description,
      "Tours actualizados desde el panel del owner"
    );
    assert.equal(updateRes.body.data?.contactPhone, "9619998877");
  });

  it("POST + PATCH /partners/:id/members -> 201 agrega staff y protege que quede al menos 1 owner activo", async () => {
    const ownerLogin = await apiRequest<LoginData>("/auth/login", {
      method: "POST",
      body: {
        email: TARGET_OWNER_EMAIL,
        password: "PartnerPassword123!",
      },
    });
    const ownerToken = ownerLogin.body.data!.accessToken;

    // Agregar miembro staff
    const addRes = await apiRequest<PartnerMemberData>(
      `/partners/${approvedPartnerId}/members`,
      {
        method: "POST",
        token: ownerToken,
        body: {
          name: "Staff Prueba",
          email: STAFF_MEMBER_EMAIL,
          role: "staff",
        },
      }
    );
    assert.equal(addRes.status, 201);
    assert.equal(addRes.body.data?.role, "staff");
    const staffMemberId = addRes.body.data!.id;

    // Listar equipo (debe haber owner + staff)
    const listRes = await apiRequest<PartnerMemberData[]>(
      `/partners/${approvedPartnerId}/members`,
      { token: ownerToken }
    );
    assert.equal(listRes.status, 200);
    assert.equal(listRes.body.data?.length, 2);

    const ownerMember = listRes.body.data!.find((m) => m.role === "owner");
    assert.ok(ownerMember, "Debe existir el miembro owner");

    // Intentar desactivar al único owner -> 400
    const badDeactivate = await apiRequest(
      `/partners/${approvedPartnerId}/members/${ownerMember.id}`,
      {
        method: "PATCH",
        token: ownerToken,
        body: { isActive: false },
      }
    );
    assert.equal(badDeactivate.status, 400);

    // Desactivar al staff -> 200
    const deactivateStaff = await apiRequest<PartnerMemberData>(
      `/partners/${approvedPartnerId}/members/${staffMemberId}`,
      {
        method: "PATCH",
        token: ownerToken,
        body: { isActive: false },
      }
    );
    assert.equal(deactivateStaff.status, 200);
    assert.equal(deactivateStaff.body.data?.isActive, false);
  });

  it("PATCH /partners/:id/suspend y /reactivate -> 200 alterna estado active ⇄ suspended", async () => {
    // Suspender sin motivo -> 422
    const badSuspend = await apiRequest(
      `/partners/${approvedPartnerId}/suspend`,
      {
        method: "PATCH",
        token: superUserToken,
        body: {},
      }
    );
    assert.equal(badSuspend.status, 422);

    // Suspender con motivo -> 200
    const suspendRes = await apiRequest(
      `/partners/${approvedPartnerId}/suspend`,
      {
        method: "PATCH",
        token: superUserToken,
        body: {
          reason: "Incumplimiento temporal en actualización de tarifas.",
        },
      }
    );
    assert.equal(suspendRes.status, 200);

    // Reactivar -> 200
    const reactivateRes = await apiRequest(
      `/partners/${approvedPartnerId}/reactivate`,
      {
        method: "PATCH",
        token: superUserToken,
      }
    );
    assert.equal(reactivateRes.status, 200);
  });

  it("POST /partners/:id/resend-invite -> 400 si el owner ya activó su cuenta y 200 si sigue invited", async () => {
    // El owner del socio principal ya activó su cuenta -> 400
    const alreadyActiveRes = await apiRequest(
      `/partners/${approvedPartnerId}/resend-invite`,
      {
        method: "POST",
        token: superUserToken,
      }
    );
    assert.equal(alreadyActiveRes.status, 400);

    // Registrar y aprobar un socio sin activar su cuenta para probar el reenvío
    const regRes = await apiRequest<PartnerRegistrationData>(
      "/partners/register",
      {
        method: "POST",
        body: {
          categoryId,
          regionId,
          commercialName: "Agencia Reenvío E2E",
          legalName: "Agencia Reenvío S.A.",
          address: "Av. Central #200, Tuxtla Gutiérrez",
          contactName: "Luis Gómez",
          contactEmail: INVITE_OWNER_EMAIL,
          contactPhone: "9612223344",
          ownerName: "Luis Gómez",
          ownerEmail: INVITE_OWNER_EMAIL,
        },
      }
    );
    assert.equal(regRes.status, 201);
    const invitePartnerId = regRes.body.data!.partnerId;

    await apiRequest(`/partners/${invitePartnerId}/approve`, {
      method: "PATCH",
      token: superUserToken,
    });

    const resendRes = await apiRequest(
      `/partners/${invitePartnerId}/resend-invite`,
      {
        method: "POST",
        token: superUserToken,
      }
    );
    assert.equal(resendRes.status, 200);
    assert.equal(resendRes.body.ok, true);
  });
});