import "dotenv/config";
import { getEnv, getEnvInt, getEnvList, getEnvOptional } from "./utils.js";
import type { DatabaseType } from "../bd/types/index.js";

const env = getEnv("NODE_ENV");

export const METACONFIG = {
    server: {
        port: getEnvInt("PORT"),
        env,
        appUrl: getEnv("APP_URL"),
        isProduction: env === "production",
        isTest: env === "test",
    },
    db: {
        type: getEnv("TYPE_BD") as DatabaseType,
        host: getEnv("DB_HOST"),
        port: getEnvInt("DB_PORT"),
        username: getEnv("DB_USER"),
        password: getEnv("DB_PASSWORD"),
        database: getEnv("DB_NAME"),
    },
    superUser: {
        name: getEnv("SUPER_USER_NAME"),
        email: getEnv("SUPER_USER_EMAIL"),
        password: getEnv("SUPER_USER_PASSWORD"),
    },
    jwt: {
        secret: getEnv("JWT_SECRET"),
        expiresIn: getEnv("JWT_EXPIRES_IN"),
    },
    // Sesiones: el access token es corto y el refresh token se persiste hasheado.
    security: {
        accessTokenTtl: getEnvOptional("ACCESS_TOKEN_TTL", getEnv("JWT_EXPIRES_IN")),
        refreshTokenDays: getEnvInt("REFRESH_TOKEN_DAYS", 30),
        bcryptRounds: getEnvInt("BCRYPT_ROUNDS", 12),
        corsOrigins: getEnvList("CORS_ORIGINS"),
    },
    rateLimit: {
        windowMs: getEnvInt("RATE_LIMIT_WINDOW_MS",1000 * 1000* 1000),
        max: getEnvInt("RATE_LIMIT_MAX", 300),
        authMax: getEnvInt("RATE_LIMIT_AUTH_MAX", 50),
        registerMax: getEnvInt("RATE_LIMIT_REGISTER_MAX", 40),
    },
    // Cotizaciones: vigencia y tasa de impuestos cuando el precio no los incluye.
    quote: {
        ttlMinutes: getEnvInt("QUOTE_TTL_MINUTES", 15),
        taxRate: Number(getEnvOptional("QUOTE_TAX_RATE", "0.16")),
    },
    paypal: {
        mode: getEnvOptional("PAYPAL_MODE", "sandbox"),
        clientId: getEnvOptional("PAYPAL_CLIENT_ID", ""),
        secret: getEnvOptional("PAYPAL_CLIENT_SECRET", ""),
        webhookId: getEnvOptional("PAYPAL_WEBHOOK_ID", ""),
        publicApiUrl: getEnvOptional("PAYPAL_PUBLIC_API_URL", ""),
    },
    mail: {
        host: getEnv("MAIL_HOST"),
        port: getEnvInt("MAIL_PORT"), // 465
        user: getEnv("MAIL_USER"),
        pass: getEnv("MAIL_PASS"),
        from: getEnv("MAIL_FROM"),
        // "fake" no abre conexión SMTP y guarda los correos en memoria (tests).
        transport: getEnvOptional("MAIL_TRANSPORT", "smtp"),
        // "smtp" | "brevo" | "resend". Los dos últimos envían por API HTTP,
        // que es lo recomendable en producción: dominio propio, SPF y DKIM.
        driver: getEnvOptional("MAIL_DRIVER", "smtp"),
        apiKey: getEnvOptional("MAIL_API_KEY", ""),
    },
} as const;
