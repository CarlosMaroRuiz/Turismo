import { HttpError } from "./HttpError.js";

export class BadRequestError extends HttpError {
  constructor(
    message = "Solicitud inválida",
    code = "BAD_REQUEST",
    errors?: Record<string, string[]>
  ) {
    super(400, message, { code, ...(errors !== undefined && { errors }) });
  }
}
