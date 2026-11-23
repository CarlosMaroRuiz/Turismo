/**
 * Plantillas de correo.
 *
 * Reglas de maquetacion para clientes de correo:
 * - Tablas con `role="presentation"` en lugar de flex o grid: Gmail y Outlook
 *   no interpretan bien el layout moderno.
 * - Todo el estilo en linea: varios clientes descartan la etiqueta `<style>`.
 * - Sin imagenes: un logo alojado se bloquea por defecto y deja un hueco roto.
 * - Ancho maximo 600 px, que es el que sobrevive al movil y al escritorio.
 */

const BRAND = {
  marca: "#006853",
  acento: "#C9005B",
  acentoOscuro: "#8C003F",
  acentoSuave: "#FDF0F5",
  fondo: "#F8F7F3",
  texto: "#111111",
  suave: "#5B6360",
  borde: "#E3E1DA",
} as const;

const FONT =
  "-apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif";

/** Escapa el texto que viene del usuario antes de interpolarlo en el HTML. */
function escapeHtml(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

/** Igual que `escapeHtml`, conservando los saltos de linea de un texto libre. */
function escapeHtmlWithBreaks(value: string): string {
  return escapeHtml(value).replace(/\r?\n/g, "<br>");
}

/** Boton principal: fondo rosa de marca, texto claro, area tactil comoda. */
function button(label: string, url: string): string {
  return `
    <table role="presentation" cellpadding="0" cellspacing="0" border="0" style="margin:28px 0 0;">
      <tr>
        <td style="background:${BRAND.acento};border-radius:10px;">
          <a href="${escapeHtml(url)}"
             style="display:inline-block;padding:14px 28px;font-family:${FONT};font-size:15px;font-weight:600;color:#FFFFFF;text-decoration:none;border-radius:10px;">
            ${escapeHtml(label)}
          </a>
        </td>
      </tr>
    </table>`;
}

/** Recuadro rosa muy tenue para la letra pequena importante. */
function noteBox(text: string): string {
  return `
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="margin-top:24px;background:${BRAND.acentoSuave};border-radius:10px;">
      <tr>
        <td style="padding:14px 16px;font-family:${FONT};font-size:13px;line-height:1.6;color:${BRAND.acentoOscuro};">
          ${text}
        </td>
      </tr>
    </table>`;
}

/** Enlace de respaldo, por si el cliente de correo bloquea el boton. */
function fallbackLink(url: string): string {
  return `
    <p style="margin:22px 0 0;font-family:${FONT};font-size:12px;line-height:1.7;color:${BRAND.suave};">
      Si el botón no funciona, copia este enlace en tu navegador:<br>
      <span style="color:${BRAND.texto};font-family:ui-monospace,SFMono-Regular,Menlo,Consolas,monospace;word-break:break-all;">
        ${escapeHtml(url)}
      </span>
    </p>`;
}

/** Tabla de dos columnas para datos concretos (clave, fecha, total). */
function detailTable(rows: [string, string][]): string {
  const filas = rows
    .map(
      ([etiqueta, valor]) => `
        <tr>
          <td style="padding:10px 14px;background:${BRAND.fondo};font-family:${FONT};font-size:12px;color:${BRAND.suave};width:45%;">
            ${escapeHtml(etiqueta)}
          </td>
          <td style="padding:10px 14px;font-family:${FONT};font-size:14px;font-weight:600;color:${BRAND.texto};">
            ${escapeHtml(valor)}
          </td>
        </tr>`
    )
    .join("");

  return `
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0"
           style="margin-top:12px;border:1px solid ${BRAND.borde};border-radius:10px;overflow:hidden;">
      ${filas}
    </table>`;
}

interface LayoutOptions {
  /** Texto que se ve en la bandeja antes de abrir el correo. */
  preheader: string
  title: string
  /** Etiqueta pequena sobre el titulo. */
  eyebrow: string
  /** Color de la etiqueta: verde para lo bueno, rosa para lo que requiere atencion. */
  eyebrowColor: string
  content: string
}

function layout({ preheader, title, eyebrow, eyebrowColor, content }: LayoutOptions): string {
  return `<!doctype html>
<html lang="es">
  <head>
    <meta charset="utf-8">
    <meta name="viewport" content="width=device-width,initial-scale=1">
    <meta name="color-scheme" content="light">
    <title>${escapeHtml(title)}</title>
  </head>
  <body style="margin:0;padding:0;background:${BRAND.fondo};">
    <div style="display:none;max-height:0;overflow:hidden;opacity:0;color:transparent;">
      ${escapeHtml(preheader)}
    </div>

    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0"
           style="background:${BRAND.fondo};padding:36px 12px;">
      <tr>
        <td align="center">
          <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0"
                 style="max-width:600px;background:#FFFFFF;border:1px solid ${BRAND.borde};border-radius:16px;overflow:hidden;">

            <tr>
              <td style="background:${BRAND.marca};padding:20px 32px;">
                <span style="font-family:${FONT};font-size:17px;font-weight:700;letter-spacing:-0.2px;color:#FFFFFF;">
                  Turismo
                </span>
              </td>
            </tr>

            <tr>
              <td style="padding:36px 32px 32px;">
                <p style="margin:0 0 10px;font-family:${FONT};font-size:12px;font-weight:700;text-transform:uppercase;letter-spacing:1.6px;color:${eyebrowColor};">
                  ${escapeHtml(eyebrow)}
                </p>
                <h1 style="margin:0 0 18px;font-family:${FONT};font-size:24px;line-height:1.3;font-weight:700;color:${BRAND.texto};">
                  ${escapeHtml(title)}
                </h1>
                ${content}
              </td>
            </tr>

            <tr>
              <td style="padding:20px 32px 28px;border-top:1px solid ${BRAND.borde};">
                <p style="margin:0;font-family:${FONT};font-size:12px;line-height:1.7;color:${BRAND.suave};">
                  Plataforma Turismo &middot; Chiapas, México<br>
                  Correo automático, no es necesario responder.
                </p>
              </td>
            </tr>

          </table>
        </td>
      </tr>
    </table>
  </body>
</html>`;
}

export interface ActivationEmailParams {
  ownerName: string
  commercialName: string
  activationUrl: string
}

export function renderPartnerActivationEmail({
  ownerName,
  commercialName,
  activationUrl,
}: ActivationEmailParams): { subject: string; html: string } {
  const nombre = escapeHtml(ownerName)
  const negocio = escapeHtml(commercialName)

  const content = `
    <p style="margin:0 0 8px;font-family:${FONT};font-size:15px;line-height:1.7;color:${BRAND.texto};">
      La solicitud de registro para <strong>${negocio}</strong> fue aprobada.
    </p>
    <p style="margin:0;font-family:${FONT};font-size:15px;line-height:1.7;color:${BRAND.texto};">
      Define tu contraseña para entrar al panel de tu negocio y empezar a publicar tu catálogo.
    </p>
    ${button("Activar mi cuenta", activationUrl)}
    ${noteBox("El enlace caduca en 48 horas y solo sirve una vez. Si expira, pide que te reenvíen la invitación.")}
    ${fallbackLink(activationUrl)}`;

  return {
    subject: `Tu solicitud para "${commercialName}" ha sido aprobada`,
    html: layout({
      preheader: `Activa tu cuenta de ${commercialName}: el enlace caduca en 48 horas.`,
      eyebrow: "Solicitud aprobada",
      eyebrowColor: BRAND.marca,
      title: `Bienvenido, ${ownerName}`,
      content,
    }),
  };
}

export interface RejectionEmailParams {
  ownerName: string
  commercialName: string
  reason: string
}export function renderPartnerRejectionEmail({
  ownerName,
  commercialName,
  reason,
}: RejectionEmailParams): { subject: string; html: string } {
  const negocio = escapeHtml(commercialName)
  const motivo = escapeHtmlWithBreaks(reason)

  const content = `
    <p style="margin:0 0 20px;font-family:${FONT};font-size:15px;line-height:1.7;color:${BRAND.texto};">
      Revisamos la solicitud de registro para <strong>${negocio}</strong>. Por ahora no pudimos aprobarla.
    </p>
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0"
           style="background:${BRAND.fondo};border-left:3px solid ${BRAND.acento};border-radius:8px;">
      <tr>
        <td style="padding:16px 18px;font-family:${FONT};font-size:14px;line-height:1.7;color:${BRAND.texto};">
          ${motivo}
        </td>
      </tr>
    </table>
    <p style="margin:24px 0 0;font-family:${FONT};font-size:14px;line-height:1.7;color:${BRAND.suave};">
      Puedes corregir lo que se indica y volver a enviar la solicitud, o responder a este correo si
      consideras que se trata de un error.
    </p>`;

  return {
    subject: `Actualización sobre tu solicitud para "${commercialName}"`,
    html: layout({
      preheader: `Revisamos la solicitud de ${commercialName}.`,
      eyebrow: "Solicitud revisada",
      eyebrowColor: BRAND.acento,
      title: `Hola, ${ownerName}`,
      content,
    }),
  };
}

export interface BookingConfirmedEmailParams {
  partnerName: string
  packageName: string
  reference: string
  departureDate: string
  seats: number
  total: number
  currency: string
  travelerRef: string
}

/** Aviso al socio cuando el pago de una reserva queda confirmado. */
export function renderBookingConfirmedEmail({
  partnerName,
  packageName,
  reference,
  departureDate,
  seats,
  total,
  currency,
  travelerRef,
}: BookingConfirmedEmailParams): { subject: string; html: string } {
  const content = `
    <p style="margin:0 0 4px;font-family:${FONT};font-size:15px;line-height:1.7;color:${BRAND.texto};">
      Se confirmó el pago de una reserva para <strong>${escapeHtml(partnerName)}</strong>.
    </p>
    ${detailTable([
      ["Clave de reserva", reference],
      ["Paquete", packageName],
      ["Fecha de salida", departureDate],
      ["Viajeros", String(seats)],
      ["Total pagado", `${total.toFixed(2)} ${currency}`],
      ["Canal del viajero", travelerRef],
    ])}
    ${noteBox("El viajero fue atendido por el canal indicado. Coordina con él por ese mismo medio.")}`;

  return {
    subject: `Reserva pagada ${reference} - ${packageName}`,
    html: layout({
      preheader: `Nueva reserva confirmada para ${packageName}.`,
      eyebrow: "Reserva pagada",
      eyebrowColor: BRAND.marca,
      title: `Nueva venta, ${partnerName}`,
      content,
    }),
  };
}
