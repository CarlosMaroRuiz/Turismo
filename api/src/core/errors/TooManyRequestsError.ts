import { HttpError } from "./HttpError.js";

/**
 * 429: el cliente (o el agente) superó el límite de peticiones.
 * El código es estable para que el consumidor sepa que debe reintentar más tarde.
 */
export class TooManyRequestsError extends HttpError {
  constructor(
    message = "Demasiadas solicitudes. Intenta de nuevo más tarde.",
    code = "RATE_LIMITED"
  ) {
    super(429, message, { code });
  }
}
