import type { Request, Response } from "express";
import { ApiResponse } from "../../../core/http/ApiResponse.js";
import type { SessionMeta } from "../../../core/auth/tokens/TokenService.js";
import { serviceTokenService } from "../../../core/auth/clients/ServiceTokenService.js";
import { loginSchema } from "../dto/login.dto.js";
import { activateAccountSchema } from "../dto/activate-account.dto.js";
import { refreshSchema } from "../dto/refresh.dto.js";
import { logoutSchema } from "../dto/logout.dto.js";
import { changePasswordSchema } from "../dto/change-password.dto.js";
import { serviceTokenSchema } from "../dto/service-token.dto.js";
import { AuthService } from "../services/AuthService.js";

export class AuthController {
  private readonly authService = new AuthService();

  /** Metadatos de la sesión para poder auditar y revocar por dispositivo. */
  private sessionMeta(req: Request): SessionMeta {
    return {
      userAgent: req.header("user-agent"),
      ip: req.ip,
    };
  }

  public login = async (req: Request, res: Response): Promise<void> => {
    const dto = loginSchema.parse(req.body ?? {});
    const result = await this.authService.login(dto, this.sessionMeta(req));

    ApiResponse.ok(res, result, "Inicio de sesión exitoso");
  };

  public refresh = async (req: Request, res: Response): Promise<void> => {
    const dto = refreshSchema.parse(req.body ?? {});
    const result = await this.authService.refresh(dto, this.sessionMeta(req));

    ApiResponse.ok(res, result, "Sesión renovada correctamente");
  };

  public logout = async (req: Request, res: Response): Promise<void> => {
    const dto = logoutSchema.parse(req.body ?? {});
    await this.authService.logout(dto);

    ApiResponse.ok(res, null, "Sesión cerrada correctamente");
  };

  public changePassword = async (
    req: Request,
    res: Response
  ): Promise<void> => {
    const dto = changePasswordSchema.parse(req.body ?? {});
    const result = await this.authService.changePassword(
      req.user!.userId,
      dto,
      this.sessionMeta(req)
    );

    ApiResponse.ok(
      res,
      result,
      "Contraseña actualizada. Las demás sesiones fueron cerradas."
    );
  };

  /** Credenciales de servicio (client id + secreto) → token con scopes. */
  public serviceToken = async (req: Request, res: Response): Promise<void> => {
    const dto = serviceTokenSchema.parse(req.body ?? {});
    const result = await serviceTokenService.issue(dto.clientId, dto.secret);

    ApiResponse.ok(res, result, "Token de servicio emitido");
  };

  public me = async (req: Request, res: Response): Promise<void> => {
    const profile = await this.authService.getProfile(req.user!.userId);
    ApiResponse.ok(res, profile, "Perfil obtenido correctamente");
  };

  public activate = async (req: Request, res: Response): Promise<void> => {
    const dto = activateAccountSchema.parse(req.body ?? {});
    await this.authService.activateAccount(dto);

    ApiResponse.ok(
      res,
      null,
      "Cuenta activada correctamente. Ya puedes iniciar sesión."
    );
  };
}
