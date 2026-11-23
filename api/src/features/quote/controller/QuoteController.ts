import type { Request, Response } from "express";
import { ApiResponse } from "../../../core/http/ApiResponse.js";
import { BadRequestError } from "../../../core/errors/index.js";
import { createQuoteSchema } from "../dto/index.js";
import { QuoteService } from "../services/QuoteService.js";

export class QuoteController {
  private readonly quoteService = new QuoteService();

  public create = async (req: Request, res: Response): Promise<void> => {
    const dto = createQuoteSchema.parse(req.body ?? {});
    const data = await this.quoteService.create(dto, req.service!.clientId);

    ApiResponse.created(
      res,
      data,
      `Cotización ${data.reference} generada. Vence en ${
        Math.round(
          (new Date(data.expiresAt).getTime() - Date.now()) / 60000
        ) || 1
      } minutos.`
    );
  };

  public getById = async (req: Request, res: Response): Promise<void> => {
    const id = req.params.id;
    if (!id || typeof id !== "string") {
      throw new BadRequestError(
        "El ID de la cotización es requerido",
        "QUOTE_ID_REQUIRED"
      );
    }

    const data = await this.quoteService.getById(id, req.service!.clientId);
    ApiResponse.ok(res, data, "Cotización obtenida correctamente");
  };
}
