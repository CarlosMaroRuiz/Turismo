import { DataSource } from "typeorm";
import { AppDataSource } from "./index.js";
import { METACONFIG } from "../metaconfig/index.js";

let connectionPromise: Promise<DataSource> | null = null;

export const connectDB = async (): Promise<DataSource> => {
    if (AppDataSource.isInitialized) {
        return AppDataSource;
    }

    // Si ya se está conectando en este momento, reutiliza esa misma espera
    if (connectionPromise) {
        return connectionPromise;
    }

    // Si es la primera vez, inicia la conexión y guarda la promesa
    connectionPromise = AppDataSource.initialize()
        .then((ds) => {
            console.log(`Base de datos (${METACONFIG.db.type}) conectada`);
            return ds;
        })
        .catch((error) => {
            connectionPromise = null; // Limpia si falló para permitir reintentos
            console.error("Error al conectar la BD:", error);
            process.exit(1);
        });

    return connectionPromise;
};
