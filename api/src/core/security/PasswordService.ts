import crypto from "node:crypto";
import bcrypt from "bcryptjs";
import { METACONFIG } from "../metaconfig/index.js";

/**
 * Única puerta para contraseñas y secretos. Antes había tres implementaciones
 * con costos distintos (10 y 12 rondas); ahora el costo vive en configuración.
 */
export class PasswordService {
  public static hash(plain: string): Promise<string> {
    return bcrypt.hash(plain, METACONFIG.security.bcryptRounds);
  }

  public static verify(plain: string, hash: string): Promise<boolean> {
    return bcrypt.compare(plain, hash);
  }

  /** Token en claro para enviar por correo o devolver al cliente (nunca se guarda así). */
  public static generateToken(bytes = 32): string {
    return crypto.randomBytes(bytes).toString("hex");
  }

  /** Hash determinista para tokens opacos que solo se buscan por igualdad. */
  public static sha256(value: string): string {
    return crypto.createHash("sha256").update(value).digest("hex");
  }
}
