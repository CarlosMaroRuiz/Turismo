import { BaseRoutes } from "../../../core/routes/BaseRoutes.js";
import { AuthMiddleware } from "../../../core/middlewares/AuthMiddleware/index.js";
import { RateLimit } from "../../../core/middlewares/RateLimit/index.js";
import { registerRoutes } from "../../../core/http/openapi/index.js";
import { loginSchema } from "../dto/login.dto.js";
import { activateAccountSchema } from "../dto/activate-account.dto.js";
import { refreshSchema } from "../dto/refresh.dto.js";
import { logoutSchema } from "../dto/logout.dto.js";
import { changePasswordSchema } from "../dto/change-password.dto.js";
import { serviceTokenSchema } from "../dto/service-token.dto.js";
import { AuthController } from "../controller/AuthController.js";

export class AuthRoutes extends BaseRoutes<AuthController> {
  constructor() {
    super(AuthController);
  }

  protected initRoutes(): void {
    // Públicos, con límite estricto por IP (fuerza bruta / enumeración)
    this.router.post("/login", RateLimit.auth, this.controller.login);
    this.router.post("/activate", RateLimit.auth, this.controller.activate);
    this.router.post("/refresh", RateLimit.auth, this.controller.refresh);
    // Logout no exige access token: puede llegar con la sesión ya vencida.
    this.router.post("/logout", RateLimit.auth, this.controller.logout);
    // Credenciales de servicio (máquina a máquina)
    this.router.post(
      "/service-token",
      RateLimit.auth,
      this.controller.serviceToken
    );

    // Autenticados
    this.router.post(
      "/change-password",
      RateLimit.auth,
      AuthMiddleware.authenticate,
      this.controller.changePassword
    );

    this.router.get("/me", AuthMiddleware.authenticate, this.controller.me);

    registerRoutes("Autenticación", [
      {
        method: "post",
        path: "/api/v1/auth/login",
        summary: "Inicia sesión y emite access token + refresh token",
        auth: "none",
        body: loginSchema,
      },
      {
        method: "post",
        path: "/api/v1/auth/activate",
        summary:
          "Activa la cuenta con el token del correo y define la contraseña",
        auth: "none",
        body: activateAccountSchema,
      },
      {
        method: "post",
        path: "/api/v1/auth/refresh",
        summary: "Rota el refresh token y emite un par nuevo",
        auth: "none",
        body: refreshSchema,
      },
      {
        method: "post",
        path: "/api/v1/auth/logout",
        summary: "Revoca el refresh token indicado",
        auth: "none",
        body: logoutSchema,
      },
      {
        method: "post",
        path: "/api/v1/auth/service-token",
        summary:
          "Emite un token de servicio con los scopes de la credencial (sin refresh)",
        auth: "none",
        body: serviceTokenSchema,
      },
      {
        method: "post",
        path: "/api/v1/auth/change-password",
        summary:
          "Cambia la contraseña; cierra las demás sesiones y limpia mustChangePassword",
        auth: "user",
        body: changePasswordSchema,
      },
      {
        method: "get",
        path: "/api/v1/auth/me",
        summary: "Perfil del usuario autenticado",
        auth: "user",
      },
    ]);
  }
}
