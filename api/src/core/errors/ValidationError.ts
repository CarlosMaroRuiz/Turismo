import { HttpError } from "./HttpError.js";

export class ValidationError extends HttpError {
  constructor(
    errors: Record<string, string[]>,
    message = "Error de validación en los datos enviados"
  ) {
    super(422, message, { code: "VALIDATION_ERROR", errors });
  }
}
