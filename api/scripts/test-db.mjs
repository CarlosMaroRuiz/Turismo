/**
 * Prepara la base de datos de pruebas: la recrea desde cero, aplica migraciones,
 * corre los seeders y deja el admin sin mustChangePassword.
 *
 * Uso: node scripts/test-db.mjs   (requiere `npm run build:test` antes)
 */
const dbName = process.env.DB_NAME_TEST ?? "turista_test";

// Guarda de seguridad: solo se destruye una base cuyo nombre termine en _test.
if (!dbName.endsWith("_test")) {
  console.error(
    `[test-db] El nombre de la base debe terminar en "_test" (recibido: "${dbName}")`
  );
  process.exit(1);
}

await import("dotenv/config");

process.env.NODE_ENV = "test";
process.env.MAIL_TRANSPORT = "fake";
process.env.DB_NAME = dbName;
process.env.SERVICE_CLIENT_ID = "test-service-client";
process.env.SERVICE_CLIENT_SECRET = "test-service-secret-1234";
process.env.SERVICE_CLIENT_SCOPES = "catalog:read,quote:write";

const mysql = await import("mysql2/promise");

const connection = await mysql.createConnection({
  host: process.env.DB_HOST,
  port: Number(process.env.DB_PORT),
  user: process.env.DB_USER,
  password: process.env.DB_PASSWORD,
});

await connection.query(`DROP DATABASE IF EXISTS \`${dbName}\``);
await connection.query(
  `CREATE DATABASE \`${dbName}\` CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci`
);
await connection.end();
console.log(`[test-db] Base "${dbName}" recreada`);

const { AppDataSource } = await import("../dist-test/core/bd/index.js");
await AppDataSource.initialize();
await AppDataSource.runMigrations();

const { SeedRunner } = await import(
  "../dist-test/core/bd/runner/seed.runner.js"
);
await new SeedRunner(AppDataSource).execute();

// El admin de test no puede quedar bloqueado: el guard tiene su propia prueba.
const { User } = await import("../dist-test/core/bd/entities/User.js");
await AppDataSource.getRepository(User).update(
  { email: process.env.SUPER_USER_EMAIL },
  { mustChangePassword: false }
);

await AppDataSource.destroy();
console.log("[test-db] Esquema, catálogos y admin listos");
