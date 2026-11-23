import nodemailer, { type Transporter } from "nodemailer";
import { METACONFIG } from "../metaconfig/index.js";

export interface SendMailOptions {
  to: string;
  subject: string;
  html: string;
}

/**
 * Envío de correo. En test (o con MAIL_TRANSPORT=fake) no abre SMTP: guarda el
 * correo en memoria para que las pruebas puedan afirmar sobre él sin enviar nada.
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
        });
  }

  /** Correos capturados durante la ejecución (solo con transporte falso). */
  public static capturedMails(): readonly SendMailOptions[] {
    return [...MailService.captured];
  }

  public static clearCapturedMails(): void {
    MailService.captured.length = 0;
  }

  public async sendMail({ to, subject, html }: SendMailOptions): Promise<void> {
    await this.transporter.sendMail({
      from: METACONFIG.mail.from,
      to,
      subject,
      html,
    });

    if (this.isFake) {
      MailService.captured.push({ to, subject, html });
    }
  }

  public async sendPartnerActivationEmail(params: {
    to: string;
    ownerName: string;
    commercialName: string;
    activationToken: string;
  }): Promise<void> {
    const activationUrl = `${METACONFIG.server.appUrl}/activate-account?token=${params.activationToken}`;

    await this.sendMail({
      to: params.to,
      subject: `Tu solicitud para "${params.commercialName}" ha sido aprobada`,
      html: `
        <div style="font-family: sans-serif; max-width: 600px; margin: 0 auto;">
          <h2>¡Bienvenido, ${params.ownerName}!</h2>
          <p>La solicitud de registro para <strong>${params.commercialName}</strong> ha sido aprobada.</p>
          <p>Para activar tu cuenta y establecer tu contraseña, haz clic en el siguiente enlace:</p>
          <p style="margin: 24px 0;">
            <a href="${activationUrl}" style="background: #0f172a; color: #ffffff; padding: 12px 20px; text-decoration: none; border-radius: 6px;">
              Activar cuenta
            </a>
          </p>
          <p style="color: #64748b; font-size: 13px;">
            Este enlace es de un solo uso y expirará en 48 horas.
          </p>
        </div>
      `,
    });
  }

  public async sendPartnerRejectionEmail(params: {
    to: string;
    ownerName: string;
    commercialName: string;
    reason: string;
  }): Promise<void> {
    await this.sendMail({
      to: params.to,
      subject: `Actualización sobre tu solicitud para "${params.commercialName}"`,
      html: `
        <div style="font-family: sans-serif; max-width: 600px; margin: 0 auto;">
          <h2>Hola, ${params.ownerName}</h2>
          <p>Hemos revisado la solicitud de registro para <strong>${params.commercialName}</strong>.</p>
          <p>En este momento no fue posible aprobarla por el siguiente motivo:</p>
          <blockquote style="border-left: 3px solid #cbd5e1; padding-left: 12px; color: #334155;">
            ${params.reason}
          </blockquote>
        </div>
      `,
    });
  }
}
