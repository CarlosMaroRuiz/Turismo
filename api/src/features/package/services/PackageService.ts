import { AppDataSource } from "../../../core/bd/index.js";
import { activeDepartureHold, departureHolds } from "./departure-holds.js";
import { Booking } from "../../../core/bd/entities/Booking.js";
import { availabilityDates } from "../../../core/http/availability-dates.js";
import type { PackageAvailabilityQuery } from "../dto/availability.dto.js";
import { Package, PackageStatus } from "../../../core/bd/entities/Package.js";
import {
  PackageItem,
  PackageItemType,
} from "../../../core/bd/entities/PackageItem.js";
import { PackageItineraryDay } from "../../../core/bd/entities/PackageItineraryDay.js";
import {
  DepartureStatus,
  PackageDeparture,
} from "../../../core/bd/entities/PackageDeparture.js";
import {
  PackagePromotion,
  PromotionStatus,
} from "../../../core/bd/entities/PackagePromotion.js";
import { Partner, PartnerStatus } from "../../../core/bd/entities/Partner.js";
import { Region, RegionStatus } from "../../../core/bd/entities/Region.entity.js";
import { RoleCode } from "../../../core/bd/entities/Role.js";
import {
  BadRequestError,
  ConflictError,
  ForbiddenError,
  NotFoundError,
  ValidationError,
} from "../../../core/errors/index.js";
import type { JwtUserPayload } from "../../../core/middlewares/AuthMiddleware/type.js";
import {
  type PaginationQuery,
  toSkipTake,
} from "../../../core/http/pagination.js";
import type {
  CreateDepartureDto,
  CreatePackageDto,
  UpdateDepartureDto,
  UpdatePackageDto,
} from "../dto/index.js";
import type {
  DepartureResponse,
  PackageDetailResponse,
  PackageSummaryResponse,
} from "../responses/index.js";

/** Solo las agencias publican paquetes; hoteles y atractivos tienen su rama. */
const AGENCY_CATEGORY_CODE = "agency";

export interface PackageFilters {
  regionId?: string | undefined;
  partnerId?: string | undefined;
  search?: string | undefined;
}

export class PackageService {
  private readonly packageRepo = AppDataSource.getRepository(Package);
  private readonly itemRepo = AppDataSource.getRepository(PackageItem);
  private readonly itineraryRepo = AppDataSource.getRepository(PackageItineraryDay);
  private readonly departureRepo = AppDataSource.getRepository(PackageDeparture);
  private readonly promotionRepo = AppDataSource.getRepository(PackagePromotion);
  private readonly partnerRepo = AppDataSource.getRepository(Partner);
  private readonly regionRepo = AppDataSource.getRepository(Region);

  private generateSlug(name: string): string {
    const base = name
      .normalize("NFD")
      .replace(/[\u0300-\u036f]/g, "")
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-+|-+$/g, "");

    const suffix = Math.random().toString(36).slice(2, 8);
    return `${base}-${suffix}`;
  }

  private async findPackageOrFail(packageId: string): Promise<Package> {
    const pkg = await this.packageRepo.findOne({
      where: { id: packageId },
      relations: { partner: { category: true }, destinationRegion: true },
    });

    if (!pkg) {
      throw new NotFoundError("Paquete no encontrado", "PACKAGE_NOT_FOUND");
    }

    return pkg;
  }

  /** El socio debe pertenecer a una agencia; el administrador puede todo. */
  private async requireAgencyPartner(actor: JwtUserPayload): Promise<Partner> {
    if (actor.role === RoleCode.SUPER_USER) {
      throw new ForbiddenError(
        "El alta de paquetes corresponde a la agencia, no al administrador",
        "AGENCY_REQUIRED"
      );
    }

    if (!actor.partnerId) {
      throw new ForbiddenError(
        "Esta operación requiere una agencia vinculada",
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

    if (partner.category.code !== AGENCY_CATEGORY_CODE) {
      throw new ForbiddenError(
        "Solo las agencias de viajes pueden gestionar paquetes",
        "PARTNER_NOT_AGENCY"
      );
    }

    if (partner.status !== PartnerStatus.ACTIVE) {
      throw new ForbiddenError(
        "La agencia debe estar activa para operar",
        "PARTNER_INACTIVE"
      );
    }

    return partner;
  }

  private assertCanManage(pkg: Package, actor: JwtUserPayload): void {
    if (actor.role === RoleCode.SUPER_USER) {
      return;
    }

    if (!actor.partnerId || actor.partnerId !== pkg.partnerId) {
      throw new ForbiddenError(
        "No tienes acceso a este paquete",
        "PACKAGE_ACCESS_DENIED"
      );
    }

    if (pkg.partner.category.code !== AGENCY_CATEGORY_CODE) {
      throw new ForbiddenError(
        "Solo las agencias de viajes pueden gestionar paquetes",
        "PARTNER_NOT_AGENCY"
      );
    }
  }

  private toSummary(
    pkg: Package,
    minPriceAdult: number | null
  ): PackageSummaryResponse {
    return {
      id: pkg.id,
      partnerId: pkg.partnerId,
      partnerName: pkg.partner?.commercialName ?? "",
      destinationRegionId: pkg.destinationRegionId,
      destinationRegionName: pkg.destinationRegion?.name ?? "",
      name: pkg.name,
      slug: pkg.slug,
      summary: pkg.summary,
      nights: pkg.nights,
      days: pkg.nights + 1,
      minTravelers: pkg.minTravelers,
      maxTravelers: pkg.maxTravelers,
      minPriceAdult,
      images: pkg.images ?? [],
      status: pkg.status,
      createdAt: pkg.createdAt,
    };
  }

  private toDeparture(departure: PackageDeparture, heldSeats = 0): DepartureResponse {
    return {
      id: departure.id,
      departureDate: departure.departureDate,
      totalSeats: departure.totalSeats,
      soldSeats: departure.soldSeats,
      availableSeats: Math.max(departure.totalSeats - departure.soldSeats - heldSeats, 0),
      adultPrice: Number(departure.adultPrice),
      childPrice:
        departure.childPrice === null ? null : Number(departure.childPrice),
      status: departure.status,
    };
  }

  /** Precio más bajo por paquete en una sola consulta (evita N+1). */
  private async minPrices(packageIds: string[]): Promise<Map<string, number>> {
    if (packageIds.length === 0) {
      return new Map();
    }

    const rows = await this.departureRepo
      .createQueryBuilder("departure")
      .select("departure.packageId", "packageId")
      .addSelect("MIN(departure.adultPrice)", "minPrice")
      .where("departure.packageId IN (:...ids)", { ids: packageIds })
      .andWhere("departure.status = :status", { status: DepartureStatus.OPEN })
      .groupBy("departure.packageId")
      .getRawMany<{ packageId: string; minPrice: string }>();

    return new Map(
      rows.map((row) => [row.packageId, Number(row.minPrice)] as const)
    );
  }

  private async detailFor(
    pkg: Package,
    includeUnpublished: boolean
  ): Promise<PackageDetailResponse> {
    const [items, itinerary, departures, promotions, prices] = await Promise.all([
      this.itemRepo.find({
        where: { packageId: pkg.id },
        order: { sortOrder: "ASC" },
      }),
      this.itineraryRepo.find({
        where: { packageId: pkg.id },
        order: { dayNumber: "ASC" },
      }),
      this.departureRepo.find({
        where: includeUnpublished
          ? { packageId: pkg.id }
          : { packageId: pkg.id, status: DepartureStatus.OPEN },
        order: { departureDate: "ASC" },
      }),
      this.promotionRepo.find({
        where: includeUnpublished
          ? { packageId: pkg.id }
          : { packageId: pkg.id, status: PromotionStatus.ACTIVE },
        order: { validFrom: "ASC" },
      }),
      this.minPrices([pkg.id]),
    ]);
    const holds = await departureHolds(AppDataSource.manager, departures.map(({ id }) => id));

    return {
      ...this.toSummary(pkg, prices.get(pkg.id) ?? null),
      description: pkg.description,
      meetingPoint: pkg.meetingPoint,
      requirements: pkg.requirements,
      cancellationPolicy: pkg.cancellationPolicy,
      taxesIncluded: pkg.taxesIncluded,
      childMinAge: pkg.childMinAge,
      childMaxAge: pkg.childMaxAge,
      items: items.map((item) => ({
        id: item.id,
        type: item.type,
        description: item.description,
        isIncluded: item.isIncluded,
        sortOrder: item.sortOrder,
      })),
      itinerary: itinerary.map((day) => ({
        id: day.id,
        dayNumber: day.dayNumber,
        title: day.title,
        description: day.description,
      })),
      departures: departures.map((departure) => this.toDeparture(departure, holds.get(departure.id))),
      promotions: promotions.map((promotion) => ({
        id: promotion.id,
        name: promotion.name,
        discountType: promotion.discountType,
        discountValue: Number(promotion.discountValue),
        validFrom: promotion.validFrom,
        validTo: promotion.validTo,
        minTravelers: promotion.minTravelers,
        daysOfWeek: promotion.daysOfWeek,
        status: promotion.status,
      })),
    };
  }

  /** Catálogo público: solo publicados, de socios y regiones activos. */
  public async listPublic(
    filters: PackageFilters,
    pagination: PaginationQuery
  ): Promise<{ items: PackageSummaryResponse[]; total: number }> {
    const qb = this.packageRepo
      .createQueryBuilder("pkg")
      .innerJoinAndSelect("pkg.partner", "partner")
      .innerJoinAndSelect("pkg.destinationRegion", "region")
      .where("pkg.status = :status", { status: PackageStatus.PUBLISHED })
      .andWhere("partner.status = :partnerStatus", {
        partnerStatus: PartnerStatus.ACTIVE,
      })
      .andWhere("region.status = :regionStatus", {
        regionStatus: RegionStatus.ACTIVE,
      })
      .orderBy("pkg.createdAt", "DESC");

    if (filters.regionId) {
      qb.andWhere("pkg.destinationRegionId = :regionId", {
        regionId: filters.regionId,
      });
    }

    if (filters.partnerId) {
      qb.andWhere("pkg.partnerId = :partnerId", { partnerId: filters.partnerId });
    }

    if (filters.search) {
      qb.andWhere(
        "(LOWER(pkg.name) LIKE :search OR LOWER(pkg.summary) LIKE :search)",
        { search: `%${filters.search.toLowerCase()}%` }
      );
    }

    const { skip, take } = toSkipTake(pagination);
    const [packages, total] = await qb.skip(skip).take(take).getManyAndCount();
    const prices = await this.minPrices(packages.map((pkg) => pkg.id));

    return {
      items: packages.map((pkg) =>
        this.toSummary(pkg, prices.get(pkg.id) ?? null)
      ),
      total,
    };
  }

  public async searchAvailability(query: PackageAvailabilityQuery) {
    const dates = availabilityDates(query.date, query.flexDays);
    if (dates.length === 0) return { items: [], total: 0 };

    const qb = this.departureRepo.createQueryBuilder("departure")
      .innerJoin("departure.package", "pkg")
      .innerJoin("pkg.partner", "partner")
      .innerJoin("pkg.destinationRegion", "region")
      .where("departure.departureDate IN (:...dates)", { dates })
      .andWhere("departure.status = :open", { open: DepartureStatus.OPEN })
      .andWhere("pkg.status = :published", { published: PackageStatus.PUBLISHED })
      .andWhere("pkg.destinationRegionId = :regionId", { regionId: query.regionId })
      .andWhere("partner.status = :partner", { partner: PartnerStatus.ACTIVE })
      .andWhere("region.status = :region", { region: RegionStatus.ACTIVE })
      .andWhere("pkg.minTravelers <= :people AND (pkg.maxTravelers IS NULL OR pkg.maxTravelers >= :people)", { people: query.people });
    const held = qb.subQuery().select("COALESCE(SUM(booking.seats), 0)").from(Booking, "booking")
      .where("booking.departureId = departure.id").andWhere(activeDepartureHold).getQuery();
    qb.andWhere(`departure.totalSeats - departure.soldSeats - ${held} >= :people`);

    const { skip, take } = toSkipTake(query);
    if (query.flexDays > 0) {
      const days = await qb.select("DATE_FORMAT(departure.departureDate, '%Y-%m-%d')", "date")
        .groupBy("departure.departureDate")
        .orderBy("ABS(DATEDIFF(departure.departureDate, :requestedDate))", "ASC")
        .addOrderBy("departure.departureDate", "ASC")
        .setParameter("requestedDate", query.date)
        .getRawMany<{ date: string }>();
      return { items: days.slice(skip, skip + take), total: days.length };
    }
    const [items, total] = await Promise.all([
      qb.clone().select("departure.id", "departureId")
        .addSelect("pkg.name", "packageName")
        .addSelect("DATE_FORMAT(departure.departureDate, '%Y-%m-%d')", "date")
        .orderBy("departure.id", "ASC")
        .offset(skip).limit(take)
        .getRawMany<{ departureId: string; packageName: string; date: string }>(),
      qb.getCount(),
    ]);
    return { items, total };
  }

  /** Paquetes del socio autenticado (cualquier estado); el admin ve todos. */
  public async listMine(
    actor: JwtUserPayload,
    pagination: PaginationQuery
  ): Promise<{ items: PackageSummaryResponse[]; total: number }> {
    if (actor.role !== RoleCode.SUPER_USER && !actor.partnerId) {
      throw new ForbiddenError(
        "Esta operación requiere una agencia vinculada",
        "PARTNER_REQUIRED"
      );
    }

    const qb = this.packageRepo
      .createQueryBuilder("pkg")
      .innerJoinAndSelect("pkg.partner", "partner")
      .innerJoinAndSelect("pkg.destinationRegion", "region")
      .orderBy("pkg.createdAt", "DESC");

    if (actor.role !== RoleCode.SUPER_USER) {
      qb.where("pkg.partnerId = :partnerId", { partnerId: actor.partnerId });
    }

    const { skip, take } = toSkipTake(pagination);
    const [packages, total] = await qb.skip(skip).take(take).getManyAndCount();
    const prices = await this.minPrices(packages.map((pkg) => pkg.id));

    return {
      items: packages.map((pkg) =>
        this.toSummary(pkg, prices.get(pkg.id) ?? null)
      ),
      total,
    };
  }

  public async getById(
    packageId: string,
    actor: JwtUserPayload | undefined
  ): Promise<PackageDetailResponse> {
    const pkg = await this.findPackageOrFail(packageId);

    const includeUnpublished =
      actor !== undefined &&
      (actor.role === RoleCode.SUPER_USER || actor.partnerId === pkg.partnerId);

    if (!includeUnpublished && (
      pkg.status !== PackageStatus.PUBLISHED ||
      pkg.partner.status !== PartnerStatus.ACTIVE ||
      pkg.destinationRegion.status !== RegionStatus.ACTIVE
    )) {
      throw new NotFoundError("Paquete no encontrado", "PACKAGE_NOT_FOUND");
    }

    return this.detailFor(pkg, includeUnpublished);
  }

  public async create(
    actor: JwtUserPayload,
    dto: CreatePackageDto
  ): Promise<PackageDetailResponse> {
    const partner = await this.requireAgencyPartner(actor);

    const region = await this.regionRepo.findOne({
      where: { id: dto.destinationRegionId, status: RegionStatus.ACTIVE },
    });

    if (!region) {
      throw new NotFoundError(
        "La región destino no existe o está inactiva",
        "REGION_NOT_AVAILABLE"
      );
    }

    const packageId = await AppDataSource.transaction(async (manager) => {
      const pkg = manager.create(Package, {
        partnerId: partner.id,
        destinationRegionId: region.id,
        name: dto.name,
        slug: this.generateSlug(dto.name),
        summary: dto.summary,
        description: dto.description,
        nights: dto.nights,
        minTravelers: dto.minTravelers,
        maxTravelers: dto.maxTravelers ?? null,
        childMinAge: dto.childMinAge ?? null,
        childMaxAge: dto.childMaxAge ?? null,
        meetingPoint: dto.meetingPoint ?? null,
        requirements: dto.requirements ?? null,
        cancellationPolicy: dto.cancellationPolicy,
        taxesIncluded: dto.taxesIncluded,
        images: dto.images,
        status: PackageStatus.DRAFT,
      });
      await manager.save(pkg);

      if (dto.items.length > 0) {
        await manager.save(
          dto.items.map((item) =>
            manager.create(PackageItem, {
              packageId: pkg.id,
              type: item.type,
              description: item.description,
              isIncluded: item.isIncluded,
              sortOrder: item.sortOrder,
            })
          )
        );
      }

      if (dto.itinerary.length > 0) {
        await manager.save(
          dto.itinerary.map((day) =>
            manager.create(PackageItineraryDay, {
              packageId: pkg.id,
              dayNumber: day.dayNumber,
              title: day.title,
              description: day.description,
            })
          )
        );
      }

      if (dto.promotions.length > 0) {
        await manager.save(
          dto.promotions.map((promotion) =>
            manager.create(PackagePromotion, {
              packageId: pkg.id,
              name: promotion.name,
              discountType: promotion.discountType,
              discountValue: promotion.discountValue,
              validFrom: promotion.validFrom,
              validTo: promotion.validTo,
              minTravelers: promotion.minTravelers ?? null,
              daysOfWeek: promotion.daysOfWeek ?? null,
              status: PromotionStatus.ACTIVE,
            })
          )
        );
      }

      return pkg.id;
    });

    return this.getById(packageId, actor);
  }

  public async update(
    packageId: string,
    actor: JwtUserPayload,
    dto: UpdatePackageDto
  ): Promise<PackageDetailResponse> {
    const pkg = await this.findPackageOrFail(packageId);
    this.assertCanManage(pkg, actor);

    if (
      dto.destinationRegionId !== undefined &&
      dto.destinationRegionId !== pkg.destinationRegionId
    ) {
      const region = await this.regionRepo.findOne({
        where: { id: dto.destinationRegionId, status: RegionStatus.ACTIVE },
      });

      if (!region) {
        throw new NotFoundError(
          "La región destino no existe o está inactiva",
          "REGION_NOT_AVAILABLE"
        );
      }
    }

    await AppDataSource.transaction(async (manager) => {
      const scalarUpdates: Partial<Package> = {};

      if (dto.destinationRegionId !== undefined)
        scalarUpdates.destinationRegionId = dto.destinationRegionId;
      if (dto.name !== undefined) scalarUpdates.name = dto.name;
      if (dto.summary !== undefined) scalarUpdates.summary = dto.summary;
      if (dto.description !== undefined) scalarUpdates.description = dto.description;
      if (dto.nights !== undefined) scalarUpdates.nights = dto.nights;
      if (dto.minTravelers !== undefined)
        scalarUpdates.minTravelers = dto.minTravelers;
      if (dto.maxTravelers !== undefined)
        scalarUpdates.maxTravelers = dto.maxTravelers;
      if (dto.childMinAge !== undefined) scalarUpdates.childMinAge = dto.childMinAge;
      if (dto.childMaxAge !== undefined) scalarUpdates.childMaxAge = dto.childMaxAge;
      if (dto.meetingPoint !== undefined)
        scalarUpdates.meetingPoint = dto.meetingPoint;
      if (dto.requirements !== undefined)
        scalarUpdates.requirements = dto.requirements;
      if (dto.cancellationPolicy !== undefined)
        scalarUpdates.cancellationPolicy = dto.cancellationPolicy;
      if (dto.taxesIncluded !== undefined)
        scalarUpdates.taxesIncluded = dto.taxesIncluded;
      if (dto.images !== undefined) scalarUpdates.images = dto.images;

      if (Object.keys(scalarUpdates).length > 0) {
        await manager.update(Package, pkg.id, scalarUpdates);
      }

      if (dto.items !== undefined) {
        await manager.delete(PackageItem, { packageId: pkg.id });
        if (dto.items.length > 0) {
          await manager.save(
            dto.items.map((item) =>
              manager.create(PackageItem, {
                packageId: pkg.id,
                type: item.type as PackageItemType,
                description: item.description,
                isIncluded: item.isIncluded,
                sortOrder: item.sortOrder,
              })
            )
          );
        }
      }

      if (dto.itinerary !== undefined) {
        await manager.delete(PackageItineraryDay, { packageId: pkg.id });
        if (dto.itinerary.length > 0) {
          await manager.save(
            dto.itinerary.map((day) =>
              manager.create(PackageItineraryDay, {
                packageId: pkg.id,
                dayNumber: day.dayNumber,
                title: day.title,
                description: day.description,
              })
            )
          );
        }
      }

      if (dto.promotions !== undefined) {
        await manager.delete(PackagePromotion, { packageId: pkg.id });
        if (dto.promotions.length > 0) {
          await manager.save(
            dto.promotions.map((promotion) =>
              manager.create(PackagePromotion, {
                packageId: pkg.id,
                name: promotion.name,
                discountType: promotion.discountType,
                discountValue: promotion.discountValue,
                validFrom: promotion.validFrom,
                validTo: promotion.validTo,
                minTravelers: promotion.minTravelers ?? null,
                daysOfWeek: promotion.daysOfWeek ?? null,
                status: PromotionStatus.ACTIVE,
              })
            )
          );
        }
      }
    });

    return this.getById(packageId, actor);
  }

  /** Reglas de publicación: sin esto el agente podría ofrecer un paquete vacío. */
  private async assertPublishable(pkg: Package): Promise<void> {
    const [items, itinerary, departures] = await Promise.all([
      this.itemRepo.find({ where: { packageId: pkg.id } }),
      this.itineraryRepo.find({ where: { packageId: pkg.id } }),
      this.departureRepo.find({ where: { packageId: pkg.id } }),
    ]);

    const problems: Record<string, string[]> = {};

    if (!items.some((item) => item.isIncluded)) {
      problems["items"] = ["El paquete debe incluir al menos un servicio"];
    }

    if (itinerary.length === 0) {
      problems["itinerary"] = ["El paquete debe tener al menos un día de itinerario"];
    }

    const hasBookableDeparture = departures.some(
      (departure) =>
        departure.status === DepartureStatus.OPEN &&
        departure.totalSeats > departure.soldSeats &&
        Number(departure.adultPrice) > 0
    );

    if (!hasBookableDeparture) {
      problems["departures"] = [
        "Debe existir al menos una salida abierta con cupo y precio",
      ];
    }

    if (pkg.destinationRegion.status !== RegionStatus.ACTIVE) {
      problems["destinationRegionId"] = ["La región destino debe estar activa"];
    }

    if (pkg.partner.status !== PartnerStatus.ACTIVE) {
      problems["partnerId"] = ["La agencia debe estar activa"];
    }

    if (Object.keys(problems).length > 0) {
      throw new ValidationError(
        problems,
        "El paquete no cumple los requisitos para publicarse"
      );
    }
  }

  public async changeStatus(
    packageId: string,
    actor: JwtUserPayload,
    status: PackageStatus
  ): Promise<PackageDetailResponse> {
    const pkg = await this.findPackageOrFail(packageId);
    this.assertCanManage(pkg, actor);

    if (status === PackageStatus.PUBLISHED) {
      await this.assertPublishable(pkg);
    }

    await this.packageRepo.update(pkg.id, { status });

    return this.getById(packageId, actor);
  }

  public async addDeparture(
    packageId: string,
    actor: JwtUserPayload,
    dto: CreateDepartureDto
  ): Promise<DepartureResponse> {
    const pkg = await this.findPackageOrFail(packageId);
    this.assertCanManage(pkg, actor);

    const today = new Date().toISOString().slice(0, 10);
    if (dto.departureDate < today) {
      throw new BadRequestError(
        "La fecha de salida no puede estar en el pasado",
        "DEPARTURE_DATE_PAST"
      );
    }

    const duplicated = await this.departureRepo.findOne({
      where: { packageId: pkg.id, departureDate: dto.departureDate },
    });

    if (duplicated) {
      throw new ConflictError(
        "Ya existe una salida para esa fecha",
        "DEPARTURE_DATE_TAKEN"
      );
    }

    const departure = this.departureRepo.create({
      packageId: pkg.id,
      departureDate: dto.departureDate,
      totalSeats: dto.totalSeats,
      soldSeats: 0,
      adultPrice: dto.adultPrice,
      childPrice: dto.childPrice ?? null,
      status: dto.status,
    });

    const saved = await this.departureRepo.save(departure);
    return this.toDeparture(saved);
  }

  public async updateDeparture(
    packageId: string,
    departureId: string,
    actor: JwtUserPayload,
    dto: UpdateDepartureDto
  ): Promise<DepartureResponse> {
    const pkg = await this.findPackageOrFail(packageId);
    this.assertCanManage(pkg, actor);

    return AppDataSource.transaction("READ COMMITTED", async (manager) => {
      const departure = await manager.findOne(PackageDeparture, {
        where: { id: departureId, packageId: pkg.id },
        lock: { mode: "pessimistic_write" },
      });
      if (!departure) {
        throw new NotFoundError("Salida no encontrada", "DEPARTURE_NOT_FOUND");
      }

      const heldSeats = (await departureHolds(manager, [departure.id])).get(departure.id) ?? 0;
      if (dto.totalSeats !== undefined && dto.totalSeats < departure.soldSeats + heldSeats) {
        throw new BadRequestError(
          "El cupo no puede ser menor que los lugares vendidos y apartados",
          "SEATS_BELOW_SOLD"
        );
      }

      if (dto.totalSeats !== undefined) departure.totalSeats = dto.totalSeats;
      if (dto.adultPrice !== undefined) departure.adultPrice = dto.adultPrice;
      if (dto.childPrice !== undefined) departure.childPrice = dto.childPrice;
      if (dto.status !== undefined) departure.status = dto.status;

      return this.toDeparture(await manager.save(departure), heldSeats);
    });
  }
}
