import crypto from "node:crypto";
import { In } from "typeorm";
import { AppDataSource } from "../../../core/bd/index.js";
import { METACONFIG } from "../../../core/metaconfig/index.js";
import { Package, PackageStatus } from "../../../core/bd/entities/Package.js";
import {
  DepartureStatus,
  PackageDeparture,
} from "../../../core/bd/entities/PackageDeparture.js";
import {
  DiscountType,
  PackagePromotion,
  PromotionStatus,
} from "../../../core/bd/entities/PackagePromotion.js";
import { PartnerStatus } from "../../../core/bd/entities/Partner.js";
import { RoomType } from "../../../core/bd/entities/RoomType.js";
import { RoomInventory } from "../../../core/bd/entities/RoomInventory.js";
import {
  ExperienceSlot,
  SlotStatus,
} from "../../../core/bd/entities/ExperienceSlot.js";
import { Quote } from "../../../core/bd/entities/Quote.js";
import { RegionStatus } from "../../../core/bd/entities/Region.entity.js";
import { departureHolds } from "../../package/services/departure-holds.js";
import { MAX_AVAILABILITY_NIGHTS } from "../../hotel/services/HotelService.js";
import {
  BadRequestError,
  GoneError,
  NotFoundError,
} from "../../../core/errors/index.js";
import type { CreateQuoteDto, QuoteSelection } from "../dto/index.js";
import type { QuoteLineResponse, QuoteResponse } from "../responses/index.js";

function round2(value: number): number {
  return Math.round(value * 100) / 100;
}

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

/**
 * Motor de cotización. Recalcula siempre contra la fuente (inventario, cupo y
 * promoción vigente): el cliente solo manda ids y cantidades, nunca precios.
 */
export class QuoteService {
  private readonly quoteRepo = AppDataSource.getRepository(Quote);
  private readonly departureRepo = AppDataSource.getRepository(PackageDeparture);
  private readonly promotionRepo = AppDataSource.getRepository(PackagePromotion);
  private readonly roomTypeRepo = AppDataSource.getRepository(RoomType);
  private readonly inventoryRepo = AppDataSource.getRepository(RoomInventory);
  private readonly slotRepo = AppDataSource.getRepository(ExperienceSlot);

  private generateReference(): string {
    return `QT-${crypto.randomBytes(4).toString("hex").toUpperCase()}`;
  }

  private async packageDiscount(
    packageId: string,
    departureDate: string,
    travelers: number,
    subtotal: number
  ): Promise<number> {
    const promotions = await this.promotionRepo.find({
      where: { packageId, status: PromotionStatus.ACTIVE },
    });

    const weekday = new Date(`${departureDate}T00:00:00Z`).getUTCDay();
    let best = 0;

    for (const promotion of promotions) {
      if (departureDate < promotion.validFrom) continue;
      if (departureDate > promotion.validTo) continue;

      if (
        promotion.minTravelers !== null &&
        travelers < promotion.minTravelers
      ) {
        continue;
      }

      if (
        promotion.daysOfWeek !== null &&
        !promotion.daysOfWeek.includes(weekday)
      ) {
        continue;
      }

      const value = Number(promotion.discountValue);
      const discount =
        promotion.discountType === DiscountType.PERCENTAGE
          ? (subtotal * value) / 100
          : value;

      best = Math.max(best, discount);
    }

    return round2(Math.min(best, subtotal));
  }

  private async pricePackageDeparture(
    item: Extract<QuoteSelection, { type: "package_departure" }>
  ): Promise<QuoteLineResponse> {
    const departure = await this.departureRepo.findOne({
      where: { id: item.departureId },
      relations: { package: { partner: true, destinationRegion: true } },
    });

    if (!departure) {
      throw new NotFoundError("Salida no encontrada", "DEPARTURE_NOT_FOUND");
    }

    const pkg: Package = departure.package;

    if (
      pkg.status !== PackageStatus.PUBLISHED ||
      pkg.destinationRegion.status !== RegionStatus.ACTIVE
    ) {
      throw new BadRequestError(
        "El paquete no está publicado",
        "PACKAGE_NOT_AVAILABLE"
      );
    }

    if (pkg.partner.status !== PartnerStatus.ACTIVE) {
      throw new BadRequestError(
        "La agencia no está activa",
        "PARTNER_INACTIVE"
      );
    }

    const travelers = item.adults + item.children;
    const holds = await departureHolds(AppDataSource.manager, [departure.id]);
    const available = departure.totalSeats - departure.soldSeats - (holds.get(departure.id) ?? 0);

    if (
      departure.status !== DepartureStatus.OPEN ||
      departure.departureDate < new Date().toISOString().slice(0, 10) ||
      available < travelers
    ) {
      throw new BadRequestError(
        "No hay cupo suficiente para esta salida",
        "INSUFFICIENT_AVAILABILITY"
      );
    }

    const adultPrice = Number(departure.adultPrice);
    const childPrice = Number(departure.childPrice ?? departure.adultPrice);
    const subtotal = round2(
      adultPrice * item.adults + childPrice * item.children
    );
    const discount = await this.packageDiscount(
      pkg.id,
      departure.departureDate,
      travelers,
      subtotal
    );
    const taxes = pkg.taxesIncluded
      ? 0
      : round2((subtotal - discount) * METACONFIG.quote.taxRate);

    return {
      type: "package_departure",
      refId: departure.id,
      title: pkg.name,
      partnerId: pkg.partnerId,
      partnerName: pkg.partner.commercialName,
      quantity: travelers,
      quantityLabel: "viajeros",
      unitPrice: adultPrice,
      subtotal,
      discount,
      taxes,
      taxesIncluded: pkg.taxesIncluded,
      total: round2(subtotal - discount + taxes),
      detail: {
        departureDate: departure.departureDate,
        nights: pkg.nights,
        adults: item.adults,
        children: item.children,
      },
    };
  }

  private async priceRoomStay(
    item: Extract<QuoteSelection, { type: "room_stay" }>
  ): Promise<QuoteLineResponse> {
    const roomType = await this.roomTypeRepo.findOne({
      where: { id: item.roomTypeId },
      relations: { partner: true },
    });

    if (!roomType || !roomType.isActive) {
      throw new NotFoundError(
        "El tipo de habitación no está disponible",
        "ROOM_TYPE_NOT_FOUND"
      );
    }

    if (roomType.partner.status !== PartnerStatus.ACTIVE) {
      throw new BadRequestError("El hotel no está activo", "PARTNER_INACTIVE");
    }

    if (
      item.adults > roomType.maxAdults ||
      item.children > roomType.maxChildren
    ) {
      throw new BadRequestError(
        "La habitación no tiene capacidad para esos huéspedes",
        "ROOM_CAPACITY_EXCEEDED"
      );
    }

    const nights = nightsBetween(item.checkIn, item.checkOut);

    if (nights < 1) {
      throw new BadRequestError(
        "checkOut debe ser posterior a checkIn",
        "INVALID_DATE_RANGE"
      );
    }

    if (nights > MAX_AVAILABILITY_NIGHTS || item.checkIn < new Date().toISOString().slice(0, 10)) {
      throw new BadRequestError(
        "La estancia debe comenzar hoy o después y durar como máximo 30 noches",
        "INVALID_DATE_RANGE"
      );
    }

    const dates = eachNight(item.checkIn, item.checkOut);
    const rows = await this.inventoryRepo.find({
      where: { roomTypeId: roomType.id, date: In(dates) },
    });
    const byDate = new Map(rows.map((row) => [row.date, row] as const));

    let subtotal = 0;

    for (const date of dates) {
      const row = byDate.get(date);
      const units = row?.units ?? roomType.totalUnits;

      if ((row?.isClosed ?? false) || units < 1) {
        throw new BadRequestError(
          `No hay disponibilidad para la noche ${date}`,
          "INSUFFICIENT_AVAILABILITY"
        );
      }

      subtotal += Number(row?.price ?? roomType.basePrice);
    }

    subtotal = round2(subtotal);

    return {
      type: "room_stay",
      refId: roomType.id,
      title: `${roomType.name} · ${roomType.partner.commercialName}`,
      partnerId: roomType.partnerId,
      partnerName: roomType.partner.commercialName,
      quantity: nights,
      quantityLabel: "noches",
      unitPrice: round2(subtotal / nights),
      subtotal,
      discount: 0,
      taxes: 0,
      taxesIncluded: true,
      total: subtotal,
      detail: {
        checkIn: item.checkIn,
        checkOut: item.checkOut,
        adults: item.adults,
        children: item.children,
      },
    };
  }

  private async priceExperienceSlot(
    item: Extract<QuoteSelection, { type: "experience_slot" }>
  ): Promise<QuoteLineResponse> {
    const slot = await this.slotRepo.findOne({
      where: { id: item.slotId },
      relations: { experience: { partner: true } },
    });

    if (!slot) {
      throw new NotFoundError("Turno no encontrado", "SLOT_NOT_FOUND");
    }

    const experience = slot.experience;

    if (!experience.isActive) {
      throw new BadRequestError(
        "La experiencia no está disponible",
        "EXPERIENCE_NOT_AVAILABLE"
      );
    }

    if (experience.partner.status !== PartnerStatus.ACTIVE) {
      throw new BadRequestError(
        "El operador no está activo",
        "PARTNER_INACTIVE"
      );
    }

    const travelers = item.adults + item.children;
    const remaining = slot.capacity - slot.booked;

    if (
      slot.status !== SlotStatus.OPEN ||
      slot.date < new Date().toISOString().slice(0, 10) ||
      remaining < travelers
    ) {
      throw new BadRequestError(
        "No hay lugares suficientes en este turno",
        "INSUFFICIENT_AVAILABILITY"
      );
    }

    const adultPrice = Number(experience.priceAdult);
    const childPrice = Number(experience.priceChild ?? experience.priceAdult);
    const subtotal = round2(
      adultPrice * item.adults + childPrice * item.children
    );

    return {
      type: "experience_slot",
      refId: slot.id,
      title: experience.name,
      partnerId: experience.partnerId,
      partnerName: experience.partner.commercialName,
      quantity: travelers,
      quantityLabel: "viajeros",
      unitPrice: adultPrice,
      subtotal,
      discount: 0,
      taxes: 0,
      taxesIncluded: true,
      total: subtotal,
      detail: {
        date: slot.date,
        startTime: slot.startTime,
        durationMinutes: experience.durationMinutes,
        adults: item.adults,
        children: item.children,
      },
    };
  }

  public async create(dto: CreateQuoteDto, clientId: string): Promise<QuoteResponse> {
    const lines: QuoteLineResponse[] = [];
    const selections = new Set<string>();

    for (const item of dto.items) {
      const line = item.type === "package_departure"
        ? await this.pricePackageDeparture(item)
        : item.type === "room_stay"
          ? await this.priceRoomStay(item)
          : await this.priceExperienceSlot(item);
      const keys = item.type === "room_stay"
        ? eachNight(item.checkIn, item.checkOut)
          .map((date) => `room:${item.roomTypeId}:${date}`)
        : [item.type === "package_departure" ? `departure:${item.departureId}` : `slot:${item.slotId}`];
      if (keys.some((key) => selections.has(key))) {
        throw new BadRequestError(
          "Une en una sola selección los servicios que comparten el mismo inventario",
          "DUPLICATE_QUOTE_INVENTORY"
        );
      }
      keys.forEach((key) => selections.add(key));
      lines.push(line);
    }

    const subtotal = round2(lines.reduce((sum, line) => sum + line.subtotal, 0));
    const discountTotal = round2(
      lines.reduce((sum, line) => sum + line.discount, 0)
    );
    const taxesTotal = round2(lines.reduce((sum, line) => sum + line.taxes, 0));
    const total = round2(subtotal - discountTotal + taxesTotal);
    const expiresAt = new Date(
      Date.now() + METACONFIG.quote.ttlMinutes * 60 * 1000
    );

    const quote = this.quoteRepo.create({
      clientId,
      reference: this.generateReference(),
      currency: "MXN",
      subtotal,
      discountTotal,
      taxesTotal,
      total,
      items: dto.items,
      breakdown: lines,
      expiresAt,
    });

    const saved = await this.quoteRepo.save(quote);
    return this.toResponse(saved);
  }

  public async getById(quoteId: string, clientId: string): Promise<QuoteResponse> {
    const quote = await this.quoteRepo.findOne({ where: { id: quoteId } });

    if (!quote || (quote.clientId !== null && quote.clientId !== clientId)) {
      throw new NotFoundError("Cotización no encontrada", "QUOTE_NOT_FOUND");
    }

    if (quote.expiresAt.getTime() <= Date.now()) {
      throw new GoneError(
        "La cotización expiró. Genera una nueva para continuar.",
        "QUOTE_EXPIRED"
      );
    }

    return this.toResponse(quote);
  }

  private toResponse(quote: Quote): QuoteResponse {
    return {
      quoteId: quote.id,
      reference: quote.reference,
      currency: quote.currency,
      items: quote.breakdown as QuoteLineResponse[],
      subtotal: Number(quote.subtotal),
      discountTotal: Number(quote.discountTotal),
      taxesTotal: Number(quote.taxesTotal),
      total: Number(quote.total),
      expiresAt: quote.expiresAt.toISOString(),
      createdAt: quote.createdAt.toISOString(),
    };
  }
}
