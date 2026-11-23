import { HttpError } from "../../../core/errors/HttpError.js";
import { METACONFIG } from "../../../core/metaconfig/index.js";
import type { Booking } from "../../../core/bd/entities/Booking.js";

type PayPalCapture = {
  id: string;
  status: string;
  amount: { currency_code: string; value: string };
};

export type PayPalOrder = {
  id: string;
  status: string;
  links?: { rel: string; href: string }[];
  purchase_units?: {
    reference_id?: string;
    payments?: { captures?: PayPalCapture[] };
  }[];
};

export class PayPalClient {
  private token: { value: string; expiresAt: number } | undefined;

  private get origin(): string {
    return METACONFIG.paypal.mode === "live"
      ? "https://api-m.paypal.com"
      : "https://api-m.sandbox.paypal.com";
  }

  public get enabled(): boolean {
    const { mode, clientId, secret, webhookId, publicApiUrl } = METACONFIG.paypal;
    return (mode === "sandbox" || mode === "live") &&
      Boolean(clientId && secret && webhookId && publicApiUrl.startsWith("https://"));
  }

  public assertEnabled(): void {
    if (!this.enabled) {
      throw new HttpError(503, "El pago con PayPal no está configurado", { code: "PAYPAL_NOT_CONFIGURED" });
    }
  }

  private async fetchJson<T>(path: string, init?: RequestInit): Promise<T> {
    try {
      const response = await fetch(this.origin + path, {
        ...init,
        signal: AbortSignal.timeout(10_000),
      });
      if (!response.ok) throw new Error(`PayPal HTTP ${response.status}`);
      return await response.json() as T;
    } catch {
      throw new HttpError(502, "PayPal no pudo completar la solicitud", { code: "PAYPAL_UNAVAILABLE" });
    }
  }

  private async accessToken(): Promise<string> {
    this.assertEnabled();
    if (this.token && this.token.expiresAt > Date.now()) return this.token.value;

    const { clientId, secret } = METACONFIG.paypal;
    const credentials = Buffer.from(`${clientId}:${secret}`).toString("base64");
    const token = await this.fetchJson<{ access_token: string; expires_in: number }>("/v1/oauth2/token", {
      method: "POST",
      headers: { Authorization: `Basic ${credentials}`, "Content-Type": "application/x-www-form-urlencoded" },
      body: "grant_type=client_credentials",
    });
    this.token = { value: token.access_token, expiresAt: Date.now() + (token.expires_in - 30) * 1000 };
    return token.access_token;
  }

  private async request<T>(path: string, body?: object, requestId?: string): Promise<T> {
    return this.fetchJson(path, {
      method: body === undefined ? "GET" : "POST",
      headers: {
        Authorization: `Bearer ${await this.accessToken()}`,
        "Content-Type": "application/json",
        ...(requestId && { "PayPal-Request-Id": requestId, Prefer: "return=representation" }),
      },
      ...(body === undefined ? {} : { body: JSON.stringify(body) }),
    });
  }

  public createOrder(booking: Booking): Promise<PayPalOrder> {
    const base = METACONFIG.paypal.publicApiUrl.replace(/\/+$/, "");
    return this.request("/v2/checkout/orders", {
      intent: "CAPTURE",
      purchase_units: [{
        reference_id: booking.id,
        amount: { currency_code: booking.currency, value: booking.total },
      }],
      payment_source: {
        paypal: {
          experience_context: {
            user_action: "PAY_NOW",
            shipping_preference: "NO_SHIPPING",
            return_url: `${base}/api/v1/bookings/paypal/return`,
            cancel_url: `${base}/api/v1/bookings/paypal/cancel`,
          },
        },
      },
    }, `o-${booking.id}`);
  }

  public getOrder(orderId: string): Promise<PayPalOrder> {
    return this.request(`/v2/checkout/orders/${encodeURIComponent(orderId)}`);
  }

  public captureOrder(bookingId: string, orderId: string): Promise<PayPalOrder> {
    return this.request(
      `/v2/checkout/orders/${encodeURIComponent(orderId)}/capture`,
      {},
      `c-${bookingId}`
    );
  }

  public async verifyWebhook(headers: Record<string, string | undefined>, rawEvent: string): Promise<boolean> {
    const { auth_algo, cert_url, transmission_id, transmission_sig, transmission_time } = headers;
    if (!auth_algo || !cert_url || !transmission_id || !transmission_sig || !transmission_time) return false;

    const metadata = JSON.stringify({
        auth_algo, cert_url, transmission_id, transmission_sig, transmission_time,
        webhook_id: METACONFIG.paypal.webhookId,
    });
    const response = await this.fetchJson<{ verification_status: string }>("/v1/notifications/verify-webhook-signature", {
      method: "POST",
      headers: { Authorization: `Bearer ${await this.accessToken()}`, "Content-Type": "application/json" },
      body: `${metadata.slice(0, -1)},"webhook_event":${rawEvent}}`,
    });
    return response.verification_status === "SUCCESS";
  }
}
