import type { Request, Response } from "express";
import { z } from "zod";
import { BaseRoutes } from "../../../core/routes/BaseRoutes.js";
import { AuthMiddleware } from "../../../core/middlewares/AuthMiddleware/index.js";
import { ApiResponse } from "../../../core/http/ApiResponse.js";
import { BadRequestError, UnauthorizedError } from "../../../core/errors/index.js";
import { registerRoutes } from "../../../core/http/openapi/index.js";
import { BookingService } from "../services/BookingService.js";

const travelerRef = z.string().regex(/^[a-z][a-z0-9_-]*:[a-zA-Z0-9_-]+$/).max(80);
const checkoutSchema = z.object({ quoteId: z.string().uuid(), travelerRef });
const statusQuery = z.object({ travelerRef });
const eventSchema = z.object({
  id: z.string().min(1),
  event_type: z.string().min(1),
  resource: z.object({
    id: z.string().optional(),
    supplementary_data: z.object({
      related_ids: z.object({ order_id: z.string().optional() }).optional(),
    }).optional(),
  }),
});

class BookingController {
  private readonly bookings = new BookingService();

  public checkout = async (req: Request, res: Response): Promise<void> => {
    const dto = checkoutSchema.parse(req.body);
    const data = await this.bookings.checkout(dto.quoteId, req.service!.clientId, dto.travelerRef);
    ApiResponse.ok(res, data, "Estado de la compra");
  };

  public status = async (req: Request, res: Response): Promise<void> => {
    const bookingId = z.string().uuid().parse(req.params.id);
    const { travelerRef: identity } = statusQuery.parse(req.query);
    ApiResponse.ok(res, await this.bookings.get(bookingId, req.service!.clientId, identity));
  };

  public webhook = async (req: Request, res: Response): Promise<void> => {
    if (!Buffer.isBuffer(req.body)) throw new BadRequestError("Se requiere el evento JSON de PayPal");
    const raw = req.body.toString("utf8");
    let payload: unknown;
    try {
      payload = JSON.parse(raw);
    } catch {
      throw new BadRequestError("Evento JSON inválido");
    }
    const event = eventSchema.parse(payload);
    const verified = await this.bookings.paypal.verifyWebhook({
      auth_algo: req.get("paypal-auth-algo"),
      cert_url: req.get("paypal-cert-url"),
      transmission_id: req.get("paypal-transmission-id"),
      transmission_sig: req.get("paypal-transmission-sig"),
      transmission_time: req.get("paypal-transmission-time"),
    }, raw);
    if (!verified) throw new UnauthorizedError("Firma de PayPal inválida", "PAYPAL_INVALID_SIGNATURE");

    const orderId = event.event_type === "CHECKOUT.ORDER.APPROVED"
      ? event.resource?.id
      : event.event_type?.startsWith("PAYMENT.CAPTURE.")
        ? event.resource?.supplementary_data?.related_ids?.order_id
        : undefined;
    if (orderId) await this.bookings.reconcile(orderId);
    res.sendStatus(204);
  };

  public paymentReturn = (_req: Request, res: Response): void => {
    res.type("text").send("Vuelve a Telegram para consultar el estado de tu reserva.");
  };
}

export class BookingRoutes extends BaseRoutes<BookingController> {
  constructor() {
    super(BookingController);
  }

  protected initRoutes(): void {
    const auth = [AuthMiddleware.authenticateService, AuthMiddleware.requireScopes("booking:write")];
    this.router.post("/checkout", ...auth, this.controller.checkout);
    this.router.get("/:id", ...auth, this.controller.status);
    this.router.post("/paypal/webhook", this.controller.webhook);
    this.router.get("/paypal/return", this.controller.paymentReturn);
    this.router.get("/paypal/cancel", this.controller.paymentReturn);
    registerRoutes("Reservas", [
      {
        method: "post",
        path: "/api/v1/bookings/checkout",
        summary: "Aparta una salida de paquete y devuelve su enlace de PayPal",
        auth: "service",
        body: checkoutSchema,
      },
      {
        method: "get",
        path: "/api/v1/bookings/:id",
        summary: "Consulta el estado del apartado, pago y reserva",
        auth: "service",
        query: statusQuery,
      },
    ]);
  }
}
