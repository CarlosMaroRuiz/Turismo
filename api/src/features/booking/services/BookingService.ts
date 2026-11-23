import { AppDataSource } from "../../../core/bd/index.js";
import { Booking } from "../../../core/bd/entities/Booking.js";
import { PackageStatus } from "../../../core/bd/entities/Package.js";
import { DepartureStatus, PackageDeparture } from "../../../core/bd/entities/PackageDeparture.js";
import { PartnerStatus } from "../../../core/bd/entities/Partner.js";
import { Quote } from "../../../core/bd/entities/Quote.js";
import { RegionStatus } from "../../../core/bd/entities/Region.entity.js";
import { BadRequestError, ConflictError, GoneError, NotFoundError } from "../../../core/errors/index.js";
import { HttpError } from "../../../core/errors/HttpError.js";
import { departureHolds } from "../../package/services/departure-holds.js";
import { createQuoteSchema } from "../../quote/dto/index.js";
import { PayPalClient, type PayPalOrder } from "./PayPalClient.js";

const HOLD_DURATION_MS = 15 * 60 * 1000;

export class BookingService {
  constructor(public readonly paypal = new PayPalClient()) {}

  private get repo() {
    return AppDataSource.getRepository(Booking);
  }

  public async checkout(quoteId: string, clientId: string, travelerRef: string) {
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
      if (item?.type !== "package_departure") {
        throw new BadRequestError("El pago está habilitado para cotizaciones de una sola salida de paquete", "BOOKING_ITEM_NOT_SUPPORTED");
      }
      if (Number(quote.total) <= 0) {
        throw new BadRequestError("El total debe ser mayor que cero para pagar con PayPal", "BOOKING_TOTAL_INVALID");
      }

      const departure = await manager.findOne(PackageDeparture, {
        where: { id: item.departureId },
        lock: { mode: "pessimistic_write" },
      });
      if (!departure || departure.status !== DepartureStatus.OPEN ||
          departure.departureDate < new Date().toISOString().slice(0, 10)) {
        throw new ConflictError("La salida ya no está disponible", "DEPARTURE_NOT_AVAILABLE");
      }
      const currentOffer = await manager.findOne(PackageDeparture, {
        where: { id: departure.id },
        relations: { package: { partner: true, destinationRegion: true } },
      });
      const pkg = currentOffer?.package;
      if (!pkg || pkg.status !== PackageStatus.PUBLISHED || pkg.partner.status !== PartnerStatus.ACTIVE ||
          pkg.destinationRegion.status !== RegionStatus.ACTIVE) {
        throw new ConflictError("El paquete ya no está disponible", "PACKAGE_NOT_AVAILABLE");
      }

      const seats = item.adults + item.children;
      const holds = await departureHolds(manager, [departure.id]);
      if (departure.totalSeats - departure.soldSeats - (holds.get(departure.id) ?? 0) < seats) {
        throw new ConflictError("Ya no hay lugares suficientes", "INSUFFICIENT_AVAILABILITY");
      }

      return manager.save(Booking, manager.create(Booking, {
        quoteId,
        departureId: departure.id,
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
      }));
    });

    if (booking.status === "pending_payment" && booking.expiresAt.getTime() > Date.now() && !booking.paypalOrderId) {
      const order = await this.paypal.createOrder(booking);
      const approval = order.links?.find(({ rel }) => rel === "payer-action" || rel === "approve")?.href;
      if (!order.id || !approval?.startsWith("https://")) {
        throw new HttpError(502, "PayPal no devolvió el enlace de aprobación", { code: "PAYPAL_LINK_MISSING" });
      }
      await this.repo.update({ id: booking.id, status: "pending_payment" }, {
        paypalOrderId: order.id,
        paypalApprovalUrl: approval,
      });
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
    const status = booking.status === "pending_payment" && booking.expiresAt.getTime() <= Date.now()
      ? "expired"
      : booking.status;
    return {
      bookingId: booking.id,
      status,
      total: Number(booking.total),
      currency: booking.currency,
      expiresAt: booking.expiresAt.toISOString(),
      paymentUrl: status === "pending_payment" ? booking.paypalApprovalUrl : null,
    };
  }

  public async reconcile(orderId: string): Promise<void> {
    const booking = await this.repo.findOne({ where: { paypalOrderId: orderId } });
    if (!booking || !["pending_payment", "capturing"].includes(booking.status)) return;
    if (booking.status === "pending_payment" && booking.expiresAt.getTime() <= Date.now()) return;

    let order = await this.paypal.getOrder(orderId);
    if (order.status === "APPROVED") {
      // Compare against the database clock used by departureHolds. Once capture
      // starts, expiry can't release seats while the money is in flight.
      const result = await AppDataSource.transaction(async (manager) => {
        await manager.findOne(PackageDeparture, {
          where: { id: booking.departureId },
          lock: { mode: "pessimistic_write" },
        });
        return manager.createQueryBuilder().update(Booking)
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

    await AppDataSource.transaction(async (manager) => {
      await manager.findOne(PackageDeparture, {
        where: { id: original.departureId },
        lock: { mode: "pessimistic_write" },
      });
      const booking = await manager.findOne(Booking, {
        where: { id },
        lock: { mode: "pessimistic_write" },
      });
      if (!booking || booking.status !== "capturing") return;
      if (order.id !== booking.paypalOrderId || capture.amount.currency_code !== booking.currency ||
          capture.amount.value !== booking.total) {
        throw new HttpError(502, "El pago requiere conciliación", { code: "PAYPAL_CAPTURE_MISMATCH" });
      }
      await manager.increment(PackageDeparture, { id: booking.departureId }, "soldSeats", booking.seats);
      await manager.update(Booking, booking.id, { status: "confirmed", paypalCaptureId: capture.id });
    });
  }
}
