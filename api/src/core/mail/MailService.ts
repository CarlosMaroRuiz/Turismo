import nodemailer, { type Transporter } from "nodemailer";
import { METACONFIG } from "../metaconfig/index.js";
import {
  renderBookingConfirmedEmail,
  renderPartnerActivationEmail,
  renderPartnerRejectionEmail,
} from "./templates.js";

export interface SendMailOptions {
  to: string;
  subject: string;
  html: string;
  /** Version en texto plano. Si falta se genera a partir del HTML. */
  text?: string;
}

/**
 * Version en texto plano del correo.
 *
 * Los filtros antispam penalizan los mensajes que solo traen HTML, y algunos
 * clientes de correo institucional no lo muestran. Es una conversion simple:
 * quita etiquetas y deja saltos de linea donde habia bloques.
 */
function htmlToText(html: string): string {
  return html
    .replace(/<style[\s\S]*?<\/style>/gi, " ")
    .replace(/<head[\s\S]*?<\/head>/gi, " ")
    .replace(/<br\s*\/?>/gi, "\n")
    .replace(/<\/(p|div|tr|h[1-6]|li|table)>/gi, "\n")
    .replace(/<a [^>]*href="([^"]+)"[^>]*>([^<]*)<\/a>/gi, "$2 ($1)")
    .replace(/<[^>]+>/g, " ")
    .replace(/&nbsp;/gi, " ")
    .replace(/&amp;/gi, "&")
    .replace(/&lt;/gi, "<")
    .replace(/&gt;/gi, ">")
    .replace(/&quot;/gi, '"')
    .replace(/&#39;/gi, "'")
    .replace(/[ \t]+/g, " ")
    .replace(/\n[ \t]+/g, "\n")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}

/** Separa "Nombre <correo>" en sus dos partes. */
function splitFrom(from: string): { nombre: string; email: string } {
  const coincidencia = /^(.*)<([^>]+)>$/.exec(from.trim());

  if (coincidencia) {
    return {
      nombre: (coincidencia[1] ?? "").trim().replace(/^"|"$/g, ""),
      email: (coincidencia[2] ?? "").trim(),
    };
  }

  return { nombre: "", email: from.trim() };
}

/**
 * Envío de correo. En test (o con MAIL_TRANSPORT=fake) no abre SMTP: guarda el
 * correo en memoria para que las pruebas puedan afirmar sobre él sin enviar nada.
 *
 * El transporte se elige con `MAIL_DRIVER`:
 * - `smtp` (por defecto): Gmail u otro servidor, útil en desarrollo.
 * - `brevo` o `resend`: API HTTP con dominio verificado. Es lo que evita que
 *   Gmail mande los correos a Spam cuando el enlace apunta a un túnel.
 *
 * El HTML de cada mensaje vive en `templates.ts`; aquí solo se transporta.
 */
export class MailService {
  private static readonly captured: SendMailOptions[] = [];

  private readonly transporter: Transporter | null;
  private readonly isFake: boolean;
  private readonly driver: string;
  private readonly apiKey: string;

  constructor() {
    this.isFake =
      METACONFIG.server.isTest || METACONFIG.mail.transport === "fake";
    this.driver = METACONFIG.mail.driver ?? "smtp";
    this.apiKey = METACONFIG.mail.apiKey ?? "";

    if (this.isFake) {
      this.transporter = nodemailer.createTransport({ jsonTransport: true });
      return;
    }

    if (this.driver !== "smtp") {
      this.transporter = null;
      return;
    }

    this.transporter = nodemailer.createTransport({
      host: METACONFIG.mail.host,
      port: METACONFIG.mail.port,
      secure: METACONFIG.mail.port === 465,
      auth: {
        user: METACONFIG.mail.user,
        pass: METACONFIG.mail.pass,
      },
      // Sin timeouts, un SMTP que no responde deja la peticion colgada
      // hasta que el cliente corta: el administrador ve un spinner eterno.
      connectionTimeout: 10_000,
      greetingTimeout: 10_000,
      socketTimeout: 15_000,
    });
  }

  /**
   * Comprueba conexion y credenciales al arrancar. No bloquea el arranque ni
   * tumba el servidor: si falla, queda el aviso en consola y los envios
   * posteriores devolveran el error real.
   */
  public static async verify(): Promise<void> {
    const service = new MailService();

    if (service.isFake) {
      console.log("[mail] transporte falso activo: no se abre SMTP");
      return;
    }

    if (service.driver !== "smtp") {
      if (service.apiKey === "") {
        console.error(
          `[mail] MAIL_DRIVER=${service.driver} sin MAIL_API_KEY: no se podrá enviar`
        );
      } else {
        console.log(`[mail] proveedor ${service.driver} configurado`);
      }
      return;
    }

    try {
      await service.transporter?.verify();
      console.log(
        `[mail] SMTP listo: ${METACONFIG.mail.host}:${METACONFIG.mail.port} como ${METACONFIG.mail.user}`
      );
    } catch (error) {
      console.error(
        `[mail] SMTP no responde: ${
          error instanceof Error ? error.message : String(error)
        }`
      );
    }
  }

  /** Correos capturados durante la ejecución (solo con transporte falso). */
  public static capturedMails(): readonly SendMailOptions[] {
    return [...MailService.captured];
  }

  public static clearCapturedMails(): void {
    MailService.captured.length = 0;
  }

  public async sendMail({ to, subject, html, text }: SendMailOptions): Promise<void> {
    const cuerpo = text ?? htmlToText(html);

    if (this.isFake) {
      await this.transporter?.sendMail({
        from: METACONFIG.mail.from,
        to,
        subject,
        html,
        text: cuerpo,
      });
      MailService.captured.push({ to, subject, html });

      // En desarrollo, sin SMTP: deja el enlace de activación en la consola.
      if (!METACONFIG.server.isTest) {
        const activationLink =
          /https?:\/\/[^\s"'<]+activate-account\?token=[a-f0-9]+/.exec(html);
        console.log(
          `[mail] Correo simulado para ${to}${activationLink ? ` · ${activationLink[0]}` : ""}`
        );
      }
      return;
    }

    if (METACONFIG.server.isTest) {
      return;
    }

    // Proveedor por API: no hay SMTP que leer.
    if (this.driver !== "smtp") {
      const id = await this.sendViaApi({ to, subject, html, text: cuerpo });
      console.log(`[mail] enviado por ${this.driver} · para=${to} · id=${id}`);
      return;
    }

    const info = await this.transporter?.sendMail({
      from: METACONFIG.mail.from,
      to,
      subject,
      html,
      text: cuerpo,
    });

    // Traza de envío real: muestra a quién se envió y a quién aceptó el SMTP.
    const accepted = Array.isArray(info?.accepted)
      ? info.accepted.join(", ")
      : "(no informado)";
    const rejected = Array.isArray(info?.rejected)
      ? info.rejected.join(", ")
      : "";

    console.log(
      `[mail] enviado · para=${to} · aceptados=${accepted}${
        rejected ? ` · rechazados=${rejected}` : ""
      } · id=${info?.messageId ?? "-"}`
    );

    // Ethereal (SMTP de pruebas): imprime el enlace para abrir el correo.
    if (METACONFIG.mail.host.includes("ethereal.email") && info !== undefined) {
      const previewUrl = nodemailer.getTestMessageUrl(info);
      if (previewUrl) {
        console.log(`[mail] ver: ${previewUrl}`);
      }
    }
  }

  /**
   * Envio por API HTTP (Brevo o Resend).
   *
   * Devuelve el identificador que asigna el proveedor, que es lo que sirve
   * para rastrear la entrega en su panel.
   */
  private async sendViaApi(correo: {
    to: string;
    subject: string;
    html: string;
    text: string;
  }): Promise<string> {
    if (this.apiKey === "") {
      throw new Error(`MAIL_DRIVER=${this.driver} requiere MAIL_API_KEY`);
    }

    const { nombre, email } = splitFrom(METACONFIG.mail.from);

    const respuesta =
      this.driver === "brevo"
        ? await fetch("https://api.brevo.com/v3/smtp/email", {
            method: "POST",
            headers: {
              "api-key": this.apiKey,
              "Content-Type": "application/json",
              Accept: "application/json",
            },
            body: JSON.stringify({
              sender: { name: nombre, email },
              to: [{ email: correo.to }],
              subject: correo.subject,
              htmlContent: correo.html,
              textContent: correo.text,
            }),
          })
        : await fetch("https://api.resend.com/emails", {
            method: "POST",
            headers: {
              Authorization: `Bearer ${this.apiKey}`,
              "Content-Type": "application/json",
            },
            body: JSON.stringify({
              from: METACONFIG.mail.from,
              to: [correo.to],
              subject: correo.subject,
              html: correo.html,
              text: correo.text,
            }),
          });

    if (!respuesta.ok) {
      const detalle = await respuesta.text().catch(() => "");
      throw new Error(
        `El proveedor ${this.driver} respondió ${respuesta.status}${
          detalle ? `: ${detalle.slice(0, 200)}` : ""
        }`
      );
    }

    const datos = (await respuesta.json().catch(() => ({}))) as {
      id?: string;
      messageId?: string;
    };

    return datos.id ?? datos.messageId ?? "(sin id)";
  }

  public async sendPartnerActivationEmail(params: {
    to: string;
    ownerName: string;
    commercialName: string;
    activationToken: string;
  }): Promise<void> {
    const activationUrl = `${METACONFIG.server.appUrl}/activate-account?token=${params.activationToken}`;

    // Fuera de produccion el enlace se imprime aunque el correo salga por SMTP:
    // sirve para probar el flujo sin depender de la bandeja del destinatario.
    if (!METACONFIG.server.isProduction) {
      console.log(
        `[mail] enlace de activacion (${params.to}): ${activationUrl}`
      );
    }

    const { subject, html } = renderPartnerActivationEmail({
      ownerName: params.ownerName,
      commercialName: params.commercialName,
      activationUrl,
    });

    await this.sendMail({ to: params.to, subject, html });
  }

  public async sendPartnerRejectionEmail(params: {
    to: string;
    ownerName: string;
    commercialName: string;
    reason: string;
  }): Promise<void> {
    const { subject, html } = renderPartnerRejectionEmail({
      ownerName: params.ownerName,
      commercialName: params.commercialName,
      reason: params.reason,
    });

    await this.sendMail({ to: params.to, subject, html });
  }

  /** Aviso al socio cuando se confirma el pago de una reserva. */
  public async sendBookingConfirmedEmail(params: {
    to: string;
    partnerName: string;
    packageName: string;
    reference: string;
    departureDate: string;
    seats: number;
    total: number;
    currency: string;
    travelerRef: string;
  }): Promise<void> {
    const { subject, html } = renderBookingConfirmedEmail({
      partnerName: params.partnerName,
      packageName: params.packageName,
      reference: params.reference,
      departureDate: params.departureDate,
      seats: params.seats,
      total: params.total,
      currency: params.currency,
      travelerRef: params.travelerRef,
    });

    await this.sendMail({ to: params.to, subject, html });
  }
}
