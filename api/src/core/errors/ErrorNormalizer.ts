import { QueryFailedError } from "typeorm";
import { ZodError } from "zod";
import { HttpError } from "./HttpError.js";
import { BadRequestError } from "./BadRequestError.js";
import { ConflictError } from "./ConflictError.js";
import { ValidationError } from "./ValidationError.js";

export class ErrorNormalizer {
  /**
   * Traduce excepciones nativas (Zod, Express, TypeORM, MySQL) a subclases de HttpError.
   * Cada una lleva un código estable además del mensaje en español.
   */
  public static normalize(err: unknown): Error {
    if (err instanceof HttpError) {
      return err;
    }

    // Errores de validación de esquemas Zod (422)
    if (err instanceof ZodError) {
      const fieldErrors: Record<string, string[]> = {};

      for (const issue of err.issues) {
        const path = issue.path.length > 0 ? issue.path.join(".") : "_root";
        if (!fieldErrors[path]) {
          fieldErrors[path] = [];
        }
        fieldErrors[path].push(issue.message);
      }

      return new ValidationError(fieldErrors);
    }

    // JSON malformado enviado por el cliente en express.json()
    if (err instanceof SyntaxError && "body" in err) {
      return new BadRequestError(
        "El cuerpo de la petición no es un JSON válido",
        "INVALID_JSON"
      );
    }

    // Errores comunes de MySQL a través de TypeORM
    if (err instanceof QueryFailedError) {
      const driverError = err.driverError as { code?: string };

      if (driverError?.code === "ER_DUP_ENTRY") {
        return new ConflictError(
          "Ya existe un registro con esos datos",
          "DUPLICATE_RESOURCE"
        );
      }

      if (driverError?.code === "ER_NO_REFERENCED_ROW_2") {
        return new BadRequestError(
          "El recurso relacionado indicado no existe",
          "RELATED_RESOURCE_NOT_FOUND"
        );
      }

      if (driverError?.code === "ER_ROW_IS_REFERENCED_2") {
        return new ConflictError(
          "El recurso está en uso y no se puede eliminar",
          "RESOURCE_IN_USE"
        );
      }
    }

    if (err instanceof Error) {
      return err;
    }

    return new Error(String(err));
  }
}
