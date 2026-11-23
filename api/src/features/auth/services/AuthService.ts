import { AppDataSource } from "../../../core/bd/index.js";
import { User, UserStatus } from "../../../core/bd/entities/User.js";
import { PartnerUser } from "../../../core/bd/entities/PartnerUser.js";
import { PartnerStatus } from "../../../core/bd/entities/Partner.js";
import { RoleCode } from "../../../core/bd/entities/Role.js";
import {
  UserToken,
  UserTokenType,
} from "../../../core/bd/entities/UserToken.js";
import {
  BadRequestError,
  ForbiddenError,
  NotFoundError,
  UnauthorizedError,
} from "../../../core/errors/index.js";
import { PasswordService } from "../../../core/security/PasswordService.js";
import {
  tokenService,
  type SessionMeta,
} from "../../../core/auth/tokens/TokenService.js";
import type { JwtUserPayload } from "../../../core/middlewares/AuthMiddleware/type.js";
import type { LoginDto } from "../dto/login.dto.js";
import type { ActivateAccountDto } from "../dto/activate-account.dto.js";
import type { RefreshDto } from "../dto/refresh.dto.js";
import type { LogoutDto } from "../dto/logout.dto.js";
import type { ChangePasswordDto } from "../dto/change-password.dto.js";
import type { LoginResponse, UserProfileResponse } from "../responses/index.js";

export class AuthService {
  private readonly userRepo = AppDataSource.getRepository(User);
  private readonly partnerUserRepo = AppDataSource.getRepository(PartnerUser);

  private async findByEmailWithPassword(email: string): Promise<User | null> {
    return this.userRepo
      .createQueryBuilder("user")
      .leftJoinAndSelect("user.role", "role")
      .addSelect("user.passwordHash")
      .where("user.email = :email", { email })
      .getOne();
  }

  private async findByIdWithPassword(userId: string): Promise<User | null> {
    return this.userRepo
      .createQueryBuilder("user")
      .leftJoinAndSelect("user.role", "role")
      .addSelect("user.passwordHash")
      .where("user.id = :userId", { userId })
      .getOne();
  }

  /** Solo vínculos vigentes: un miembro desactivado no debe poder operar. */
  private async findActivePartnerLink(
    userId: string
  ): Promise<PartnerUser | null> {
    return this.partnerUserRepo.findOne({
      where: { userId, isActive: true },
      relations: { partner: { category: true } },
    });
  }

  private assertPartnerOperable(link: PartnerUser): void {
    if (link.partner.status !== PartnerStatus.ACTIVE) {
      throw new ForbiddenError(
        "La agencia asociada aún no se encuentra activa",
        "PARTNER_INACTIVE"
      );
    }
  }

  private async buildSession(
    user: User,
    roleCode: string,
    partnerLink: PartnerUser | null,
    meta: SessionMeta
  ): Promise<LoginResponse> {
    const payload: JwtUserPayload = {
      userId: user.id,
      email: user.email,
      role: roleCode,
      tokenVersion: user.tokenVersion,
      ...(partnerLink !== null && {
        partnerId: partnerLink.partnerId,
        partnerRole: partnerLink.role,
      }),
    };

    const tokens = await tokenService.issue(payload, meta);

    return {
      ...tokens,
      user: {
        id: user.id,
        name: user.name,
        email: user.email,
        role: roleCode,
        mustChangePassword: user.mustChangePassword,
        partner: partnerLink
          ? {
              id: partnerLink.partnerId,
              commercialName: partnerLink.partner?.commercialName ?? "",
              categoryId: partnerLink.partner?.categoryId ?? "",
              categoryCode: partnerLink.partner?.category?.code ?? "",
              logoUrl: partnerLink.partner?.logoUrl ?? null,
              role: partnerLink.role,
            }
          : null,
      },
    };
  }

  public async login(
    { email, password }: LoginDto,
    meta: SessionMeta
  ): Promise<LoginResponse> {
    // passwordHash tiene select: false en la entidad, se pide con addSelect
    const user = await this.findByEmailWithPassword(email);

    if (!user || !user.passwordHash) {
      throw new UnauthorizedError("Credenciales inválidas", "INVALID_CREDENTIALS");
    }

    if (user.status !== UserStatus.ACTIVE) {
      throw new ForbiddenError(
        "La cuenta aún no está activa o se encuentra suspendida",
        "ACCOUNT_INACTIVE"
      );
    }

    const isMatch = await PasswordService.verify(password, user.passwordHash);
    if (!isMatch) {
      throw new UnauthorizedError("Credenciales inválidas", "INVALID_CREDENTIALS");
    }

    const roleCode = user.role.code;
    const partnerLink = await this.findActivePartnerLink(user.id);

    if (roleCode === RoleCode.PARTNER && !partnerLink) {
      throw new ForbiddenError(
        "Tu acceso al socio fue revocado",
        "PARTNER_ACCESS_REVOKED"
      );
    }

    if (partnerLink) {
      this.assertPartnerOperable(partnerLink);
    }

    await this.userRepo.update(user.id, { lastLoginAt: new Date() });

    return this.buildSession(user, roleCode, partnerLink, meta);
  }

  public async refresh(
    dto: RefreshDto,
    meta: SessionMeta
  ): Promise<LoginResponse> {
    const { userId } = await tokenService.consume(dto.refreshToken);

    const user = await this.userRepo.findOne({
      where: { id: userId },
      relations: { role: true },
    });

    if (!user) {
      throw new UnauthorizedError("La cuenta no existe", "ACCOUNT_NOT_FOUND");
    }

    if (user.status !== UserStatus.ACTIVE) {
      throw new ForbiddenError("La cuenta no está activa", "ACCOUNT_INACTIVE");
    }

    const roleCode = user.role.code;
    const partnerLink = await this.findActivePartnerLink(user.id);

    if (roleCode === RoleCode.PARTNER && !partnerLink) {
      throw new ForbiddenError(
        "Tu acceso al socio fue revocado",
        "PARTNER_ACCESS_REVOKED"
      );
    }

    if (partnerLink) {
      this.assertPartnerOperable(partnerLink);
    }

    return this.buildSession(user, roleCode, partnerLink, meta);
  }

  public async logout(dto: LogoutDto): Promise<void> {
    if (dto.refreshToken !== undefined) {
      await tokenService.revoke(dto.refreshToken);
    }
  }

  public async changePassword(
    userId: string,
    dto: ChangePasswordDto,
    meta: SessionMeta
  ): Promise<LoginResponse> {
    const user = await this.findByIdWithPassword(userId);

    if (!user || !user.passwordHash) {
      throw new NotFoundError("Usuario no encontrado", "USER_NOT_FOUND");
    }

    const currentMatches = await PasswordService.verify(
      dto.currentPassword,
      user.passwordHash
    );

    if (!currentMatches) {
      throw new UnauthorizedError(
        "La contraseña actual no es correcta",
        "INVALID_CURRENT_PASSWORD"
      );
    }

    const reusesPassword = await PasswordService.verify(
      dto.newPassword,
      user.passwordHash
    );

    if (reusesPassword) {
      throw new BadRequestError(
        "La contraseña nueva debe ser distinta a la actual",
        "PASSWORD_REUSED"
      );
    }

    user.passwordHash = await PasswordService.hash(dto.newPassword);
    user.mustChangePassword = false;
    await this.userRepo.save(user);

    // Cierra cualquier otra sesión abierta y obliga a reemitir el access token.
    await tokenService.revokeAllForUser(user.id);
    user.tokenVersion += 1;

    const roleCode = user.role.code;
    const partnerLink = await this.findActivePartnerLink(user.id);
    return this.buildSession(user, roleCode, partnerLink, meta);
  }

  public async getProfile(userId: string): Promise<UserProfileResponse> {
    const user = await this.userRepo.findOne({
      where: { id: userId },
      relations: { role: true },
    });

    if (!user) {
      throw new NotFoundError("Usuario no encontrado", "USER_NOT_FOUND");
    }

    const partnerLink = await this.findActivePartnerLink(user.id);

    return {
      id: user.id,
      name: user.name,
      email: user.email,
      phone: user.phone,
      status: user.status,
      mustChangePassword: user.mustChangePassword,
      role: user.role,
      partner: partnerLink
        ? {
            id: partnerLink.partnerId,
            commercialName: partnerLink.partner?.commercialName ?? "",
            slug: partnerLink.partner?.slug ?? "",
            categoryId: partnerLink.partner?.categoryId ?? "",
            categoryCode: partnerLink.partner?.category?.code ?? "",
            logoUrl: partnerLink.partner?.logoUrl ?? null,
            role: partnerLink.role,
          }
        : null,
    };
  }

  public async activateAccount({
    token,
    password,
  }: ActivateAccountDto): Promise<void> {
    const tokenHash = PasswordService.sha256(token);

    await AppDataSource.transaction(async (manager) => {
      const userToken = await manager.findOne(UserToken, {
        where: {
          tokenHash,
          type: UserTokenType.ACTIVATION,
        },
      });

      if (!userToken) {
        throw new BadRequestError(
          "Enlace de activación inválido",
          "INVALID_ACTIVATION_TOKEN"
        );
      }

      if (userToken.usedAt) {
        throw new BadRequestError(
          "Este enlace ya fue utilizado",
          "ACTIVATION_TOKEN_USED"
        );
      }

      if (new Date(userToken.expiresAt) < new Date()) {
        throw new BadRequestError(
          "El enlace de activación ha expirado",
          "ACTIVATION_TOKEN_EXPIRED"
        );
      }

      const hashedPassword = await PasswordService.hash(password);

      await manager.update(User, userToken.userId, {
        passwordHash: hashedPassword,
        status: UserStatus.ACTIVE,
        mustChangePassword: false,
      });

      await manager.update(UserToken, userToken.id, {
        usedAt: new Date(),
      });
    });
  }
}
