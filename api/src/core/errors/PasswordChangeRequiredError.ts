import { HttpError } from "./HttpError.js";

/**
 * La cuenta está autenticada pero el usuario debe cambiar su contraseña antes
 * de operar. El frontend usa el código para redirigir al formulario.
 */
export class PasswordChangeRequiredError extends HttpError {
  constructor(
    message = "Debes cambiar tu contraseña antes de continuar",
    code = "PASSWORD_CHANGE_REQUIRED"
  ) {
    super(403, message, { code });
  }
}
