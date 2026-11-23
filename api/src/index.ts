import "reflect-metadata";
import { Server } from "./core/server/Server.js";

const server = new Server();
await server.start();