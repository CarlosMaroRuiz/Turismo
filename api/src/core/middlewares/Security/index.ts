import helmet from "helmet";
import cors from "cors";
import type { RequestHandler } from "express";
import { METACONFIG } from "../../metaconfig/index.js";

/**
 * Endurecimiento HTTP transversal.
 * - helmet: cabeceras de seguridad (CSP desactivada a propósito: el API solo devuelve JSON).
 * - cors: orígenes permitidos por configuración, nunca comodín en producción.
 */
export class SecurityMiddleware {
  public static headers: RequestHandler = helmet({
    contentSecurityPolicy: false,
    crossOriginResourcePolicy: { policy: "cross-origin" },
    // HSTS solo tiene sentido detrás de HTTPS (producción).
    ...(METACONFIG.server.isProduction ? {} : { hsts: false }),
  });

  public static cors: RequestHandler = cors({
    origin: (origin, callback) => {
      const allowedOrigins = METACONFIG.security.corsOrigins;

      // Sin Origin (curl, servidor a servidor, el agente): no aplica CORS.
      if (origin === undefined) {
        callback(null, true);
        return;
      }

      // Sin lista configurada se refleja el origen solo fuera de producción.
      if (allowedOrigins.length === 0) {
        callback(null, !METACONFIG.server.isProduction);
        return;
      }

      callback(null, allowedOrigins.includes(origin));
    },
    methods: ["GET", "POST", "PATCH", "PUT", "DELETE", "OPTIONS"],
    allowedHeaders: [
      "Content-Type",
      "Authorization",
      "X-Request-Id",
      "Idempotency-Key",
    ],
    exposedHeaders: ["X-Request-Id", "RateLimit", "RateLimit-Policy"],
    maxAge: 600,
  });
}
