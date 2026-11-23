import { z } from "zod";
import { BaseRoutes } from "../../../core/routes/BaseRoutes.js";
import { AuthMiddleware } from "../../../core/middlewares/AuthMiddleware/index.js";
import { RateLimit } from "../../../core/middlewares/RateLimit/index.js";
import { RoleCode } from "../../../core/bd/entities/Role.js";
import { PartnerStatus } from "../../../core/bd/entities/Partner.js";
import { paginationSchema } from "../../../core/http/pagination.js";
import { registerRoutes } from "../../../core/http/openapi/index.js";
import {
  addPartnerMemberSchema,
  createPartnerSchema,
  registerPartnerSchema,
  rejectPartnerSchema,
  suspendPartnerSchema,
  updatePartnerMemberSchema,
  updatePartnerSchema,
} from "../dto/index.js";
import { PartnerController } from "../controller/PartnerController.js";

const listPartnersQuerySchema = paginationSchema.extend({
  status: z.nativeEnum(PartnerStatus).optional(),
});

export class PartnerRoutes extends BaseRoutes<PartnerController> {
  constructor() {
    super(PartnerController);
  }

  protected initRoutes(): void {
    // Registro público de solicitud de socio
    this.router.post("/register", RateLimit.register, this.controller.register);

    // Listado global (solo super_user)
    this.router.get(
      "/",
      AuthMiddleware.authenticate,
      AuthMiddleware.authorizeRoles(RoleCode.SUPER_USER),
      this.controller.list
    );

    // Alta directa del administrador (CU-02)
    this.router.post(
      "/",
      AuthMiddleware.authenticate,
      AuthMiddleware.authorizeRoles(RoleCode.SUPER_USER),
      this.controller.create
    );

    // Detalle y edición de perfil de socio (super_user o propio partner)
    this.router.get(
      "/:id",
      AuthMiddleware.authenticate,
      AuthMiddleware.authorizeRoles(RoleCode.SUPER_USER, RoleCode.PARTNER),
      this.controller.getById
    );

    this.router.patch(
      "/:id",
      AuthMiddleware.authenticate,
      AuthMiddleware.authorizeRoles(RoleCode.SUPER_USER, RoleCode.PARTNER),
      this.controller.update
    );

    // Transiciones de estado e invitación (solo super_user)
    this.router.patch(
      "/:id/approve",
      AuthMiddleware.authenticate,
      AuthMiddleware.authorizeRoles(RoleCode.SUPER_USER),
      this.controller.approve
    );

    this.router.patch(
      "/:id/reject",
      AuthMiddleware.authenticate,
      AuthMiddleware.authorizeRoles(RoleCode.SUPER_USER),
      this.controller.reject
    );

    this.router.patch(
      "/:id/suspend",
      AuthMiddleware.authenticate,
      AuthMiddleware.authorizeRoles(RoleCode.SUPER_USER),
      this.controller.suspend
    );

    this.router.patch(
      "/:id/reactivate",
      AuthMiddleware.authenticate,
      AuthMiddleware.authorizeRoles(RoleCode.SUPER_USER),
      this.controller.reactivate
    );

    this.router.post(
      "/:id/resend-invite",
      AuthMiddleware.authenticate,
      AuthMiddleware.authorizeRoles(RoleCode.SUPER_USER),
      this.controller.resendInvite
    );

    // Gestión de equipo del socio (partner_users)
    this.router.get(
      "/:id/members",
      AuthMiddleware.authenticate,
      AuthMiddleware.authorizeRoles(RoleCode.SUPER_USER, RoleCode.PARTNER),
      this.controller.listMembers
    );

    this.router.post(
      "/:id/members",
      AuthMiddleware.authenticate,
      AuthMiddleware.authorizeRoles(RoleCode.SUPER_USER, RoleCode.PARTNER),
      this.controller.addMember
    );

    this.router.post(
      "/:id/members/:userId/resend-invite",
      AuthMiddleware.authenticate,
      AuthMiddleware.authorizeRoles(RoleCode.SUPER_USER, RoleCode.PARTNER),
      this.controller.resendMember
    );

    this.router.patch(
      "/:id/members/:memberId",
      AuthMiddleware.authenticate,
      AuthMiddleware.authorizeRoles(RoleCode.SUPER_USER, RoleCode.PARTNER),
      this.controller.updateMember
    );

    registerRoutes("Socios", [
      {
        method: "post",
        path: "/api/v1/partners/register",
        summary:
          "Solicitud pública de registro; crea el socio en pending y al responsable en invited",
        auth: "none",
        body: registerPartnerSchema,
        successStatus: 201,
      },
      {
        method: "post",
        path: "/api/v1/partners",
        summary:
          "Alta directa del administrador; con invite=true aprueba y envía la activación",
        auth: "user",
        roles: [RoleCode.SUPER_USER],
        body: createPartnerSchema,
        successStatus: 201,
      },
      {
        method: "get",
        path: "/api/v1/partners",
        summary: "Lista socios con filtro por estado y paginación",
        auth: "user",
        roles: [RoleCode.SUPER_USER],
        query: listPartnersQuerySchema,
      },
      {
        method: "get",
        path: "/api/v1/partners/:id",
        summary: "Detalle del socio (el socio solo puede ver el propio)",
        auth: "user",
        roles: [RoleCode.SUPER_USER, RoleCode.PARTNER],
      },
      {
        method: "patch",
        path: "/api/v1/partners/:id",
        summary:
          "Edita la ficha; categoría, región y slug son exclusivos del administrador",
        auth: "user",
        roles: [RoleCode.SUPER_USER, RoleCode.PARTNER],
        body: updatePartnerSchema,
      },
      {
        method: "patch",
        path: "/api/v1/partners/:id/approve",
        summary: "pending → active y envío de la invitación",
        auth: "user",
        roles: [RoleCode.SUPER_USER],
      },
      {
        method: "patch",
        path: "/api/v1/partners/:id/reject",
        summary: "pending → rejected con motivo obligatorio",
        auth: "user",
        roles: [RoleCode.SUPER_USER],
        body: rejectPartnerSchema,
      },
      {
        method: "patch",
        path: "/api/v1/partners/:id/suspend",
        summary: "active → suspended con motivo obligatorio",
        auth: "user",
        roles: [RoleCode.SUPER_USER],
        body: suspendPartnerSchema,
      },
      {
        method: "patch",
        path: "/api/v1/partners/:id/reactivate",
        summary: "suspended → active",
        auth: "user",
        roles: [RoleCode.SUPER_USER],
      },
      {
        method: "post",
        path: "/api/v1/partners/:id/resend-invite",
        summary: "Reenvía la invitación si el responsable sigue en invited",
        auth: "user",
        roles: [RoleCode.SUPER_USER],
      },
      {
        method: "get",
        path: "/api/v1/partners/:id/members",
        summary: "Equipo del socio",
        auth: "user",
        roles: [RoleCode.SUPER_USER, RoleCode.PARTNER],
      },
      {
        method: "post",
        path: "/api/v1/partners/:id/members",
        summary: "Agrega un miembro invitado y envía la activación",
        auth: "user",
        roles: [RoleCode.SUPER_USER, RoleCode.PARTNER],
        body: addPartnerMemberSchema,
        successStatus: 201,
      },
      {
        method: "post",
        path: "/api/v1/partners/:id/members/:userId/resend-invite",
        summary: "Reenvía la invitación a un miembro que sigue sin activar",
        auth: "user",
        roles: [RoleCode.SUPER_USER, RoleCode.PARTNER],
      },
      {
        method: "patch",
        path: "/api/v1/partners/:id/members/:memberId",
        summary:
          "Cambia rol o estado del miembro; impide quedarse sin owner activo",
        auth: "user",
        roles: [RoleCode.SUPER_USER, RoleCode.PARTNER],
        body: updatePartnerMemberSchema,
      },
    ]);
  }
}
