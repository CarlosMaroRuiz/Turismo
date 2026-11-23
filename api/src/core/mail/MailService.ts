import nodemailer, { type Transporter } from "nodemailer";
import { METACONFIG } from "../metaconfig/index.js";
import {
  renderPartnerActivationEmail,
  renderPartnerRejectionEmail,
} from "./templates.js";

export interface SendMailOptions {
  to: string;
  subject: string;
  html: string;
}

/**
 * Envío de correo. En test (o con MAIL_TRANSPORT=fake) no abre SMTP: guarda el
 * correo en memoria para que las pruebas puedan afirmar sobre él sin enviar nada.
 *
 * El HTML de cada mensaje vive en `templates.ts`; aquí solo se transporta.
 */
export class MailService {
  private static readonly captured: SendMailOptions[] = [];

  private readonly transporter: Transporter;
  private readonly isFake: boolean;

  constructor() {
    this.isFake =
      METACONFIG.server.isTest || METACONFIG.mail.transport === "fake";

    this.transporter = this.isFake
      ? nodemailer.createTransport({ jsonTransport: true })
      : nodemailer.createTransport({
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

    try {
      await service.transporter.verify();
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

  public async sendMail({ to, subject, html }: SendMailOptions): Promise<void> {
    const info = await this.transporter.sendMail({
      from: METACONFIG.mail.from,
      to,
      subject,
      html,
    });

    if (this.isFake) {
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
    if (METACONFIG.mail.host.includes("ethereal.email")) {
      const previewUrl = nodemailer.getTestMessageUrl(info);
      if (previewUrl) {
        console.log(`[mail] ver: ${previewUrl}`);
      }
    }
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
}
