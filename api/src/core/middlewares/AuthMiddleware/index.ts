import type { Request, Response, NextFunction } from "express";
import { AppDataSource } from "../../bd/index.js";
import { User, UserStatus } from "../../bd/entities/User.js";
import { PartnerUser } from "../../bd/entities/PartnerUser.js";
import { PartnerStatus } from "../../bd/entities/Partner.js";
import { RoleCode } from "../../bd/entities/Role.js";
import {
  ForbiddenError,
  PasswordChangeRequiredError,
  UnauthorizedError,
} from "../../errors/index.js";
import { tokenService } from "../../auth/tokens/TokenService.js";
import type { JwtUserPayload } from "./type.js";

export type {
  AccessTokenPayload,
  JwtServicePayload,
  JwtUserPayload,
  ServicePrincipal,
} from "./type.js";

/**
 * Rutas que un usuario con contraseña pendiente sí puede usar.
 * Todo lo demás responde 403 PASSWORD_CHANGE_REQUIRED.
 */
const PASSWORD_CHANGE_ALLOWED_PATHS = [
  "/auth/change-password",
  "/auth/logout",
  "/auth/refresh",
  "/auth/me",
];

export class AuthMiddleware {
  /**
   * Valida el access token y, además, el estado real en base de datos:
   * cuenta activa, `token_version` vigente, vínculo con el socio activo y
   * socio no suspendido. Cierra la ventana de "token válido tras suspensión".
   */
  public static authenticate = async (
    req: Request,
    _res: Response,
    next: NextFunction
  ): Promise<void> => {
    try {
      const authHeader = req.headers.authorization;

      if (!authHeader || !authHeader.startsWith("Bearer ")) {
        throw new UnauthorizedError(
          "Token de autenticación requerido",
          "TOKEN_REQUIRED"
        );
      }

      const payload = tokenService.verifyAccessToken(authHeader.slice(7).trim());

      if (payload.type === "service") {
        throw new ForbiddenError(
          "Esta ruta requiere un token de usuario, no una credencial de servicio",
          "USER_TOKEN_REQUIRED"
        );
      }

      const user = await AppDataSource.getRepository(User).findOne({
        where: { id: payload.userId },
        relations: { role: true },
      });

      if (!user) {
        throw new UnauthorizedError(
          "La cuenta ya no existe",
          "ACCOUNT_NOT_FOUND"
        );
      }

      if (user.status !== UserStatus.ACTIVE) {
        throw new UnauthorizedError(
          "La cuenta no está activa",
          "ACCOUNT_INACTIVE"
        );
      }

      if ((payload.tokenVersion ?? 0) !== user.tokenVersion) {
        throw new UnauthorizedError(
          "La sesión fue invalidada. Inicia sesión de nuevo.",
          "TOKEN_REVOKED"
        );
      }

      const actor: JwtUserPayload = {
        type: "user",
        userId: user.id,
        email: user.email,
        role: user.role.code,
        tokenVersion: user.tokenVersion,
      };

      if (user.role.code !== RoleCode.SUPER_USER) {
        const link = await AppDataSource.getRepository(PartnerUser).findOne({
          where: { userId: user.id, isActive: true },
          relations: { partner: true },
        });

        if (!link) {
          throw new ForbiddenError(
            "Tu acceso al socio fue revocado",
            "PARTNER_ACCESS_REVOKED"
          );
        }

        if (link.partner.status !== PartnerStatus.ACTIVE) {
          throw new ForbiddenError(
            "La agencia asociada no se encuentra activa",
            "PARTNER_INACTIVE"
          );
        }

        actor.partnerId = link.partnerId;
        actor.partnerRole = link.role;
      }

      req.user = actor;

      const path = req.originalUrl.split("?")[0] ?? "";
      const isAllowed = PASSWORD_CHANGE_ALLOWED_PATHS.some((allowed) =>
        path.endsWith(allowed)
      );

      if (user.mustChangePassword && !isAllowed) {
        throw new PasswordChangeRequiredError();
      }

      next();
    } catch (error) {
      next(error);
    }
  };

  /** Autenticación de integraciones (máquina a máquina). */
  public static authenticateService = async (
    req: Request,
    _res: Response,
    next: NextFunction
  ): Promise<void> => {
    try {
      const authHeader = req.headers.authorization;

      if (!authHeader || !authHeader.startsWith("Bearer ")) {
        throw new UnauthorizedError(
          "Token de servicio requerido",
          "SERVICE_TOKEN_REQUIRED"
        );
      }

      const payload = tokenService.verifyAccessToken(authHeader.slice(7).trim());

      if (payload.type !== "service") {
        throw new ForbiddenError(
          "Se requiere una credencial de servicio",
          "SERVICE_TOKEN_REQUIRED"
        );
      }

      req.service = {
        clientId: payload.clientId,
        scopes: payload.scopes,
      };

      next();
    } catch (error) {
      next(error);
    }
  };

  /**
   * Autenticación opcional: si hay token válido deja req.user; si falta o es
   * inválido continúa como anónimo. Sirve para endpoints públicos que muestran
   * más información al dueño (por ejemplo un paquete en borrador).
   */
  public static optional = async (
    req: Request,
    res: Response,
    next: NextFunction
  ): Promise<void> => {
    const authHeader = req.headers.authorization;

    if (!authHeader || !authHeader.startsWith("Bearer ")) {
      next();
      return;
    }

    let failure: unknown;

    await AuthMiddleware.authenticate(req, res, (error?: unknown) => {
      if (error !== undefined && error !== null) {
        failure = error;
      }
    });

    if (failure !== undefined) {
      delete req.user;
    }

    next();
  };

  /** Verifica que la credencial de servicio tenga todos los permisos indicados. */
  public static requireScopes = (...requiredScopes: string[]) => {
    return (req: Request, _res: Response, next: NextFunction): void => {
      const granted = req.service?.scopes ?? [];
      const missing = requiredScopes.filter(
        (scope) => !granted.includes(scope)
      );

      if (missing.length > 0) {
        throw new ForbiddenError(
          `La credencial no tiene el permiso: ${missing.join(", ")}`,
          "INSUFFICIENT_SCOPE"
        );
      }

      next();
    };
  };

  public static authorizeRoles = (...allowedRoles: string[]) => {
    return (req: Request, _res: Response, next: NextFunction): void => {
      if (!req.user) {
        throw new UnauthorizedError("Usuario no autenticado", "TOKEN_REQUIRED");
      }

      if (!allowedRoles.includes(req.user.role)) {
        throw new ForbiddenError(
          "No tienes permisos para realizar esta acción",
          "ROLE_NOT_ALLOWED"
        );
      }

      next();
    };
  };

  public static requirePartner = (
    req: Request,
    _res: Response,
    next: NextFunction
  ): void => {
    if (!req.user?.partnerId) {
      throw new ForbiddenError(
        "Esta operación requiere una agencia/partner vinculado",
        "PARTNER_REQUIRED"
      );
    }

    next();
  };
}
