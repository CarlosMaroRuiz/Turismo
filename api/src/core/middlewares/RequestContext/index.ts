import crypto from "node:crypto";
import type { Request, Response, NextFunction } from "express";

/**
 * Asigna un identificador a cada petición y deja una línea de log estructurada.
 * El id viaja en la respuesta para poder cruzar el error del cliente con el log.
 */
export class RequestContext {
  public static handle = (
    req: Request,
    res: Response,
    next: NextFunction
  ): void => {
    const incoming = req.header("x-request-id");
    const requestId =
      incoming !== undefined && incoming.length > 0 && incoming.length <= 128
        ? incoming
        : crypto.randomUUID();

    res.locals.requestId = requestId;
    res.setHeader("X-Request-Id", requestId);

    const startedAt = Date.now();

    res.on("finish", () => {
      console.log(
        JSON.stringify({
          level: "info",
          msg: "request",
          requestId,
          method: req.method,
          path: req.originalUrl,
          status: res.statusCode,
          durationMs: Date.now() - startedAt,
        })
      );
    });

    next();
  };
}
