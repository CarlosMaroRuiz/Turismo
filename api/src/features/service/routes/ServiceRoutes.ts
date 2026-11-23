import { BaseRoutes } from "../../../core/routes/BaseRoutes.js";
import { AuthMiddleware } from "../../../core/middlewares/AuthMiddleware/index.js";
import { registerRoutes } from "../../../core/http/openapi/index.js";
import { ServiceController } from "../controller/ServiceController.js";

export class ServiceRoutes extends BaseRoutes<ServiceController> {
  constructor() {
    super(ServiceController);
  }

  protected initRoutes(): void {
    this.router.get(
      "/whoami",
      AuthMiddleware.authenticateService,
      AuthMiddleware.requireScopes("catalog:read"),
      this.controller.whoami
    );

    registerRoutes("Servicio", [
      {
        method: "get",
        path: "/api/v1/service/whoami",
        summary:
          "Verifica la credencial de servicio y devuelve sus permisos (requiere catalog:read)",
        auth: "service",
      },
    ]);
  }
}
