import { BaseRoutes } from "../../../core/routes/BaseRoutes.js";
import { AuthMiddleware } from "../../../core/middlewares/AuthMiddleware/index.js";
import { registerRoutes } from "../../../core/http/openapi/index.js";
import { createQuoteSchema } from "../dto/index.js";
import { QuoteController } from "../controller/QuoteController.js";

/**
 * Cotizador: lo consume el servicio de LLM con su credencial (scope
 * `quote:write`). Recalcula contra la fuente y devuelve un `quoteId` con
 * vencimiento; el agente nunca calcula precios.
 */
export class QuoteRoutes extends BaseRoutes<QuoteController> {
  constructor() {
    super(QuoteController);
  }

  protected initRoutes(): void {
    this.router.post(
      "/",
      AuthMiddleware.authenticateService,
      AuthMiddleware.requireScopes("quote:write"),
      this.controller.create
    );

    this.router.get(
      "/:id",
      AuthMiddleware.authenticateService,
      AuthMiddleware.requireScopes("quote:write"),
      this.controller.getById
    );

    registerRoutes("Cotizaciones", [
      {
        method: "post",
        path: "/api/v1/quotes",
        summary:
          "Cotiza paquete, estancia y/o turno con desglose, promoción e impuestos; vence en 15 minutos",
        auth: "service",
        body: createQuoteSchema,
        successStatus: 201,
      },
      {
        method: "get",
        path: "/api/v1/quotes/:id",
        summary: "Devuelve una cotización vigente (410 QUOTE_EXPIRED si venció)",
        auth: "service",
      },
    ]);
  }
}
