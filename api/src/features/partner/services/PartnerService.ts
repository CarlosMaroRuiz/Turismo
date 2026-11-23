import crypto from "node:crypto";
import { AppDataSource } from "../../../core/bd/index.js";
import { MailService } from "../../../core/mail/index.js";
import {
  BadRequestError,
  ConflictError,
  ForbiddenError,
  NotFoundError,
} from "../../../core/errors/index.js";
import { Partner, PartnerStatus } from "../../../core/bd/entities/Partner.js";
import { PartnerCategory } from "../../../core/bd/entities/PartnerCategory.js";
import { Region, RegionStatus } from "../../../core/bd/entities/Region.entity.js";
import { User, UserStatus } from "../../../core/bd/entities/User.js";
import {
  PartnerUser,
  PartnerUserRole,
} from "../../../core/bd/entities/PartnerUser.js";
import { Role, RoleCode } from "../../../core/bd/entities/Role.js";
import {
  UserToken,
  UserTokenType,
} from "../../../core/bd/entities/UserToken.js";
import type {
  AddPartnerMemberDto,
  CreatePartnerDto,
  RegisterPartnerDto,
  RejectPartnerDto,
  SuspendPartnerDto,
  UpdatePartnerDto,
  UpdatePartnerMemberDto,
} from "../dto/index.js";
import type {
  PartnerMemberResponse,
  PartnerRegistrationResponse,
  PartnerSummaryResponse,
} from "../responses/index.js";
import {
  type PaginationQuery,
  toSkipTake,
} from "../../../core/http/pagination.js";

export class PartnerService {
  private readonly partnerRepo = AppDataSource.getRepository(Partner);
  private readonly mailService = new MailService();

  private generateSlug(name: string): string {
    const base = name
      .normalize("NFD")
      .replace(/[\u0300-\u036f]/g, "")
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-+|-+$/g, "");

    const suffix = crypto.randomBytes(2).toString("hex");
    return `${base}-${suffix}`;
  }

  private toSummaryResponse(p: Partner): PartnerSummaryResponse {
    return {
      id: p.id,
      categoryId: p.categoryId,
      categoryName: p.category?.name ?? "",
      regionId: p.regionId,
      regionName: p.region?.name ?? "",
      commercialName: p.commercialName,
      legalName: p.legalName,
      slug: p.slug,
      logoUrl: p.logoUrl,
      description: p.description,
      address: p.address,
      lat: p.lat,
      lng: p.lng,
      contactName: p.contactName,
      contactEmail: p.contactEmail,
      contactPhone: p.contactPhone,
      status: p.status,
      statusReason: p.statusReason,
      approvedAt: p.approvedAt,
      createdAt: p.createdAt,
    };
  }

  public async registerRequest(
    dto: RegisterPartnerDto
  ): Promise<PartnerRegistrationResponse> {
    return AppDataSource.transaction(async (manager) => {
      const [category, region, existingUser, partnerRole] = await Promise.all([
        manager.findOne(PartnerCategory, {
          where: { id: dto.categoryId, isActive: true },
        }),
        manager.findOne(Region, {
          where: { id: dto.regionId, status: RegionStatus.ACTIVE },
        }),
        manager.findOne(User, { where: { email: dto.ownerEmail } }),
        manager.findOne(Role, { where: { code: RoleCode.PARTNER } }),
      ]);

      if (!category) {
        throw new NotFoundError(
          "La categoría especificada no existe o está inactiva",
          "CATEGORY_NOT_AVAILABLE"
        );
      }

      if (!region) {
        throw new NotFoundError(
          "La región especificada no existe o está inactiva",
          "REGION_NOT_AVAILABLE"
        );
      }

      if (existingUser) {
        throw new ConflictError(
          "Ya existe una cuenta registrada con ese correo",
          "EMAIL_ALREADY_REGISTERED"
        );
      }

      if (!partnerRole) {
        throw new BadRequestError(
          "El rol 'partner' no está configurado en el sistema"
        );
      }

      const slug = this.generateSlug(dto.commercialName);

      const partner = manager.create(Partner, {
        categoryId: category.id,
        regionId: region.id,
        commercialName: dto.commercialName,
        legalName: dto.legalName,
        slug,
        description: dto.description ?? null,
        address: dto.address,
        lat: dto.lat ?? null,
        lng: dto.lng ?? null,
        contactName: dto.contactName,
        contactEmail: dto.contactEmail,
        contactPhone: dto.contactPhone,
        status: PartnerStatus.PENDING,
        statusReason: null,
        approvedAt: null,
      });
      await manager.save(partner);

      const ownerUser = manager.create(User, {
        roleId: partnerRole.id,
        name: dto.ownerName,
        email: dto.ownerEmail,
        phone: dto.ownerPhone ?? null,
        passwordHash: null,
        status: UserStatus.INVITED,
        mustChangePassword: false,
      });
      await manager.save(ownerUser);

      const partnerUser = manager.create(PartnerUser, {
        partnerId: partner.id,
        userId: ownerUser.id,
        role: PartnerUserRole.OWNER,
        isActive: true,
      });
      await manager.save(partnerUser);

      return {
        partnerId: partner.id,
        commercialName: partner.commercialName,
        slug: partner.slug,
        status: partner.status,
        ownerEmail: ownerUser.email,
      };
    });
  }

  /**
   * Alta hecha por el administrador de la plataforma (CU-02). Si `invite` es
   * verdadero se aprueba en el mismo paso y se envía el correo de activación.
   */
  public async createPartner(
    dto: CreatePartnerDto
  ): Promise<PartnerRegistrationResponse> {
    const created = await this.registerRequest(dto);

    if (!dto.invite) {
      return created;
    }

    await this.approvePartner(created.partnerId);

    return { ...created, status: PartnerStatus.ACTIVE };
  }

  public async listPartners(
    status: PartnerStatus | undefined,
    pagination: PaginationQuery
  ): Promise<{ items: PartnerSummaryResponse[]; total: number }> {
    const { skip, take } = toSkipTake(pagination);

    const [partners, total] = await this.partnerRepo.findAndCount({
      ...(status !== undefined && { where: { status } }),
      relations: { category: true, region: true },
      order: { createdAt: "DESC" },
      skip,
      take,
    });

    return {
      items: partners.map((p) => this.toSummaryResponse(p)),
      total,
    };
  }

  public async getPartnerById(
    partnerId: string
  ): Promise<PartnerSummaryResponse> {
    const partner = await this.partnerRepo.findOne({
      where: { id: partnerId },
      relations: { category: true, region: true },
    });

    if (!partner) {
      throw new NotFoundError("Socio no encontrado");
    }

    return this.toSummaryResponse(partner);
  }

  public async updatePartner(
    partnerId: string,
    dto: UpdatePartnerDto
  ): Promise<PartnerSummaryResponse> {
    const partner = await this.partnerRepo.findOne({
      where: { id: partnerId },
      relations: { category: true, region: true },
    });

    if (!partner) {
      throw new NotFoundError("Socio no encontrado");
    }

    if (dto.slug !== undefined && dto.slug !== partner.slug) {
      const slugTaken = await this.partnerRepo.findOne({
        where: { slug: dto.slug },
      });

      if (slugTaken && slugTaken.id !== partner.id) {
        throw new ConflictError(
          `Ya existe un socio con el slug "${dto.slug}"`,
          "SLUG_TAKEN"
        );
      }

      partner.slug = dto.slug;
    }

    if (dto.categoryId !== undefined && dto.categoryId !== partner.categoryId) {
      const category = await this.partnerRepo.manager.findOne(PartnerCategory, {
        where: { id: dto.categoryId, isActive: true },
      });

      if (!category) {
        throw new NotFoundError(
          "La categoría no existe o está inactiva",
          "CATEGORY_NOT_AVAILABLE"
        );
      }

      partner.categoryId = dto.categoryId;
    }

    if (dto.regionId !== undefined && dto.regionId !== partner.regionId) {
      const region = await this.partnerRepo.manager.findOne(Region, {
        where: { id: dto.regionId, status: RegionStatus.ACTIVE },
      });

      if (!region) {
        throw new NotFoundError(
          "La región no existe o está inactiva",
          "REGION_NOT_AVAILABLE"
        );
      }

      partner.regionId = dto.regionId;
    }

    if (dto.commercialName !== undefined) {
      partner.commercialName = dto.commercialName;
    }
    if (dto.legalName !== undefined) {
      partner.legalName = dto.legalName;
    }
    if (dto.description !== undefined) {
      partner.description = dto.description;
    }
    if (dto.address !== undefined) {
      partner.address = dto.address;
    }
    if (dto.lat !== undefined) {
      partner.lat = dto.lat;
    }
    if (dto.lng !== undefined) {
      partner.lng = dto.lng;
    }
    if (dto.contactName !== undefined) {
      partner.contactName = dto.contactName;
    }
    if (dto.contactEmail !== undefined) {
      partner.contactEmail = dto.contactEmail;
    }
    if (dto.contactPhone !== undefined) {
      partner.contactPhone = dto.contactPhone;
    }
    if (dto.logoUrl !== undefined) {
      partner.logoUrl = dto.logoUrl;
    }

    await this.partnerRepo.save(partner);
    return this.toSummaryResponse(partner);
  }

  public async approvePartner(partnerId: string): Promise<void> {
    const mailPayload = await AppDataSource.transaction(async (manager) => {
      const partner = await manager.findOne(Partner, {
        where: { id: partnerId },
      });

      if (!partner) {
        throw new NotFoundError("Socio no encontrado");
      }

      if (partner.status !== PartnerStatus.PENDING) {
        throw new BadRequestError(
          `Solo se pueden aprobar solicitudes pendientes (estado actual: ${partner.status})`
        );
      }

      const ownerLink = await manager.findOne(PartnerUser, {
        where: { partnerId: partner.id, role: PartnerUserRole.OWNER },
        relations: { user: true },
      });

      if (!ownerLink?.user) {
        throw new NotFoundError("No se encontró el responsable del socio");
      }

      await manager.delete(UserToken, {
        userId: ownerLink.userId,
        type: UserTokenType.ACTIVATION,
      });

      const plainToken = crypto.randomBytes(32).toString("hex");
      const tokenHash = crypto
        .createHash("sha256")
        .update(plainToken)
        .digest("hex");

      const expiresAt = new Date(Date.now() + 48 * 60 * 60 * 1000);

      const userToken = manager.create(UserToken, {
        userId: ownerLink.userId,
        type: UserTokenType.ACTIVATION,
        tokenHash,
        expiresAt,
        usedAt: null,
      });
      await manager.save(userToken);

      await manager.update(Partner, partner.id, {
        status: PartnerStatus.ACTIVE,
        statusReason: null,
        approvedAt: new Date(),
      });

      return {
        to: ownerLink.user.email,
        ownerName: ownerLink.user.name,
        commercialName: partner.commercialName,
        activationToken: plainToken,
      };
    });

    await this.mailService.sendPartnerActivationEmail(mailPayload);
  }

  public async rejectPartner(
    partnerId: string,
    { reason }: RejectPartnerDto
  ): Promise<void> {
    const mailPayload = await AppDataSource.transaction(async (manager) => {
      const partner = await manager.findOne(Partner, {
        where: { id: partnerId },
      });

      if (!partner) {
        throw new NotFoundError("Socio no encontrado");
      }

      if (partner.status !== PartnerStatus.PENDING) {
        throw new BadRequestError(
          `Solo se pueden rechazar solicitudes pendientes (estado actual: ${partner.status})`
        );
      }

      const ownerLink = await manager.findOne(PartnerUser, {
        where: { partnerId: partner.id, role: PartnerUserRole.OWNER },
        relations: { user: true },
      });

      await manager.update(Partner, partner.id, {
        status: PartnerStatus.REJECTED,
        statusReason: reason,
      });

      if (!ownerLink?.user) {
        return null;
      }

      return {
        to: ownerLink.user.email,
        ownerName: ownerLink.user.name,
        commercialName: partner.commercialName,
        reason,
      };
    });

    if (mailPayload) {
      await this.mailService.sendPartnerRejectionEmail(mailPayload);
    }
  }

  public async suspendPartner(
    partnerId: string,
    { reason }: SuspendPartnerDto
  ): Promise<void> {
    const partner = await this.partnerRepo.findOne({ where: { id: partnerId } });

    if (!partner) {
      throw new NotFoundError("Socio no encontrado");
    }

    if (partner.status !== PartnerStatus.ACTIVE) {
      throw new BadRequestError(
        `Solo se pueden suspender socios activos (estado actual: ${partner.status})`
      );
    }

    await this.partnerRepo.update(partner.id, {
      status: PartnerStatus.SUSPENDED,
      statusReason: reason,
    });
  }

  public async reactivatePartner(partnerId: string): Promise<void> {
    const partner = await this.partnerRepo.findOne({ where: { id: partnerId } });

    if (!partner) {
      throw new NotFoundError("Socio no encontrado");
    }

    if (partner.status !== PartnerStatus.SUSPENDED) {
      throw new BadRequestError(
        `Solo se pueden reactivar socios suspendidos (estado actual: ${partner.status})`
      );
    }

    await this.partnerRepo.update(partner.id, {
      status: PartnerStatus.ACTIVE,
      statusReason: null,
    });
  }

  public async resendOwnerInvitation(partnerId: string): Promise<void> {
    const mailPayload = await AppDataSource.transaction(async (manager) => {
      const partner = await manager.findOne(Partner, {
        where: { id: partnerId },
      });

      if (!partner) {
        throw new NotFoundError("Socio no encontrado");
      }

      if (partner.status !== PartnerStatus.ACTIVE) {
        throw new BadRequestError(
          "El socio debe estar aprobado (active) para reenviar la invitación"
        );
      }

      const ownerLink = await manager.findOne(PartnerUser, {
        where: {
          partnerId: partner.id,
          role: PartnerUserRole.OWNER,
          isActive: true,
        },
        relations: { user: true },
      });

      if (!ownerLink?.user) {
        throw new NotFoundError(
          "No se encontró un responsable activo para el socio"
        );
      }

      if (ownerLink.user.status !== UserStatus.INVITED) {
        throw new BadRequestError(
          "La cuenta del responsable ya fue activada anteriormente"
        );
      }

      await manager.delete(UserToken, {
        userId: ownerLink.userId,
        type: UserTokenType.ACTIVATION,
      });

      const plainToken = crypto.randomBytes(32).toString("hex");
      const tokenHash = crypto
        .createHash("sha256")
        .update(plainToken)
        .digest("hex");

      const expiresAt = new Date(Date.now() + 48 * 60 * 60 * 1000);

      const userToken = manager.create(UserToken, {
        userId: ownerLink.userId,
        type: UserTokenType.ACTIVATION,
        tokenHash,
        expiresAt,
        usedAt: null,
      });
      await manager.save(userToken);

      return {
        to: ownerLink.user.email,
        ownerName: ownerLink.user.name,
        commercialName: partner.commercialName,
        activationToken: plainToken,
      };
    });

    await this.mailService.sendPartnerActivationEmail(mailPayload);
  }

  public async assertCanManageMembers(
    partnerId: string,
    actorUserId: string,
    actorRole: string
  ): Promise<void> {
    if (actorRole === RoleCode.SUPER_USER) return;

    const actorLink = await AppDataSource.getRepository(PartnerUser).findOne({
      where: {
        partnerId,
        userId: actorUserId,
        role: PartnerUserRole.OWNER,
        isActive: true,
      },
    });

    if (!actorLink) {
      throw new ForbiddenError(
        "Solo el propietario (owner) del socio o un administrador puede gestionar el equipo"
      );
    }
  }

  public async listMembers(partnerId: string): Promise<PartnerMemberResponse[]> {
    const partner = await this.partnerRepo.findOne({ where: { id: partnerId } });
    if (!partner) {
      throw new NotFoundError("Socio no encontrado");
    }

    const links = await AppDataSource.getRepository(PartnerUser).find({
      where: { partnerId },
      relations: { user: true },
      order: { createdAt: "ASC" },
    });

    return links
      .filter((l) => l.user !== undefined && l.user !== null)
      .map((l) => ({
        id: l.id,
        partnerId: l.partnerId,
        userId: l.userId,
        name: l.user.name,
        email: l.user.email,
        phone: l.user.phone,
        userStatus: l.user.status,
        role: l.role,
        isActive: l.isActive,
        createdAt: l.createdAt,
      }));
  }

  public async addMember(
    partnerId: string,
    dto: AddPartnerMemberDto
  ): Promise<PartnerMemberResponse> {
    const { response, mailPayload } = await AppDataSource.transaction(
      async (manager) => {
        const partner = await manager.findOne(Partner, {
          where: { id: partnerId },
        });
        if (!partner) {
          throw new NotFoundError("Socio no encontrado");
        }

        const [existingUser, partnerRole] = await Promise.all([
          manager.findOne(User, { where: { email: dto.email } }),
          manager.findOne(Role, { where: { code: RoleCode.PARTNER } }),
        ]);

        if (existingUser) {
          throw new ConflictError(
            "Ya existe un usuario registrado con ese correo",
            "EMAIL_ALREADY_REGISTERED"
          );
        }

        if (!partnerRole) {
          throw new BadRequestError("El rol 'partner' no está configurado");
        }

        const user = manager.create(User, {
          roleId: partnerRole.id,
          name: dto.name,
          email: dto.email,
          phone: dto.phone ?? null,
          passwordHash: null,
          status: UserStatus.INVITED,
          mustChangePassword: false,
        });
        await manager.save(user);

        const member = manager.create(PartnerUser, {
          partnerId: partner.id,
          userId: user.id,
          role: dto.role,
          isActive: true,
        });
        await manager.save(member);

        const plainToken = crypto.randomBytes(32).toString("hex");
        const tokenHash = crypto
          .createHash("sha256")
          .update(plainToken)
          .digest("hex");

        const userToken = manager.create(UserToken, {
          userId: user.id,
          type: UserTokenType.ACTIVATION,
          tokenHash,
          expiresAt: new Date(Date.now() + 48 * 60 * 60 * 1000),
          usedAt: null,
        });
        await manager.save(userToken);

        return {
          response: {
            id: member.id,
            partnerId: member.partnerId,
            userId: user.id,
            name: user.name,
            email: user.email,
            phone: user.phone,
            userStatus: user.status,
            role: member.role,
            isActive: member.isActive,
            createdAt: member.createdAt,
          },
          mailPayload: {
            to: user.email,
            ownerName: user.name,
            commercialName: partner.commercialName,
            activationToken: plainToken,
          },
        };
      }
    );

    await this.mailService.sendPartnerActivationEmail(mailPayload);
    return response;
  }

  public async updateMember(
    partnerId: string,
    memberId: string,
    dto: UpdatePartnerMemberDto
  ): Promise<PartnerMemberResponse> {
    return AppDataSource.transaction(async (manager) => {
      const member = await manager.findOne(PartnerUser, {
        where: { id: memberId, partnerId },
        relations: { user: true },
      });

      if (!member || !member.user) {
        throw new NotFoundError("Miembro del equipo no encontrado");
      }

      const nextRole = dto.role ?? member.role;
      const nextIsActive = dto.isActive ?? member.isActive;

      const wasActiveOwner =
        member.role === PartnerUserRole.OWNER && member.isActive;
      const remainsActiveOwner =
        nextRole === PartnerUserRole.OWNER && nextIsActive;

      if (wasActiveOwner && !remainsActiveOwner) {
        const activeOwnersCount = await manager.count(PartnerUser, {
          where: {
            partnerId,
            role: PartnerUserRole.OWNER,
            isActive: true,
          },
        });

        if (activeOwnersCount <= 1) {
          throw new BadRequestError(
            "El socio debe tener al menos un propietario (owner) activo"
          );
        }
      }

      member.role = nextRole;
      member.isActive = nextIsActive;
      await manager.save(member);

      return {
        id: member.id,
        partnerId: member.partnerId,
        userId: member.userId,
        name: member.user.name,
        email: member.user.email,
        phone: member.user.phone,
        userStatus: member.user.status,
        role: member.role,
        isActive: member.isActive,
        createdAt: member.createdAt,
      };
    });
  }
}