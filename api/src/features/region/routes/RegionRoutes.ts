import { z } from "zod";
import { BaseRoutes } from "../../../core/routes/BaseRoutes.js";
import { AuthMiddleware } from "../../../core/middlewares/AuthMiddleware/index.js";
import { RoleCode } from "../../../core/bd/entities/Role.js";
import {
  RegionStatus,
  RegionType,
} from "../../../core/bd/entities/Region.entity.js";
import { paginationSchema } from "../../../core/http/pagination.js";
import { registerRoutes } from "../../../core/http/openapi/index.js";
import { createRegionSchema, updateRegionSchema } from "../dto/index.js";
import { RegionController } from "../controller/RegionController.js";

const listRegionsQuerySchema = paginationSchema.extend({
  stateId: z.string().uuid().optional(),
  type: z.nativeEnum(RegionType).optional(),
  parentId: z.string().uuid().optional(),
  status: z
    .enum([RegionStatus.ACTIVE, RegionStatus.INACTIVE, "all"])
    .optional()
    .describe("Por defecto solo activas; 'all' devuelve todas"),
  search: z.string().trim().max(100).optional(),
});

export class RegionRoutes extends BaseRoutes<RegionController> {
  constructor() {
    super(RegionController);
  }

  protected initRoutes(): void {
    // Consultas públicas (catálogo y formulario de registro de socios)
    this.router.get("/states", this.controller.listStates);
    this.router.get("/", this.controller.list);
    this.router.get("/:id", this.controller.getById);

    // Gestión administrativa (solo super_user)
    this.router.post(
      "/",
      AuthMiddleware.authenticate,
      AuthMiddleware.authorizeRoles(RoleCode.SUPER_USER),
      this.controller.create
    );

    this.router.patch(
      "/:id",
      AuthMiddleware.authenticate,
      AuthMiddleware.authorizeRoles(RoleCode.SUPER_USER),
      this.controller.update
    );

    this.router.patch(
      "/:id/toggle-status",
      AuthMiddleware.authenticate,
      AuthMiddleware.authorizeRoles(RoleCode.SUPER_USER),
      this.controller.toggleStatus
    );

    registerRoutes("Regiones", [
      {
        method: "get",
        path: "/api/v1/regions/states",
        summary: "Estados de la república (solo activos por defecto)",
        auth: "none",
      },
      {
        method: "get",
        path: "/api/v1/regions",
        summary: "Lista regiones con filtros y paginación",
        auth: "none",
        query: listRegionsQuerySchema,
      },
      {
        method: "get",
        path: "/api/v1/regions/:id",
        summary: "Detalle de una región con su estado y su padre",
        auth: "none",
      },
      {
        method: "post",
        path: "/api/v1/regions",
        summary: "Crea un municipio o una zona turística",
        auth: "user",
        roles: [RoleCode.SUPER_USER],
        body: createRegionSchema,
        successStatus: 201,
      },
      {
        method: "patch",
        path: "/api/v1/regions/:id",
        summary: "Actualiza nombre, slug, alias, coordenadas o estado",
        auth: "user",
        roles: [RoleCode.SUPER_USER],
        body: updateRegionSchema,
      },
      {
        method: "patch",
        path: "/api/v1/regions/:id/toggle-status",
        summary: "Alterna activa/inactiva",
        auth: "user",
        roles: [RoleCode.SUPER_USER],
      },
    ]);
  }
}
