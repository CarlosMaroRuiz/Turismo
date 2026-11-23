import "reflect-metadata";
import { MailService } from "./core/mail/index.js";
import { Server } from "./core/server/Server.js";

const server = new Server();
await server.start();

// Diagnostico no bloqueante del correo: si el SMTP no responde, queda el
// aviso en consola al arrancar en vez de descubrirlo al aprobar un socio.
void MailService.verify();
