import jwt, { type SignOptions } from "jsonwebtoken";
import { AppDataSource } from "../../bd/index.js";
import { RefreshToken } from "../../bd/entities/RefreshToken.js";
import { User } from "../../bd/entities/User.js";
import { METACONFIG } from "../../metaconfig/index.js";
import { PasswordService } from "../../security/PasswordService.js";
import { UnauthorizedError } from "../../errors/index.js";
import type {
  AccessTokenPayload,
  JwtUserPayload,
} from "../../middlewares/AuthMiddleware/type.js";

export interface SessionMeta {
  userAgent?: string | undefined;
  ip?: string | undefined;
}

export interface IssuedTokens {
  accessToken: string;
  refreshToken: string;
  /** TTL del access token, para que el cliente sepa cuándo renovar. */
  expiresIn: string;
}

export interface IssuedServiceToken {
  accessToken: string;
  tokenType: "Bearer";
  expiresIn: string;
  scopes: string[];
}

const ACCESS_TOKEN_TTL = METACONFIG.security.accessTokenTtl as Exclude<
  SignOptions["expiresIn"],
  undefined
>;

export class TokenService {
  private get refreshRepo() {
    return AppDataSource.getRepository(RefreshToken);
  }

  public signAccessToken(payload: AccessTokenPayload): string {
    return jwt.sign(payload, METACONFIG.jwt.secret, {
      expiresIn: ACCESS_TOKEN_TTL,
    });
  }

  public verifyAccessToken(token: string): AccessTokenPayload {
    try {
      return jwt.verify(token, METACONFIG.jwt.secret) as AccessTokenPayload;
    } catch (error) {
      if (error instanceof jwt.TokenExpiredError) {
        throw new UnauthorizedError(
          "Tu sesión expiró. Renueva el token o inicia sesión de nuevo.",
          "TOKEN_EXPIRED"
        );
      }
      throw new UnauthorizedError(
        "Token de autenticación inválido",
        "INVALID_TOKEN"
      );
    }
  }

  public async issue(
    payload: JwtUserPayload,
    meta: SessionMeta
  ): Promise<IssuedTokens> {
    const plainToken = PasswordService.generateToken(48);
    const expiresAt = new Date(
      Date.now() + METACONFIG.security.refreshTokenDays * 24 * 60 * 60 * 1000
    );

    const repository = this.refreshRepo;
    const entity = repository.create({
      userId: payload.userId,
      tokenHash: PasswordService.sha256(plainToken),
      expiresAt,
      revokedAt: null,
      userAgent: meta.userAgent ?? null,
      ip: meta.ip ?? null,
    });
    await repository.save(entity);

    return {
      accessToken: this.signAccessToken(payload),
      refreshToken: plainToken,
      expiresIn: METACONFIG.security.accessTokenTtl,
    };
  }

  /** Token de servicio: corto, sin refresh, con los scopes del cliente. */
  public issueServiceToken(clientId: string, scopes: string[]): IssuedServiceToken {
    return {
      accessToken: this.signAccessToken({
        type: "service",
        clientId,
        role: "service",
        scopes,
      }),
      tokenType: "Bearer",
      expiresIn: METACONFIG.security.accessTokenTtl,
      scopes,
    };
  }

  /**
   * Valida un refresh token y lo revoca en el mismo paso (rotación).
   * Devuelve el usuario al que pertenecía para que el llamador reemita la sesión.
   */
  public async consume(plainToken: string): Promise<{ userId: string }> {
    const repository = this.refreshRepo;
    const stored = await repository.findOne({
      where: { tokenHash: PasswordService.sha256(plainToken) },
    });

    if (!stored) {
      throw new UnauthorizedError(
        "Sesión inválida. Inicia sesión de nuevo.",
        "INVALID_REFRESH_TOKEN"
      );
    }

    if (stored.revokedAt !== null) {
      throw new UnauthorizedError(
        "La sesión ya fue cerrada. Inicia sesión de nuevo.",
        "REFRESH_TOKEN_REVOKED"
      );
    }

    if (stored.expiresAt.getTime() <= Date.now()) {
      throw new UnauthorizedError(
        "La sesión expiró. Inicia sesión de nuevo.",
        "REFRESH_TOKEN_EXPIRED"
      );
    }

    stored.revokedAt = new Date();
    await repository.save(stored);

    return { userId: stored.userId };
  }

  public async revoke(plainToken: string): Promise<void> {
    const repository = this.refreshRepo;
    const stored = await repository.findOne({
      where: { tokenHash: PasswordService.sha256(plainToken) },
    });

    if (!stored || stored.revokedAt !== null) {
      return;
    }

    stored.revokedAt = new Date();
    await repository.save(stored);
  }

  /**
   * Cierra todas las sesiones del usuario: revoca los refresh tokens vigentes
   * e incrementa `tokenVersion`, con lo que los access tokens en circulación
   * dejan de valer en la siguiente petición.
   */
  public async revokeAllForUser(userId: string): Promise<void> {
    const repository = this.refreshRepo;
    await repository
      .createQueryBuilder()
      .update(RefreshToken)
      .set({ revokedAt: new Date() })
      .where("user_id = :userId AND revoked_at IS NULL", { userId })
      .execute();

    await AppDataSource.getRepository(User).increment(
      { id: userId },
      "tokenVersion",
      1
    );
  }
}

export const tokenService = new TokenService();
