/**
 * Configuración de test. Se importa como PRIMER módulo de las pruebas para que
 * los valores estén en process.env antes de que se evalúe METACONFIG.
 * dotenv no sobrescribe variables ya definidas, así que estos valores ganan.
 */
process.env.NODE_ENV = "test";
process.env.MAIL_TRANSPORT = "fake";
process.env.DB_NAME = process.env.DB_NAME_TEST ?? "turista_test";

// Límites altos: las pruebas ejercitan auth muchas veces y no deben toparse
// con el rate limit (que sí se verifica aparte, con un test dedicado).
process.env.RATE_LIMIT_AUTH_MAX = "10000";
process.env.RATE_LIMIT_MAX = "10000";
process.env.RATE_LIMIT_REGISTER_MAX = "10000";
process.env.ACCESS_TOKEN_TTL = "15m";

// Credencial de servicio fija para el entorno de test.
process.env.SERVICE_CLIENT_ID = "test-service-client";
process.env.SERVICE_CLIENT_SECRET = "test-service-secret-1234";
process.env.SERVICE_CLIENT_SCOPES = "catalog:read,quote:write";
