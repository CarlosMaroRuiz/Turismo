import { BaseRoutes } from "../../../core/routes/BaseRoutes.js";
import { AuthMiddleware } from "../../../core/middlewares/AuthMiddleware/index.js";
import { RoleCode } from "../../../core/bd/entities/Role.js";
import { registerRoutes } from "../../../core/http/openapi/index.js";
import {
  createPartnerCategorySchema,
  updatePartnerCategorySchema,
} from "../dto/index.js";
import { PartnerCategoryController } from "../controller/PartnerCategoryController.js";

export class PartnerCategoryRoutes extends BaseRoutes<PartnerCategoryController> {
  constructor() {
    super(PartnerCategoryController);
  }

  protected initRoutes(): void {
    // Consultas públicas (catálogo y formulario de registro de socios)
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

    this.router.delete(
      "/:id",
      AuthMiddleware.authenticate,
      AuthMiddleware.authorizeRoles(RoleCode.SUPER_USER),
      this.controller.remove
    );

    registerRoutes("Categorías de socio", [
      {
        method: "get",
        path: "/api/v1/partner-categories",
        summary: "Lista las categorías activas (includeInactive=true para todas)",
        auth: "none",
      },
      {
        method: "get",
        path: "/api/v1/partner-categories/:id",
        summary: "Detalle de una categoría",
        auth: "none",
      },
      {
        method: "post",
        path: "/api/v1/partner-categories",
        summary: "Crea una categoría de socio",
        auth: "user",
        roles: [RoleCode.SUPER_USER],
        body: createPartnerCategorySchema,
        successStatus: 201,
      },
      {
        method: "patch",
        path: "/api/v1/partner-categories/:id",
        summary: "Actualiza nombre o estado de la categoría",
        auth: "user",
        roles: [RoleCode.SUPER_USER],
        body: updatePartnerCategorySchema,
      },
      {
        method: "patch",
        path: "/api/v1/partner-categories/:id/toggle-status",
        summary: "Alterna activa/inactiva",
        auth: "user",
        roles: [RoleCode.SUPER_USER],
      },
      {
        method: "delete",
        path: "/api/v1/partner-categories/:id",
        summary: "Baja lógica de la categoría (isActive=false)",
        auth: "user",
        roles: [RoleCode.SUPER_USER],
      },
    ]);
  }
}
