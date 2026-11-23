/**
 * Diagnóstico del correo saliente.
 *
 *   npm run mail:check            → conecta y autentica (NO envía correo)
 *   npm run mail:test             → envía una prueba a MAIL_TEST_END
 *   npm run mail:test -- --to=x@y.com
 *
 * Lee directamente el .env, así funciona incluso si falta otra variable.
 */
import "dotenv/config";
import nodemailer from "nodemailer";

const host = process.env.MAIL_HOST ?? "";
const port = Number(process.env.MAIL_PORT ?? 587);
const user = process.env.MAIL_USER ?? "";
const pass = process.env.MAIL_PASS ?? "";
const from = process.env.MAIL_FROM ?? user;
const transport = process.env.MAIL_TRANSPORT ?? "smtp";

if (transport === "fake") {
  console.log(
    "MAIL_TRANSPORT=fake: no se abre SMTP. El enlace de activación se imprime en la consola del API."
  );
  process.exit(0);
}

if (host === "" || user === "" || pass === "") {
  console.error(
    "Faltan MAIL_HOST, MAIL_USER o MAIL_PASS en el .env. Sin credenciales no hay forma de enviar."
  );
  process.exit(1);
}

const transporter = nodemailer.createTransport({
  host,
  port,
  secure: port === 465,
  auth: { user, pass },
});

console.log(`Verificando ${host}:${port} como ${user} …`);

try {
  await transporter.verify();
  console.log("OK: conexión y autenticación correctas (no se envió ningún correo).");
} catch (error) {
  const code = error?.code ?? "";
  const hints = {
    EAUTH:
      "Gmail rechazó las credenciales: usá una contraseña de aplicación de 16 caracteres (requiere 2FA), no la del login.",
    ETIMEDOUT: "No se pudo conectar: revisá el puerto (465 SSL / 587 STARTTLS) y el firewall.",
    ESOCKET: "La conexión se cortó: probá el otro puerto (465 ↔ 587).",
    EDNS: "No se pudo resolver el host: revisá MAIL_HOST.",
  };
  console.error(`FALLÓ [${code || "sin código"}] ${error?.message ?? error}`);
  if (hints[code]) {
    console.error(`Pista: ${hints[code]}`);
  }
  process.exit(1);
}

if (process.argv.includes("--send")) {
  const explicit = process.argv
    .find((arg) => arg.startsWith("--to="))
    ?.slice("--to=".length);
  const to = explicit ?? process.env.MAIL_TEST_END ?? "";

  if (to === "") {
    console.error("Indicá el destinatario con --to=correo o definí MAIL_TEST_END.");
    process.exit(1);
  }

  console.log(`Enviando prueba a ${to} …`);

  try {
    const info = await transporter.sendMail({
      from,
      to,
      subject: "Prueba de correo · Turismo API",
      html: "<p>Si estás leyendo esto, el envío por SMTP funciona.</p>",
    });
    console.log(`Correo enviado. id=${info.messageId}`);
  } catch (error) {
    console.error(`FALLÓ el envío: ${error?.message ?? error}`);
    process.exit(1);
  }
}
