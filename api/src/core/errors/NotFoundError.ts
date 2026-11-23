import { HttpError } from "./HttpError.js";

export class NotFoundError extends HttpError {
  constructor(message = "Recurso no encontrado", code = "NOT_FOUND") {
    super(404, message, { code });
  }
}
