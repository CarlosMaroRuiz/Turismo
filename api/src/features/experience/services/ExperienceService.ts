import { AppDataSource } from "../../../core/bd/index.js";
import { Partner, PartnerStatus } from "../../../core/bd/entities/Partner.js";
import { PartnerCategory } from "../../../core/bd/entities/PartnerCategory.js";
import { Region, RegionStatus } from "../../../core/bd/entities/Region.entity.js";
import { RoleCode } from "../../../core/bd/entities/Role.js";
import { Experience } from "../../../core/bd/entities/Experience.js";
import {
  ExperienceSlot,
  SlotStatus,
} from "../../../core/bd/entities/ExperienceSlot.js";
import {
  BadRequestError,
  ConflictError,
  ForbiddenError,
  NotFoundError,
} from "../../../core/errors/index.js";
import type { JwtUserPayload } from "../../../core/middlewares/AuthMiddleware/type.js";
import {
  type PaginationQuery,
  toSkipTake,
} from "../../../core/http/pagination.js";
import type {
  CreateExperienceDto,
  CreateSlotDto,
  ExperienceAvailabilityQuery,
  UpdateExperienceDto,
  UpdateSlotDto,
} from "../dto/index.js";
import type {
  ExperienceAvailabilityItem,
  ExperienceDetailResponse,
  ExperienceSlotResponse,
  ExperienceSummaryResponse,
} from "../responses/index.js";

const ATTRACTION_CATEGORY_CODE = "attraction";
const UPCOMING_SLOTS_LIMIT = 60;

function todayIso(): string {
  return new Date().toISOString().slice(0, 10);
}

export interface ExperienceFilters {
  partnerId?: string | undefined;
  regionId?: string | undefined;
  search?: string | undefined;
}

export class ExperienceService {
  private readonly experienceRepo = AppDataSource.getRepository(Experience);
  private readonly slotRepo = AppDataSource.getRepository(ExperienceSlot);
  private readonly partnerRepo = AppDataSource.getRepository(Partner);
  private readonly categoryRepo = AppDataSource.getRepository(PartnerCategory);
  private readonly regionRepo = AppDataSource.getRepository(Region);

  private async attractionCategoryId(): Promise<string> {
    const category = await this.categoryRepo.findOne({
      where: { code: ATTRACTION_CATEGORY_CODE },
    });

    if (!category) {
      throw new NotFoundError(
        "La categoría 'attraction' no está configurada en el sistema",
        "ATTRACTION_CATEGORY_MISSING"
      );
    }

    return category.id;
  }

  private async requireAttractionPartner(
    actor: JwtUserPayload
  ): Promise<Partner> {
    if (actor.role === RoleCode.SUPER_USER) {
      throw new ForbiddenError(
        "El alta de experiencias corresponde al operador de atractivos",
        "ATTRACTION_REQUIRED"
      );
    }

    if (!actor.partnerId) {
      throw new ForbiddenError(
        "Esta operación requiere un operador de atractivos vinculado",
        "PARTNER_REQUIRED"
      );
    }

    const partner = await this.partnerRepo.findOne({
      where: { id: actor.partnerId },
      relations: { category: true },
    });

    if (!partner) {
      throw new NotFoundError("Socio no encontrado", "PARTNER_NOT_FOUND");
    }

    if (partner.category.code !== ATTRACTION_CATEGORY_CODE) {
      throw new ForbiddenError(
        "Solo los operadores de atractivos pueden gestionar experiencias",
        "PARTNER_NOT_ATTRACTION"
      );
    }

    if (partner.status !== PartnerStatus.ACTIVE) {
      throw new ForbiddenError(
        "El operador debe estar activo para operar",
        "PARTNER_INACTIVE"
      );
    }

    return partner;
  }

  private async findExperienceOrFail(
    experienceId: string
  ): Promise<Experience> {
    const experience = await this.experienceRepo.findOne({
      where: { id: experienceId },
      relations: { partner: { category: true }, region: true },
    });

    if (!experience) {
      throw new NotFoundError("Experiencia no encontrada", "EXPERIENCE_NOT_FOUND");
    }

    return experience;
  }

  private assertCanManage(
    experience: Experience,
    actor: JwtUserPayload
  ): void {
    if (actor.role === RoleCode.SUPER_USER) {
      return;
    }

    if (!actor.partnerId || actor.partnerId !== experience.partnerId) {
      throw new ForbiddenError(
        "No tienes acceso a esta experiencia",
        "EXPERIENCE_ACCESS_DENIED"
      );
    }

    if (experience.partner.category.code !== ATTRACTION_CATEGORY_CODE) {
      throw new ForbiddenError(
        "Solo los operadores de atractivos pueden gestionar experiencias",
        "PARTNER_NOT_ATTRACTION"
      );
    }
  }

  private generateSlug(name: string): string {
    const base = name
      .normalize("NFD")
      .replace(/[\u0300-\u036f]/g, "")
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-+|-+$/g, "");

    return `${base}-${Math.random().toString(36).slice(2, 8)}`;
  }

  private toSummary(experience: Experience): ExperienceSummaryResponse {
    return {
      id: experience.id,
      partnerId: experience.partnerId,
      partnerName: experience.partner?.commercialName ?? "",
      regionId: experience.regionId,
      regionName: experience.region?.name ?? "",
      name: experience.name,
      slug: experience.slug,
      description: experience.description,
      durationMinutes: experience.durationMinutes,
      minAge: experience.minAge,
      priceAdult: Number(experience.priceAdult),
      priceChild:
        experience.priceChild === null ? null : Number(experience.priceChild),
      isActive: experience.isActive,
      createdAt: experience.createdAt,
    };
  }

  private toSlot(slot: ExperienceSlot): ExperienceSlotResponse {
    return {
      id: slot.id,
      experienceId: slot.experienceId,
      date: slot.date,
      startTime: slot.startTime,
      capacity: slot.capacity,
      booked: slot.booked,
      remaining: Math.max(slot.capacity - slot.booked, 0),
      status: slot.status,
    };
  }

  public async listPublic(
    filters: ExperienceFilters,
    pagination: PaginationQuery
  ): Promise<{ items: ExperienceSummaryResponse[]; total: number }> {
    const categoryId = await this.attractionCategoryId();

    const qb = this.experienceRepo
      .createQueryBuilder("experience")
      .innerJoinAndSelect("experience.partner", "partner")
      .innerJoinAndSelect("experience.region", "region")
      .where("experience.isActive = true")
      .andWhere("partner.status = :partnerStatus", {
        partnerStatus: PartnerStatus.ACTIVE,
      })
      .andWhere("partner.categoryId = :categoryId", { categoryId })
      .andWhere("region.status = :regionStatus", {
        regionStatus: RegionStatus.ACTIVE,
      })
      .orderBy("experience.name", "ASC");

    if (filters.partnerId) {
      qb.andWhere("experience.partnerId = :partnerId", {
        partnerId: filters.partnerId,
      });
    }

    if (filters.regionId) {
      qb.andWhere("experience.regionId = :regionId", {
        regionId: filters.regionId,
      });
    }

    if (filters.search) {
      qb.andWhere(
        "(LOWER(experience.name) LIKE :search OR LOWER(experience.description) LIKE :search)",
        { search: `%${filters.search.toLowerCase()}%` }
      );
    }

    const { skip, take } = toSkipTake(pagination);
    const [rows, total] = await qb.skip(skip).take(take).getManyAndCount();

    return { items: rows.map((row) => this.toSummary(row)), total };
  }

  public async listMine(
    actor: JwtUserPayload,
    pagination: PaginationQuery
  ): Promise<{ items: ExperienceSummaryResponse[]; total: number }> {
    if (actor.role !== RoleCode.SUPER_USER && !actor.partnerId) {
      throw new ForbiddenError(
        "Esta operación requiere un operador de atractivos vinculado",
        "PARTNER_REQUIRED"
      );
    }

    const qb = this.experienceRepo
      .createQueryBuilder("experience")
      .innerJoinAndSelect("experience.partner", "partner")
      .innerJoinAndSelect("experience.region", "region")
      .orderBy("experience.createdAt", "DESC");

    if (actor.role !== RoleCode.SUPER_USER) {
      qb.where("experience.partnerId = :partnerId", {
        partnerId: actor.partnerId,
      });
    }

    const { skip, take } = toSkipTake(pagination);
    const [rows, total] = await qb.skip(skip).take(take).getManyAndCount();

    return { items: rows.map((row) => this.toSummary(row)), total };
  }

  public async getById(
    experienceId: string,
    actor: JwtUserPayload | undefined
  ): Promise<ExperienceDetailResponse> {
    const experience = await this.findExperienceOrFail(experienceId);

    const includeInactive =
      actor !== undefined &&
      (actor.role === RoleCode.SUPER_USER ||
        actor.partnerId === experience.partnerId);

    if (!experience.isActive && !includeInactive) {
      throw new NotFoundError(
        "Experiencia no encontrada",
        "EXPERIENCE_NOT_FOUND"
      );
    }

    const slots = await this.slotRepo
      .createQueryBuilder("slot")
      .where("slot.experienceId = :experienceId", {
        experienceId: experience.id,
      })
      .andWhere("slot.date >= :today", { today: todayIso() })
      .andWhere("slot.status = :status", { status: SlotStatus.OPEN })
      .orderBy("slot.date", "ASC")
      .addOrderBy("slot.startTime", "ASC")
      .take(UPCOMING_SLOTS_LIMIT)
      .getMany();

    return {
      ...this.toSummary(experience),
      requirements: experience.requirements,
      slots: slots.map((slot) => this.toSlot(slot)),
    };
  }

  public async create(
    actor: JwtUserPayload,
    dto: CreateExperienceDto
  ): Promise<ExperienceDetailResponse> {
    const partner = await this.requireAttractionPartner(actor);

    const region = await this.regionRepo.findOne({
      where: { id: dto.regionId, status: RegionStatus.ACTIVE },
    });

    if (!region) {
      throw new NotFoundError(
        "La región no existe o está inactiva",
        "REGION_NOT_AVAILABLE"
      );
    }

    const saved = await this.experienceRepo.save(
      this.experienceRepo.create({
        partnerId: partner.id,
        regionId: region.id,
        name: dto.name,
        slug: this.generateSlug(dto.name),
        description: dto.description,
        durationMinutes: dto.durationMinutes,
        minAge: dto.minAge ?? null,
        priceAdult: dto.priceAdult,
        priceChild: dto.priceChild ?? null,
        requirements: dto.requirements ?? null,
        isActive: dto.isActive,
      })
    );

    return this.getById(saved.id, actor);
  }

  public async update(
    experienceId: string,
    actor: JwtUserPayload,
    dto: UpdateExperienceDto
  ): Promise<ExperienceDetailResponse> {
    const experience = await this.findExperienceOrFail(experienceId);
    this.assertCanManage(experience, actor);

    if (dto.regionId !== undefined && dto.regionId !== experience.regionId) {
      const region = await this.regionRepo.findOne({
        where: { id: dto.regionId, status: RegionStatus.ACTIVE },
      });

      if (!region) {
        throw new NotFoundError(
          "La región no existe o está inactiva",
          "REGION_NOT_AVAILABLE"
        );
      }

      experience.regionId = dto.regionId;
    }

    if (dto.name !== undefined) experience.name = dto.name;
    if (dto.description !== undefined) experience.description = dto.description;
    if (dto.durationMinutes !== undefined)
      experience.durationMinutes = dto.durationMinutes;
    if (dto.minAge !== undefined) experience.minAge = dto.minAge;
    if (dto.priceAdult !== undefined) experience.priceAdult = dto.priceAdult;
    if (dto.priceChild !== undefined) experience.priceChild = dto.priceChild;
    if (dto.requirements !== undefined)
      experience.requirements = dto.requirements;
    if (dto.isActive !== undefined) experience.isActive = dto.isActive;

    await this.experienceRepo.save(experience);

    return this.getById(experienceId, actor);
  }

  public async addSlot(
    experienceId: string,
    actor: JwtUserPayload,
    dto: CreateSlotDto
  ): Promise<ExperienceSlotResponse> {
    const experience = await this.findExperienceOrFail(experienceId);
    this.assertCanManage(experience, actor);

    if (dto.date < todayIso()) {
      throw new BadRequestError(
        "La fecha del turno no puede estar en el pasado",
        "SLOT_DATE_PAST"
      );
    }

    const duplicated = await this.slotRepo.findOne({
      where: {
        experienceId: experience.id,
        date: dto.date,
        startTime: dto.startTime,
      },
    });

    if (duplicated) {
      throw new ConflictError(
        "Ya existe un turno para esa fecha y hora",
        "SLOT_TAKEN"
      );
    }

    const saved = await this.slotRepo.save(
      this.slotRepo.create({
        experienceId: experience.id,
        date: dto.date,
        startTime: dto.startTime,
        capacity: dto.capacity,
        booked: 0,
        status: SlotStatus.OPEN,
      })
    );

    return this.toSlot(saved);
  }

  public async updateSlot(
    experienceId: string,
    slotId: string,
    actor: JwtUserPayload,
    dto: UpdateSlotDto
  ): Promise<ExperienceSlotResponse> {
    const experience = await this.findExperienceOrFail(experienceId);
    this.assertCanManage(experience, actor);

    const slot = await this.slotRepo.findOne({
      where: { id: slotId, experienceId: experience.id },
    });

    if (!slot) {
      throw new NotFoundError("Turno no encontrado", "SLOT_NOT_FOUND");
    }

    if (dto.capacity !== undefined && dto.capacity < slot.booked) {
      throw new BadRequestError(
        "El aforo no puede ser menor que los lugares ya reservados",
        "CAPACITY_BELOW_BOOKED"
      );
    }

    if (dto.capacity !== undefined) slot.capacity = dto.capacity;
    if (dto.status !== undefined) slot.status = dto.status;

    const saved = await this.slotRepo.save(slot);
    return this.toSlot(saved);
  }

  /** Disponibilidad de un día: turnos abiertos con cupo suficiente. */
  public async searchAvailability(
    query: ExperienceAvailabilityQuery
  ): Promise<{ items: ExperienceAvailabilityItem[]; total: number }> {
    const categoryId = await this.attractionCategoryId();
    const date = query.date ?? todayIso();

    const qb = this.slotRepo
      .createQueryBuilder("slot")
      .innerJoinAndSelect("slot.experience", "experience")
      .innerJoinAndSelect("experience.partner", "partner")
      .innerJoinAndSelect("experience.region", "region")
      .where("slot.date = :date", { date })
      .andWhere("slot.status = :slotStatus", { slotStatus: SlotStatus.OPEN })
      .andWhere("slot.capacity - slot.booked >= :people", {
        people: query.people,
      })
      .andWhere("experience.isActive = true")
      .andWhere("partner.status = :partnerStatus", {
        partnerStatus: PartnerStatus.ACTIVE,
      })
      .andWhere("partner.categoryId = :categoryId", { categoryId })
      .andWhere("region.status = :regionStatus", {
        regionStatus: RegionStatus.ACTIVE,
      })
      .orderBy("slot.startTime", "ASC");

    if (query.regionId) {
      qb.andWhere("experience.regionId = :regionId", {
        regionId: query.regionId,
      });
    }

    if (query.partnerId) {
      qb.andWhere("experience.partnerId = :partnerId", {
        partnerId: query.partnerId,
      });
    }

    const { skip, take } = toSkipTake(query);
    const [rows, total] = await qb.skip(skip).take(take).getManyAndCount();

    return {
      items: rows.map((slot) => ({
        slotId: slot.id,
        experienceId: slot.experienceId,
        experienceName: slot.experience.name,
        partnerId: slot.experience.partnerId,
        partnerName: slot.experience.partner.commercialName,
        regionId: slot.experience.regionId,
        regionName: slot.experience.region?.name ?? "",
        date: slot.date,
        startTime: slot.startTime,
        durationMinutes: slot.experience.durationMinutes,
        capacity: slot.capacity,
        remaining: Math.max(slot.capacity - slot.booked, 0),
        priceAdult: Number(slot.experience.priceAdult),
        priceChild:
          slot.experience.priceChild === null
            ? null
            : Number(slot.experience.priceChild),
        currency: "MXN",
      })),
      total,
    };
  }
}
