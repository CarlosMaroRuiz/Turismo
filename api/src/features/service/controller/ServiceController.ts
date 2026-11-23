import type { Request, Response } from "express";
import { ApiResponse } from "../../../core/http/ApiResponse.js";

/** Rutas de verificación para integraciones (el catálogo llega en el paso 6). */
export class ServiceController {
  public whoami = async (req: Request, res: Response): Promise<void> => {
    ApiResponse.ok(
      res,
      {
        clientId: req.service?.clientId,
        scopes: req.service?.scopes ?? [],
      },
      "Credencial de servicio válida"
    );
  };
}
