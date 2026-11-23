import { BaseRoutes } from "../../../core/routes/BaseRoutes.js";
import { AuthMiddleware } from "../../../core/middlewares/AuthMiddleware/index.js";
import { RoleCode } from "../../../core/bd/entities/Role.js";
import { paginationSchema } from "../../../core/http/pagination.js";
import { registerRoutes } from "../../../core/http/openapi/index.js";
import {
  createExperienceSchema,
  createSlotSchema,
  experienceAvailabilityQuerySchema,
  experienceListQuerySchema,
  updateExperienceSchema,
  updateSlotSchema,
} from "../dto/index.js";
import { ExperienceController } from "../controller/ExperienceController.js";

export class ExperienceRoutes extends BaseRoutes<ExperienceController> {
  constructor() {
    super(ExperienceController);
  }

  protected initRoutes(): void {
    // Públicos (disponibilidad y listado van antes de /:id)
    this.router.get("/", this.controller.list);
    this.router.get("/availability", this.controller.availability);

    // Gestión del operador
    this.router.get(
      "/mine",
      AuthMiddleware.authenticate,
      AuthMiddleware.authorizeRoles(RoleCode.SUPER_USER, RoleCode.PARTNER),
      this.controller.listMine
    );

    this.router.get(
      "/:id",
      AuthMiddleware.optional,
      this.controller.getById
    );

    this.router.post(
      "/",
      AuthMiddleware.authenticate,
      AuthMiddleware.authorizeRoles(RoleCode.SUPER_USER, RoleCode.PARTNER),
      this.controller.create
    );

    this.router.patch(
      "/:id",
      AuthMiddleware.authenticate,
      AuthMiddleware.authorizeRoles(RoleCode.SUPER_USER, RoleCode.PARTNER),
      this.controller.update
    );

    this.router.post(
      "/:id/slots",
      AuthMiddleware.authenticate,
      AuthMiddleware.authorizeRoles(RoleCode.SUPER_USER, RoleCode.PARTNER),
      this.controller.addSlot
    );

    this.router.patch(
      "/:id/slots/:slotId",
      AuthMiddleware.authenticate,
      AuthMiddleware.authorizeRoles(RoleCode.SUPER_USER, RoleCode.PARTNER),
      this.controller.updateSlot
    );

    registerRoutes("Experiencias", [
      {
        method: "get",
        path: "/api/v1/experiences",
        summary:
          "Catálogo público de experiencias activas de operadores activos, con filtros",
        auth: "none",
        query: experienceListQuerySchema,
      },
      {
        method: "get",
        path: "/api/v1/experiences/availability",
        summary:
          "Turnos abiertos de una fecha con cupo suficiente (aforo - reservado)",
        auth: "none",
        query: experienceAvailabilityQuerySchema,
      },
      {
        method: "get",
        path: "/api/v1/experiences/mine",
        summary: "Experiencias del operador autenticado (el admin ve todas)",
        auth: "user",
        roles: [RoleCode.SUPER_USER, RoleCode.PARTNER],
        query: paginationSchema,
      },
      {
        method: "get",
        path: "/api/v1/experiences/:id",
        summary: "Detalle con los próximos turnos abiertos",
        auth: "none",
      },
      {
        method: "post",
        path: "/api/v1/experiences",
        summary: "Crea una experiencia (solo operadores de atractivos)",
        auth: "user",
        roles: [RoleCode.SUPER_USER, RoleCode.PARTNER],
        body: createExperienceSchema,
        successStatus: 201,
      },
      {
        method: "patch",
        path: "/api/v1/experiences/:id",
        summary: "Actualiza precio, duración, requisitos o estado",
        auth: "user",
        roles: [RoleCode.SUPER_USER, RoleCode.PARTNER],
        body: updateExperienceSchema,
      },
      {
        method: "post",
        path: "/api/v1/experiences/:id/slots",
        summary: "Agrega un turno (fecha + hora + aforo)",
        auth: "user",
        roles: [RoleCode.SUPER_USER, RoleCode.PARTNER],
        body: createSlotSchema,
        successStatus: 201,
      },
      {
        method: "patch",
        path: "/api/v1/experiences/:id/slots/:slotId",
        summary: "Actualiza el aforo o cierra un turno",
        auth: "user",
        roles: [RoleCode.SUPER_USER, RoleCode.PARTNER],
        body: updateSlotSchema,
      },
    ]);
  }
}
