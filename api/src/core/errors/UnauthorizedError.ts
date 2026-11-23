import { HttpError } from "./HttpError.js";

export class UnauthorizedError extends HttpError {
  constructor(message = "No autorizado", code = "UNAUTHORIZED") {
    super(401, message, { code });
  }
}
