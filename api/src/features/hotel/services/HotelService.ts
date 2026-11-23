import { In } from "typeorm";
import { AppDataSource } from "../../../core/bd/index.js";
import { availabilityDates, shiftDate } from "../../../core/http/availability-dates.js";
import { Partner, PartnerStatus } from "../../../core/bd/entities/Partner.js";
import { PartnerCategory } from "../../../core/bd/entities/PartnerCategory.js";
import { Region, RegionStatus } from "../../../core/bd/entities/Region.entity.js";
import { RoleCode } from "../../../core/bd/entities/Role.js";
import { RoomType } from "../../../core/bd/entities/RoomType.js";
import { RoomInventory } from "../../../core/bd/entities/RoomInventory.js";
import {
  BadRequestError,
  ForbiddenError,
  NotFoundError,
} from "../../../core/errors/index.js";
import type { JwtUserPayload } from "../../../core/middlewares/AuthMiddleware/type.js";
import {
  type PaginationQuery,
  toSkipTake,
} from "../../../core/http/pagination.js";
import type {
  AvailabilityQuery,
  CreateRoomTypeDto,
  InventoryRangeDto,
  RoomTypeListQuery,
  UpdateRoomTypeDto,
} from "../dto/index.js";
import type {
  AvailabilityItem,
  InventoryUpsertResponse,
  RoomInventoryResponse,
  RoomTypeResponse,
} from "../responses/index.js";

const HOTEL_CATEGORY_CODE = "hotel";
const MAX_INVENTORY_RANGE_DAYS = 370;
export const MAX_AVAILABILITY_NIGHTS = 30;
/** Tope de tipos de habitación que se evalúan por búsqueda de disponibilidad. */
const MAX_AVAILABILITY_CANDIDATES = 200;

/** Fechas "YYYY-MM-DD" entre dos extremos (to exclusivo). */
function eachNight(from: string, toExclusive: string): string[] {
  const nights: string[] = [];
  const start = Date.parse(`${from}T00:00:00Z`);
  const end = Date.parse(`${toExclusive}T00:00:00Z`);

  for (let cursor = start; cursor < end; cursor += 86_400_000) {
    nights.push(new Date(cursor).toISOString().slice(0, 10));
  }

  return nights;
}

function nightsBetween(checkIn: string, checkOut: string): number {
  const start = Date.parse(`${checkIn}T00:00:00Z`);
  const end = Date.parse(`${checkOut}T00:00:00Z`);
  return Math.round((end - start) / 86_400_000);
}

function nextDay(date: string): string {
  return new Date(Date.parse(`${date}T00:00:00Z`) + 86_400_000)
    .toISOString()
    .slice(0, 10);
}

export interface HotelFilters {
  partnerId?: string | undefined;
  regionId?: string | undefined;
  guests?: number | undefined;
}

export class HotelService {
  private readonly roomTypeRepo = AppDataSource.getRepository(RoomType);
  private readonly inventoryRepo = AppDataSource.getRepository(RoomInventory);
  private readonly partnerRepo = AppDataSource.getRepository(Partner);
  private readonly categoryRepo = AppDataSource.getRepository(PartnerCategory);

  private async hotelCategoryId(): Promise<string> {
    const category = await this.categoryRepo.findOne({
      where: { code: HOTEL_CATEGORY_CODE },
    });

    if (!category) {
      throw new NotFoundError(
        "La categoría 'hotel' no está configurada en el sistema",
        "HOTEL_CATEGORY_MISSING"
      );
    }

    return category.id;
  }

  private async requireHotelPartner(actor: JwtUserPayload): Promise<Partner> {
    if (actor.role === RoleCode.SUPER_USER) {
      throw new ForbiddenError(
        "El alta de habitaciones corresponde al hotel, no al administrador",
        "HOTEL_REQUIRED"
      );
    }

    if (!actor.partnerId) {
      throw new ForbiddenError(
        "Esta operación requiere un hotel vinculado",
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

    if (partner.category.code !== HOTEL_CATEGORY_CODE) {
      throw new ForbiddenError(
        "Solo los hoteles pueden gestionar habitaciones",
        "PARTNER_NOT_HOTEL"
      );
    }

    if (partner.status !== PartnerStatus.ACTIVE) {
      throw new ForbiddenError(
        "El hotel debe estar activo para operar",
        "PARTNER_INACTIVE"
      );
    }

    return partner;
  }

  private async findRoomTypeOrFail(roomTypeId: string): Promise<RoomType> {
    const roomType = await this.roomTypeRepo.findOne({
      where: { id: roomTypeId },
      relations: { partner: { category: true, region: true } },
    });

    if (!roomType) {
      throw new NotFoundError(
        "Tipo de habitación no encontrado",
        "ROOM_TYPE_NOT_FOUND"
      );
    }

    return roomType;
  }

  private assertCanManage(roomType: RoomType, actor: JwtUserPayload): void {
    if (actor.role === RoleCode.SUPER_USER) {
      return;
    }

    if (!actor.partnerId || actor.partnerId !== roomType.partnerId) {
      throw new ForbiddenError(
        "No tienes acceso a este tipo de habitación",
        "ROOM_TYPE_ACCESS_DENIED"
      );
    }

    if (roomType.partner.category.code !== HOTEL_CATEGORY_CODE) {
      throw new ForbiddenError(
        "Solo los hoteles pueden gestionar habitaciones",
        "PARTNER_NOT_HOTEL"
      );
    }
  }

  private toResponse(roomType: RoomType): RoomTypeResponse {
    return {
      id: roomType.id,
      partnerId: roomType.partnerId,
      partnerName: roomType.partner?.commercialName ?? "",
      name: roomType.name,
      description: roomType.description,
      maxAdults: roomType.maxAdults,
      maxChildren: roomType.maxChildren,
      totalUnits: roomType.totalUnits,
      basePrice: Number(roomType.basePrice),
      amenities: roomType.amenities ?? [],
      images: roomType.images ?? [],
      isActive: roomType.isActive,
      createdAt: roomType.createdAt,
    };
  }

  public async listPublic(
    filters: HotelFilters,
    pagination: PaginationQuery
  ): Promise<{ items: RoomTypeResponse[]; total: number }> {
    const categoryId = await this.hotelCategoryId();

    const qb = this.roomTypeRepo
      .createQueryBuilder("rt")
      .innerJoinAndSelect("rt.partner", "partner")
      .innerJoinAndSelect("partner.region", "region")
      .where("rt.isActive = true")
      .andWhere("partner.status = :partnerStatus", {
        partnerStatus: PartnerStatus.ACTIVE,
      })
      .andWhere("partner.categoryId = :categoryId", { categoryId })
      .andWhere("region.status = :regionStatus", {
        regionStatus: RegionStatus.ACTIVE,
      })
      .orderBy("rt.basePrice", "ASC");

    if (filters.partnerId) {
      qb.andWhere("rt.partnerId = :partnerId", { partnerId: filters.partnerId });
    }

    if (filters.regionId) {
      qb.andWhere("partner.regionId = :regionId", { regionId: filters.regionId });
    }

    if (filters.guests !== undefined) {
      qb.andWhere("(rt.maxAdults + rt.maxChildren) >= :guests", {
        guests: filters.guests,
      });
    }

    const { skip, take } = toSkipTake(pagination);
    const [rows, total] = await qb.skip(skip).take(take).getManyAndCount();

    return { items: rows.map((row) => this.toResponse(row)), total };
  }

  public async listMine(
    actor: JwtUserPayload,
    pagination: PaginationQuery
  ): Promise<{ items: RoomTypeResponse[]; total: number }> {
    if (actor.role !== RoleCode.SUPER_USER && !actor.partnerId) {
      throw new ForbiddenError(
        "Esta operación requiere un hotel vinculado",
        "PARTNER_REQUIRED"
      );
    }

    const qb = this.roomTypeRepo
      .createQueryBuilder("rt")
      .innerJoinAndSelect("rt.partner", "partner")
      .innerJoinAndSelect("partner.region", "region")
      .orderBy("rt.createdAt", "DESC");

    if (actor.role !== RoleCode.SUPER_USER) {
      qb.where("rt.partnerId = :partnerId", { partnerId: actor.partnerId });
    }

    const { skip, take } = toSkipTake(pagination);
    const [rows, total] = await qb.skip(skip).take(take).getManyAndCount();

    return { items: rows.map((row) => this.toResponse(row)), total };
  }

  public async create(
    actor: JwtUserPayload,
    dto: CreateRoomTypeDto
  ): Promise<RoomTypeResponse> {
    const partner = await this.requireHotelPartner(actor);

    const saved = await this.roomTypeRepo.save(
      this.roomTypeRepo.create({
        partnerId: partner.id,
        name: dto.name,
        description: dto.description ?? null,
        maxAdults: dto.maxAdults,
        maxChildren: dto.maxChildren,
        totalUnits: dto.totalUnits,
        basePrice: dto.basePrice,
        amenities: dto.amenities,
        images: dto.images,
        isActive: dto.isActive,
      })
    );

    return this.toResponse(await this.findRoomTypeOrFail(saved.id));
  }

  public async update(
    roomTypeId: string,
    actor: JwtUserPayload,
    dto: UpdateRoomTypeDto
  ): Promise<RoomTypeResponse> {
    const roomType = await this.findRoomTypeOrFail(roomTypeId);
    this.assertCanManage(roomType, actor);

    if (dto.name !== undefined) roomType.name = dto.name;
    if (dto.description !== undefined) roomType.description = dto.description;
    if (dto.maxAdults !== undefined) roomType.maxAdults = dto.maxAdults;
    if (dto.maxChildren !== undefined) roomType.maxChildren = dto.maxChildren;
    if (dto.totalUnits !== undefined) roomType.totalUnits = dto.totalUnits;
    if (dto.basePrice !== undefined) roomType.basePrice = dto.basePrice;
    if (dto.amenities !== undefined) roomType.amenities = dto.amenities;
    if (dto.images !== undefined) roomType.images = dto.images;
    if (dto.isActive !== undefined) roomType.isActive = dto.isActive;

    await this.roomTypeRepo.save(roomType);
    return this.toResponse(await this.findRoomTypeOrFail(roomTypeId));
  }

  /**
   * Carga o actualiza el inventario de un rango. Sin fila, la fecha usa
   * `totalUnits` y `basePrice` del tipo de habitación.
   */
  public async upsertInventory(
    roomTypeId: string,
    actor: JwtUserPayload,
    dto: InventoryRangeDto
  ): Promise<InventoryUpsertResponse> {
    const roomType = await this.findRoomTypeOrFail(roomTypeId);
    this.assertCanManage(roomType, actor);

    const dates = eachNight(dto.from, nextDay(dto.to));

    if (dates.length > MAX_INVENTORY_RANGE_DAYS) {
      throw new BadRequestError(
        `El rango no puede superar ${MAX_INVENTORY_RANGE_DAYS} días`,
        "INVENTORY_RANGE_TOO_LARGE"
      );
    }

    const existing = await this.inventoryRepo.find({
      where: { roomTypeId: roomType.id, date: In(dates) },
    });
    const byDate = new Map(existing.map((row) => [row.date, row] as const));

    let created = 0;
    let updated = 0;
    const toSave: RoomInventory[] = [];

    for (const date of dates) {
      const current = byDate.get(date);

      if (current) {
        if (dto.units !== undefined) current.units = dto.units;
        if (dto.price !== undefined) current.price = dto.price;
        if (dto.isClosed !== undefined) current.isClosed = dto.isClosed;
        toSave.push(current);
        updated += 1;
      } else {
        toSave.push(
          this.inventoryRepo.create({
            roomTypeId: roomType.id,
            date,
            units: dto.units ?? roomType.totalUnits,
            price: dto.price ?? roomType.basePrice,
            isClosed: dto.isClosed ?? false,
          })
        );
        created += 1;
      }
    }

    await this.inventoryRepo.save(toSave);

    return {
      roomTypeId: roomType.id,
      from: dto.from,
      to: dto.to,
      created,
      updated,
    };
  }

  public async listInventory(
    roomTypeId: string,
    actor: JwtUserPayload,
    from: string,
    to: string
  ): Promise<RoomInventoryResponse[]> {
    const roomType = await this.findRoomTypeOrFail(roomTypeId);
    this.assertCanManage(roomType, actor);

    const rows = await this.inventoryRepo
      .createQueryBuilder("inventory")
      .where("inventory.roomTypeId = :roomTypeId", { roomTypeId: roomType.id })
      .andWhere("inventory.date >= :from", { from })
      .andWhere("inventory.date <= :to", { to })
      .orderBy("inventory.date", "ASC")
      .getMany();

    return rows.map((row) => ({
      id: row.id,
      roomTypeId: row.roomTypeId,
      date: row.date,
      units: row.units,
      price: Number(row.price),
      isClosed: row.isClosed,
    }));
  }

  /**
   * Disponibilidad real por noches: cruza capacidad, cierres y tarifa de cada
   * fecha, y devuelve el total de la estancia. Base del cotizador.
   */
  public async searchAvailability(
    query: AvailabilityQuery
  ): Promise<{ items: AvailabilityItem[] | { date: string }[]; total: number }> {
    const nights = nightsBetween(query.checkIn, query.checkOut);

    if (nights < 1) {
      throw new BadRequestError(
        "checkOut debe ser posterior a checkIn",
        "INVALID_DATE_RANGE"
      );
    }

    if (nights > MAX_AVAILABILITY_NIGHTS) {
      throw new BadRequestError(
        `La estancia no puede superar ${MAX_AVAILABILITY_NIGHTS} noches`,
        "STAY_TOO_LONG"
      );
    }

    const categoryId = await this.hotelCategoryId();

    const qb = this.roomTypeRepo
      .createQueryBuilder("rt")
      .innerJoinAndSelect("rt.partner", "partner")
      .innerJoinAndSelect("partner.region", "region")
      .where("rt.isActive = true")
      .andWhere("partner.status = :partnerStatus", {
        partnerStatus: PartnerStatus.ACTIVE,
      })
      .andWhere("partner.categoryId = :categoryId", { categoryId })
      .andWhere("region.status = :regionStatus", {
        regionStatus: RegionStatus.ACTIVE,
      })
      .andWhere("rt.maxAdults >= :adults", { adults: query.adults })
      .andWhere("rt.maxChildren >= :children", { children: query.children })
      .orderBy("rt.basePrice", "ASC")
      .take(MAX_AVAILABILITY_CANDIDATES);

    if (query.regionId) {
      qb.andWhere("partner.regionId = :regionId", { regionId: query.regionId });
    }

    if (query.partnerId) {
      qb.andWhere("rt.partnerId = :partnerId", { partnerId: query.partnerId });
    }

    const candidates = await qb.getMany();

    if (candidates.length === 0) {
      return { items: [], total: 0 };
    }

    const starts = query.flexDays > 0
      ? availabilityDates(query.checkIn, query.flexDays)
      : [query.checkIn];
    if (starts.length === 0) return { items: [], total: 0 };
    const stays = starts.map((checkIn) => {
      const checkOut = shiftDate(checkIn, nights);
      return { checkIn, checkOut, dates: eachNight(checkIn, checkOut) };
    });
    const dates = [...new Set(stays.flatMap((stay) => stay.dates))];
    const inventoryRows = await this.inventoryRepo.find({
      where: { roomTypeId: In(candidates.map((rt) => rt.id)), date: In(dates) },
    });

    const byRoomDate = new Map(
      inventoryRows.map((row) => [`${row.roomTypeId}|${row.date}`, row] as const)
    );

    const available: AvailabilityItem[] = [];
    const availableDates: { date: string }[] = [];

    for (const stay of stays) {
      for (const roomType of candidates) {
        let totalPrice = 0;
        const nightly: AvailabilityItem["nightly"] = [];
        let isAvailable = true;

        for (const date of stay.dates) {
          const row = byRoomDate.get(`${roomType.id}|${date}`);
          const units = row?.units ?? roomType.totalUnits;
          const isClosed = row?.isClosed ?? false;

          if (isClosed || units < 1) {
            isAvailable = false;
            break;
          }

          const price = Number(row?.price ?? roomType.basePrice);
          totalPrice += price;
          nightly.push({ date, price });
        }

        if (!isAvailable) {
          continue;
        }

        if (query.flexDays > 0) {
          availableDates.push({ date: stay.checkIn });
          break;
        }
        available.push({
          roomTypeId: roomType.id,
          roomTypeName: roomType.name,
          partnerId: roomType.partnerId,
          partnerName: roomType.partner.commercialName,
          regionId: roomType.partner.regionId,
          regionName: roomType.partner.region?.name ?? "",
          maxAdults: roomType.maxAdults,
          maxChildren: roomType.maxChildren,
          amenities: roomType.amenities ?? [],
          checkIn: stay.checkIn,
          checkOut: stay.checkOut,
          nights,
          nightly,
          totalPrice: Math.round(totalPrice * 100) / 100,
          currency: "MXN",
        });
      }
    }

    const { skip } = toSkipTake(query);
    if (query.flexDays > 0) {
      return { items: availableDates.slice(skip, skip + query.limit), total: availableDates.length };
    }
    const paged = available.slice(skip, skip + query.limit);

    return { items: paged, total: available.length };
  }
}
