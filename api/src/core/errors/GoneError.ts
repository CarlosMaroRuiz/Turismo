import { HttpError } from "./HttpError.js";

/** 410: el recurso existió pero ya no es válido (por ejemplo, una cotización vencida). */
export class GoneError extends HttpError {
  constructor(message = "El recurso ya no está disponible", code = "GONE") {
    super(410, message, { code });
  }
}
