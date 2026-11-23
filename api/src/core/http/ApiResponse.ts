import type { Response } from "express";
import type {
  ApiErrorResponse,
  ApiSuccessResponse,
  PaginationMeta,
} from "./api-response.types.js";

export class ApiResponse {
  public static ok<T>(
    res: Response,
    data: T,
    message = "Operación exitosa",
    meta?: PaginationMeta
  ): void {
    const payload: ApiSuccessResponse<T> = {
      ok: true,
      message,
      data,
      ...(meta && { meta }),
    };
    res.status(200).json(payload);
  }

  public static paginated<T>(
    res: Response,
    data: T,
    meta: PaginationMeta,
    message = "Operación exitosa"
  ): void {
    this.ok(res, data, message, meta);
  }

  public static created<T>(
    res: Response,
    data: T,
    message = "Recurso creado correctamente"
  ): void {
    const payload: ApiSuccessResponse<T> = {
      ok: true,
      message,
      data,
    };
    res.status(201).json(payload);
  }

  public static error(
    res: Response,
    statusCode: number,
    message: string,
    code = "ERROR",
    errors?: Record<string, string[]>
  ): void {
    const payload: ApiErrorResponse = {
      ok: false,
      code,
      message,
      ...(errors && { errors }),
    };
    res.status(statusCode).json(payload);
  }
}
