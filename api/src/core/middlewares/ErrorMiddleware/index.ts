import type { Request, Response, NextFunction } from "express";
import { METACONFIG } from "../../metaconfig/index.js";
import { ApiResponse } from "../../http/ApiResponse.js";
import {
  HttpError,
  NotFoundError,
  ErrorNormalizer,
} from "../../errors/index.js";

export class ErrorMiddleware {
  /**
   * Maneja cualquier ruta no registrada en la aplicación (404).
   */
  public static notFound = (
    _req: Request,
    _res: Response,
    next: NextFunction
  ): void => {
    next(new NotFoundError("Ruta no encontrada", "ROUTE_NOT_FOUND"));
  };

  /**
   * Manejador global de errores (Express 5 captura promesas rechazadas automáticamente).
   */
  public static handle = (
    err: unknown,
    req: Request,
    res: Response,
    _next: NextFunction
  ): void => {
    const normalizedError = ErrorNormalizer.normalize(err);

    if (normalizedError instanceof HttpError) {
      ApiResponse.error(
        res,
        normalizedError.statusCode,
        normalizedError.message,
        normalizedError.code,
        normalizedError.errors
      );
      return;
    }

    console.error(
      JSON.stringify({
        level: "error",
        msg: "unhandled_error",
        requestId: res.locals.requestId,
        method: req.method,
        path: req.originalUrl,
        error: err instanceof Error ? err.message : String(err),
      })
    );

    const message = METACONFIG.server.isProduction
      ? "Error interno del servidor"
      : normalizedError.message || "Error interno del servidor";

    ApiResponse.error(res, 500, message, "INTERNAL_ERROR");
  };
}
