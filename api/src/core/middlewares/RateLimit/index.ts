import rateLimit from "express-rate-limit";
import type { Request, RequestHandler, Response } from "express";
import { METACONFIG } from "../../metaconfig/index.js";
import { ApiResponse } from "../../http/ApiResponse.js";

function limitReached(_req: Request, res: Response): void {
  ApiResponse.error(
    res,
    429,
    "Demasiadas solicitudes. Intenta de nuevo más tarde.",
    "RATE_LIMITED"
  );
}

/**
 * Límites por IP en memoria (una instancia). Cuando haya varias instancias
 * se cambia el store por uno compartido (Redis) sin tocar los llamadores.
 */
export class RateLimit {
  /** Techo general: evita que un bot sature cualquier endpoint. */
  public static global: RequestHandler = rateLimit({
    windowMs: METACONFIG.rateLimit.windowMs,
    limit: METACONFIG.rateLimit.max,
    standardHeaders: "draft-8",
    legacyHeaders: false,
    handler: limitReached,
  });

  /** Login y activación: frena la fuerza bruta sobre contraseñas y tokens. */
  public static auth: RequestHandler = rateLimit({
    windowMs: METACONFIG.rateLimit.windowMs,
    limit: METACONFIG.rateLimit.authMax,
    standardHeaders: "draft-8",
    legacyHeaders: false,
    handler: limitReached,
  });

  /** Registro público de socios: frena el alta masiva de cuentas. */
  public static register: RequestHandler = rateLimit({
    windowMs: 60 * 60 * 1000,
    limit: METACONFIG.rateLimit.registerMax,
    standardHeaders: "draft-8",
    legacyHeaders: false,
    handler: limitReached,
  });
}
