import { HttpError } from "./HttpError.js";

export class ConflictError extends HttpError {
  constructor(
    message = "El recurso ya existe o entra en conflicto",
    code = "CONFLICT"
  ) {
    super(409, message, { code });
  }
}
