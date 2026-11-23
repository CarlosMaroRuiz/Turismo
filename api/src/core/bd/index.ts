import { DataSource } from "typeorm";
import path from "path";
import { fileURLToPath } from "url";
import { METACONFIG } from "../metaconfig/index.js";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

export const AppDataSource = new DataSource({
    type: METACONFIG.db.type,
    host: METACONFIG.db.host,
    port: METACONFIG.db.port,
    username: METACONFIG.db.username,
    password: METACONFIG.db.password,
    database: METACONFIG.db.database,
    synchronize: false,
    logging: ["error", "warn"],
    poolSize: 10, // Mantener 10 conexiones abiertas
    entities: [path.join(__dirname, "entities", "*.{ts,js}")],
    migrations: [path.join(__dirname, "migrations", "*.{ts,js}")],
});
