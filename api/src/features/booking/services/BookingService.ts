import crypto from "node:crypto";
import QRCode from "qrcode";
import type { EntityManager } from "typeorm";
import { AppDataSource } from "../../../core/bd/index.js";
import { Booking, type BookingItemType } from "../../../core/bd/entities/Booking.js";
import { PackageStatus } from "../../../core/bd/entities/Package.js";
import { DepartureStatus, PackageDeparture } from "../../../core/bd/entities/PackageDeparture.js";
import { RoomType } from "../../../core/bd/entities/RoomType.js";
import { RoomInventory } from "../../../core/bd/entities/RoomInventory.js";
import { ExperienceSlot, SlotStatus } from "../../../core/bd/entities/ExperienceSlot.js";
import { Experience } from "../../../core/bd/entities/Experience.js";
import { PartnerStatus } from "../../../core/bd/entities/Partner.js";
import { Quote } from "../../../core/bd/entities/Quote.js";
import { RegionStatus } from "../../../core/bd/entities/Region.entity.js";
import { BadRequestError, ConflictError, GoneError, NotFoundError } from "../../../core/errors/index.js";
import { HttpError } from "../../../core/errors/HttpError.js";
import { departureHolds, activeDepartureHold } from "../../package/services/departure-holds.js";
import { createQuoteSchema } from "../../quote/dto/index.js";
import { MailService } from "../../../core/mail/index.js";
import { PayPalClient, type PayPalOrder } from "./PayPalClient.js";

const HOLD_DURATION_MS = 15 * 60 * 1000;

function eachNight(from: string, toExclusive: string): string[] {
  const nights: string[] = [];
  const start = Date.parse(`${from}T00:00:00Z`);
  const end = Date.parse(`${toExclusive}T00:00:00Z`);
  for (let cursor = start; cursor < end; cursor += 86_400_000) {
    nights.push(new Date(cursor).toISOString().slice(0, 10));
  }
  return nights;
}

export interface TravelerInfo {
  name?: string | undefined;
  email?: string | undefined;
}

export class BookingService {
  /** Sin caracteres ambiguos: se dicta por teléfono o se escanea sin errores. */
  private static readonly REFERENCE_ALPHABET = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";

  private readonly mail = new MailService();

  constructor(public readonly paypal = new PayPalClient()) {}

  private get repo() {
    return AppDataSource.getRepository(Booking);
  }

  public async checkout(
    quoteId: string,
    clientId: string,
    travelerRef: string,
    travelerInfo?: TravelerInfo
  ) {
    this.paypal.assertEnabled();
    const booking = await AppDataSource.transaction("READ COMMITTED", async (manager) => {
      const quote = await manager.findOne(Quote, {
        where: { id: quoteId, clientId },
        lock: { mode: "pessimistic_write" },
      });
      if (!quote) throw new NotFoundError("Cotización no encontrada", "QUOTE_NOT_FOUND");

      const existing = await manager.findOne(Booking, { where: { quoteId } });
      if (existing) {
        if (existing.travelerRef !== travelerRef) {
          throw new NotFoundError("Cotización no encontrada", "QUOTE_NOT_FOUND");
        }
        return existing;
      }
      if (quote.expiresAt.getTime() <= Date.now()) {
        throw new GoneError("La cotización venció", "QUOTE_EXPIRED");
      }

      const parsed = createQuoteSchema.safeParse({ items: quote.items });
      const item = parsed.success && parsed.data.items.length === 1 ? parsed.data.items[0] : undefined;
      if (!item) {
        throw new BadRequestError(
          "El pago está habilitado para cotizaciones de un solo servicio por compra",
          "BOOKING_ITEM_NOT_SUPPORTED"
        );
      }
      if (Number(quote.total) <= 0) {
        throw new BadRequestError("El total debe ser mayor que cero para pagar con PayPal", "BOOKING_TOTAL_INVALID");
      }

      const todayStr = new Date().toISOString().slice(0, 10);
      let itemType: BookingItemType;
      let itemId: string;
      let departureId: string | null = null;
      let seats: number;
      let itemDetail: Record<string, unknown>;

      if (item.type === "package_departure") {
        itemType = "package_departure";
        const departure = await manager.findOne(PackageDeparture, {
          where: { id: item.departureId },
          lock: { mode: "pessimistic_write" },
        });
        if (
          !departure ||
          departure.status !== DepartureStatus.OPEN ||
          departure.departureDate < todayStr
        ) {
          throw new ConflictError("La salida ya no está disponible", "DEPARTURE_NOT_AVAILABLE");
        }
        const currentOffer = await manager.findOne(PackageDeparture, {
          where: { id: departure.id },
          relations: { package: { partner: true, destinationRegion: true } },
        });
        const pkg = currentOffer?.package;
        if (
          !pkg ||
          pkg.status !== PackageStatus.PUBLISHED ||
          pkg.partner.status !== PartnerStatus.ACTIVE ||
          pkg.destinationRegion.status !== RegionStatus.ACTIVE
        ) {
          throw new ConflictError("El paquete ya no está disponible", "PACKAGE_NOT_AVAILABLE");
        }

        seats = item.adults + item.children;
        const holds = await departureHolds(manager, [departure.id]);
        if (departure.totalSeats - departure.soldSeats - (holds.get(departure.id) ?? 0) < seats) {
          throw new ConflictError("Ya no hay lugares suficientes", "INSUFFICIENT_AVAILABILITY");
        }

        itemId = departure.id;
        departureId = departure.id;
        itemDetail = {
          departureDate: departure.departureDate,
          adults: item.adults,
          children: item.children,
          travelerName: travelerInfo?.name,
          travelerEmail: travelerInfo?.email,
        };
      } else if (item.type === "room_stay") {
        itemType = "room_stay";
        const roomType = await manager.findOne(RoomType, {
          where: { id: item.roomTypeId },
          relations: { partner: true },
          lock: { mode: "pessimistic_write" },
        });
        if (!roomType || !roomType.isActive || roomType.partner.status !== PartnerStatus.ACTIVE) {
          throw new ConflictError("La habitación ya no está disponible", "ROOM_NOT_AVAILABLE");
        }
        if (item.checkIn < todayStr || item.checkOut <= item.checkIn) {
          throw new ConflictError("Las fechas de estancia no son válidas", "INVALID_DATE_RANGE");
        }

        seats = item.adults + item.children;
        const dates = eachNight(item.checkIn, item.checkOut);

        // Validar disponibilidad de inventario para cada noche
        for (const date of dates) {
          const invRow = await manager.findOne(RoomInventory, {
            where: { roomTypeId: roomType.id, date },
          });
          const availableUnits = invRow?.units ?? roomType.totalUnits;
          if (invRow?.isClosed || availableUnits < 1) {
            throw new ConflictError(`No hay disponibilidad para la fecha ${date}`, "INSUFFICIENT_AVAILABILITY");
          }
        }

        itemId = roomType.id;
        itemDetail = {
          checkIn: item.checkIn,
          checkOut: item.checkOut,
          adults: item.adults,
          children: item.children,
          travelerName: travelerInfo?.name,
          travelerEmail: travelerInfo?.email,
        };
      } else if (item.type === "experience_slot") {
        itemType = "experience_slot";
        const slot = await manager.findOne(ExperienceSlot, {
          where: { id: item.slotId },
          relations: { experience: { partner: true } },
          lock: { mode: "pessimistic_write" },
        });
        if (
          !slot ||
          slot.status !== SlotStatus.OPEN ||
          slot.date < todayStr ||
          slot.experience.partner.status !== PartnerStatus.ACTIVE
        ) {
          throw new ConflictError("El turno de la experiencia ya no está disponible", "SLOT_NOT_AVAILABLE");
        }

        seats = item.adults + item.children;

        // Comprobar aforo disponible considerando apartados activos
        const holdCount = await manager
          .getRepository(Booking)
          .createQueryBuilder("booking")
          .select("SUM(booking.seats)", "seats")
          .where("booking.itemId = :itemId AND booking.itemType = 'experience_slot'", { itemId: slot.id })
          .andWhere(activeDepartureHold)
          .getRawOne<{ seats: string }>();

        const activeHolds = Number(holdCount?.seats ?? 0);
        if (slot.capacity - slot.booked - activeHolds < seats) {
          throw new ConflictError("Ya no hay aforo suficiente para este turno", "INSUFFICIENT_AVAILABILITY");
        }

        itemId = slot.id;
        itemDetail = {
          date: slot.date,
          startTime: slot.startTime,
          adults: item.adults,
          children: item.children,
          travelerName: travelerInfo?.name,
          travelerEmail: travelerInfo?.email,
        };
      } else {
        throw new BadRequestError("Tipo de servicio no soportado", "BOOKING_ITEM_NOT_SUPPORTED");
      }

      return manager.save(
        Booking,
        manager.create(Booking, {
          reference: await this.nextReference(manager),
          quoteId,
          itemType,
          itemId,
          departureId,
          itemDetail,
          clientId,
          travelerRef,
          seats,
          total: Number(quote.total).toFixed(2),
          currency: quote.currency,
          status: "pending_payment",
          expiresAt: new Date(Date.now() + HOLD_DURATION_MS),
          paypalOrderId: null,
          paypalApprovalUrl: null,
          paypalCaptureId: null,
        })
      );
    });

    if (booking.status === "pending_payment" && booking.expiresAt.getTime() > Date.now() && !booking.paypalOrderId) {
      const order = await this.paypal.createOrder(booking);
      const approval = order.links?.find(({ rel }) => rel === "payer-action" || rel === "approve")?.href;
      if (!order.id || !approval?.startsWith("https://")) {
        throw new HttpError(502, "PayPal no devolvió el enlace de aprobación", { code: "PAYPAL_LINK_MISSING" });
      }
      await this.repo.update(
        { id: booking.id, status: "pending_payment" },
        {
          paypalOrderId: order.id,
          paypalApprovalUrl: approval,
        }
      );
    }
    return this.get(booking.id, clientId, travelerRef, false);
  }

  public async get(bookingId: string, clientId: string, travelerRef: string, refresh = true) {
    let booking = await this.repo.findOne({ where: { id: bookingId, clientId, travelerRef } });
    if (!booking) throw new NotFoundError("Reserva no encontrada", "BOOKING_NOT_FOUND");

    if (refresh && booking.paypalOrderId) {
      await this.reconcile(booking.paypalOrderId);
      booking = await this.repo.findOneByOrFail({ id: booking.id });
    }
    const status =
      booking.status === "pending_payment" && booking.expiresAt.getTime() <= Date.now()
        ? "expired"
        : booking.status;
    const ticket = status === "confirmed" ? await this.loadTicket(booking) : null;
    return {
      bookingId: booking.id,
      reference: booking.reference,
      status,
      total: Number(booking.total),
      currency: booking.currency,
      expiresAt: booking.expiresAt.toISOString(),
      paymentUrl: status === "pending_payment" ? booking.paypalApprovalUrl : null,
      ticket,
    };
  }

  public async reconcile(orderId: string): Promise<void> {
    const booking = await this.repo.findOne({ where: { paypalOrderId: orderId } });
    if (!booking || !["pending_payment", "capturing"].includes(booking.status)) return;
    if (booking.status === "pending_payment" && booking.expiresAt.getTime() <= Date.now()) return;

    let order = await this.paypal.getOrder(orderId);
    if (order.status === "APPROVED") {
      const result = await AppDataSource.transaction(async (manager) => {
        if (booking.itemType === "package_departure" && booking.departureId) {
          await manager.findOne(PackageDeparture, {
            where: { id: booking.departureId },
            lock: { mode: "pessimistic_write" },
          });
        } else if (booking.itemType === "room_stay") {
          await manager.findOne(RoomType, {
            where: { id: booking.itemId },
            lock: { mode: "pessimistic_write" },
          });
        } else if (booking.itemType === "experience_slot") {
          await manager.findOne(ExperienceSlot, {
            where: { id: booking.itemId },
            lock: { mode: "pessimistic_write" },
          });
        }
        return manager
          .createQueryBuilder()
          .update(Booking)
          .set({ status: "capturing" })
          .where("id = :id AND status = 'pending_payment' AND expires_at > CURRENT_TIMESTAMP(6)", { id: booking.id })
          .execute();
      });
      if (!result.affected) {
        const current = await this.repo.findOneByOrFail({ id: booking.id });
        if (current.status !== "capturing") return;
      }
      order = await this.paypal.captureOrder(booking.id, orderId);
    }
    await this.applyOrder(booking, order);
  }

  private async applyOrder(original: Booking, order: PayPalOrder): Promise<void> {
    const id = original.id;
    const unit = order.purchase_units?.find((candidate) => candidate.reference_id === id);
    const capture = unit?.payments?.captures?.find((candidate) => candidate.status === "COMPLETED");
    if (!capture) {
      const status = unit?.payments?.captures?.[0]?.status;
      if (order.status === "VOIDED" || status === "DECLINED" || status === "FAILED" || status === "DENIED") {
        await this.repo.update({ id, status: "capturing" }, { status: "payment_failed" });
      }
      return;
    }

    const confirmed = await AppDataSource.transaction(async (manager) => {
      const booking = await manager.findOne(Booking, {
        where: { id },
        lock: { mode: "pessimistic_write" },
      });
      if (!booking || booking.status !== "capturing") return false;
      if (
        order.id !== booking.paypalOrderId ||
        capture.amount.currency_code !== booking.currency ||
        capture.amount.value !== booking.total
      ) {
        throw new HttpError(502, "El pago requiere conciliación", { code: "PAYPAL_CAPTURE_MISMATCH" });
      }

      // Descontar inventario definitivo según el tipo de servicio
      if (booking.itemType === "package_departure" && booking.departureId) {
        await manager.increment(PackageDeparture, { id: booking.departureId }, "soldSeats", booking.seats);
      } else if (booking.itemType === "experience_slot") {
        await manager.increment(ExperienceSlot, { id: booking.itemId }, "booked", booking.seats);
      } else if (booking.itemType === "room_stay") {
        const detail = (booking.itemDetail as Record<string, unknown>) || {};
        if (typeof detail.checkIn === "string" && typeof detail.checkOut === "string") {
          const dates = eachNight(detail.checkIn, detail.checkOut);
          for (const d of dates) {
            const existingInv = await manager.findOne(RoomInventory, {
              where: { roomTypeId: booking.itemId, date: d },
            });
            if (existingInv) {
              await manager.update(RoomInventory, { id: existingInv.id }, {
                units: Math.max(0, existingInv.units - 1),
              });
            } else {
              const rt = await manager.findOneBy(RoomType, { id: booking.itemId });
              if (rt) {
                await manager.save(
                  RoomInventory,
                  manager.create(RoomInventory, {
                    roomTypeId: rt.id,
                    date: d,
                    units: Math.max(0, rt.totalUnits - 1),
                    price: rt.basePrice,
                    isClosed: false,
                  })
                );
              }
            }
          }
        }
      }

      const updated = await manager.update(Booking, booking.id, {
        status: "confirmed",
        paypalCaptureId: capture.id,
      });
      return (updated.affected ?? 0) > 0;
    });

    if (confirmed) await this.notifyProvider(id);
  }

  /** Clave maestra `TRV-XXXXXX`, comprobada contra la base para no repetirla. */
  private async nextReference(manager: EntityManager): Promise<string> {
    for (let intento = 0; intento < 5; intento++) {
      const caracteres = Array.from({ length: 6 }, () =>
        BookingService.REFERENCE_ALPHABET.charAt(
          crypto.randomInt(BookingService.REFERENCE_ALPHABET.length)
        )
      ).join("");
      const candidato = `TRV-${caracteres}`;
      const existente = await manager.findOne(Booking, { where: { reference: candidato } });
      if (!existente) return candidato;
    }
    throw new HttpError(500, "No se pudo generar la clave de la reserva", {
      code: "BOOKING_REFERENCE_FAILED",
    });
  }

  /** Datos del comprobante según el tipo de servicio contratado. */
  private async loadTicket(booking: Booking) {
    if (booking.itemType === "room_stay") {
      const roomType = await this.repo.manager.findOne(RoomType, {
        where: { id: booking.itemId },
        relations: { partner: true },
      });
      const detail = (booking.itemDetail as Record<string, unknown>) || {};
      return {
        reference: booking.reference,
        itemType: "room_stay",
        roomTypeName: roomType?.name ?? null,
        partnerName: roomType?.partner?.commercialName ?? null,
        destinationRegionName: null,
        checkIn: (detail.checkIn as string) ?? null,
        checkOut: (detail.checkOut as string) ?? null,
        seats: booking.seats,
        total: Number(booking.total),
        currency: booking.currency,
      };
    }

    if (booking.itemType === "experience_slot") {
      const slot = await this.repo.manager.findOne(ExperienceSlot, {
        where: { id: booking.itemId },
        relations: { experience: { partner: true, region: true } },
      });
      const exp = slot?.experience;
      const detail = (booking.itemDetail as Record<string, unknown>) || {};
      return {
        reference: booking.reference,
        itemType: "experience_slot",
        experienceName: exp?.name ?? null,
        partnerName: exp?.partner?.commercialName ?? null,
        destinationRegionName: exp?.region?.name ?? null,
        date: slot?.date ?? (detail.date as string) ?? null,
        startTime: slot?.startTime ?? (detail.startTime as string) ?? null,
        seats: booking.seats,
        total: Number(booking.total),
        currency: booking.currency,
      };
    }

    // Default: package_departure
    const departure = await this.repo.manager.findOne(PackageDeparture, {
      where: { id: booking.departureId || booking.itemId },
      relations: { package: { partner: true, destinationRegion: true } },
    });
    const pkg = departure?.package;
    return {
      reference: booking.reference,
      itemType: "package_departure",
      packageName: pkg?.name ?? null,
      partnerName: pkg?.partner?.commercialName ?? null,
      destinationRegionName: pkg?.destinationRegion?.name ?? null,
      departureDate: departure?.departureDate ?? null,
      seats: booking.seats,
      total: Number(booking.total),
      currency: booking.currency,
    };
  }

  /**
   * QR del comprobante. Codifica solo la clave maestra: no expone datos personales
   * y el proveedor la valida escaneándola contra la API.
   */
  public async qrPng(bookingId: string, clientId: string, travelerRef: string): Promise<Buffer> {
    const booking = await this.repo.findOne({
      where: { id: bookingId, clientId, travelerRef },
    });
    if (!booking) throw new NotFoundError("Reserva no encontrada", "BOOKING_NOT_FOUND");

    return QRCode.toBuffer(booking.reference, {
      type: "png",
      width: 320,
      margin: 1,
      color: { dark: "#111111", light: "#FFFFFF" },
    });
  }

  /** Avisa al socio de la venta; un fallo de correo no revierte el cobro. */
  private async notifyProvider(bookingId: string): Promise<void> {
    try {
      const booking = await this.repo.findOneBy({ id: bookingId });
      if (!booking) return;

      if (booking.itemType === "room_stay") {
        const roomType = await this.repo.manager.findOne(RoomType, {
          where: { id: booking.itemId },
          relations: { partner: true },
        });
        if (!roomType) return;
        const detail = (booking.itemDetail as Record<string, unknown>) || {};
        await this.mail.sendBookingConfirmedEmail({
          to: roomType.partner.contactEmail,
          partnerName: roomType.partner.commercialName,
          packageName: roomType.name,
          reference: booking.reference,
          departureDate: `${detail.checkIn ?? ""} al ${detail.checkOut ?? ""}`,
          seats: booking.seats,
          total: Number(booking.total),
          currency: booking.currency,
          travelerRef: booking.travelerRef,
        });
        return;
      }

      if (booking.itemType === "experience_slot") {
        const slot = await this.repo.manager.findOne(ExperienceSlot, {
          where: { id: booking.itemId },
          relations: { experience: { partner: true } },
        });
        if (!slot) return;
        await this.mail.sendBookingConfirmedEmail({
          to: slot.experience.partner.contactEmail,
          partnerName: slot.experience.partner.commercialName,
          packageName: slot.experience.name,
          reference: booking.reference,
          departureDate: `${slot.date} a las ${slot.startTime}`,
          seats: booking.seats,
          total: Number(booking.total),
          currency: booking.currency,
          travelerRef: booking.travelerRef,
        });
        return;
      }

      // Default: package_departure
      const departure = await this.repo.manager.findOne(PackageDeparture, {
        where: { id: booking.departureId || booking.itemId },
        relations: { package: { partner: true } },
      });
      const pkg = departure?.package;
      if (!departure || !pkg) return;

      await this.mail.sendBookingConfirmedEmail({
        to: pkg.partner.contactEmail,
        partnerName: pkg.partner.commercialName,
        packageName: pkg.name,
        reference: booking.reference,
        departureDate: departure.departureDate,
        seats: booking.seats,
        total: Number(booking.total),
        currency: booking.currency,
        travelerRef: booking.travelerRef,
      });
    } catch (error) {
      console.error("[mail] no se pudo avisar al socio de la reserva", {
        bookingId,
        error: error instanceof Error ? error.message : String(error),
      });
    }
  }
}
