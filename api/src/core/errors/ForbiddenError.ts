import { HttpError } from "./HttpError.js";

export class ForbiddenError extends HttpError {
  constructor(
    message = "No tienes permisos para realizar esta acción",
    code = "FORBIDDEN"
  ) {
    super(403, message, { code });
  }
}
