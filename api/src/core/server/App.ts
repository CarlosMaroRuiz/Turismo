import express, {
  type Application,
  type Request,
  type Response,
} from "express";
import { METACONFIG } from "../metaconfig/index.js";
import { ApiResponse } from "../http/ApiResponse.js";
import { ApiRouter } from "../routes/ApiRouter.js";
import { ErrorMiddleware } from "../middlewares/ErrorMiddleware/index.js";
import { RequestContext } from "../middlewares/RequestContext/index.js";
import { SecurityMiddleware } from "../middlewares/Security/index.js";
import { RateLimit } from "../middlewares/RateLimit/index.js";

export class App {
  public readonly instance: Application;
  private readonly env: string;

  constructor() {
    this.instance = express();
    this.env = METACONFIG.server.env;

    // No anunciar el framework en cada respuesta.
    this.instance.disable("x-powered-by");

    this.configureMiddlewares();
    this.configureRoutes();
    this.configureErrorHandling();
  }

  private configureMiddlewares(): void {
    this.instance.use(RequestContext.handle);
    this.instance.use(SecurityMiddleware.headers);
    this.instance.use(SecurityMiddleware.cors);
    this.instance.use("/api/v1/bookings/paypal/webhook", express.raw({ type: "application/json", limit: "100kb" }));
    this.instance.use(express.json({ limit: "100kb" }));
    this.instance.use(express.urlencoded({ extended: true, limit: "100kb" }));
    this.instance.use(RateLimit.global);
  }

  private configureRoutes(): void {
    this.instance.get("/health", (_req: Request, res: Response) => {
      ApiResponse.ok(
        res,
        {
          service: "turismo-api",
          env: this.env,
          timestamp: new Date().toISOString(),
        },
        "Servicio operativo"
      );
    });

    // Prefijo versionado: /api/v1. Los equipos externos integran contra esta versión.
    this.instance.use("/api/v1", new ApiRouter().router);
  }

  private configureErrorHandling(): void {
    this.instance.use(ErrorMiddleware.notFound);
    this.instance.use(ErrorMiddleware.handle);
  }
}
