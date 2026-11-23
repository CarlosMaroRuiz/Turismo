import { execSync } from "child_process";
import fs from "fs";
import path from "path";

const migrationsDir = "src/core/bd/migrations";
const dataSourcePath = "src/core/bd/index.ts";

try {
  execSync(
    `npx tsx ./node_modules/typeorm/cli.js migration:generate "${migrationsDir}/SchemaUpdate" -d "${dataSourcePath}"`,
    { stdio: "inherit" }
  );

  // Corrige automáticamente el import a "import type" para compatibilidad con ESM
  const files = fs.readdirSync(migrationsDir).filter((f) => f.endsWith(".ts"));
  for (const file of files) {
    const filePath = path.join(migrationsDir, file);
    const content = fs.readFileSync(filePath, "utf-8");
    const fixed = content.replace(
      'import { MigrationInterface, QueryRunner } from "typeorm";',
      'import type { MigrationInterface, QueryRunner } from "typeorm";'
    );
    fs.writeFileSync(filePath, fixed, "utf-8");
  }
  console.log("[OK] Migración generada y ajustada para ESM.");
} catch {
  process.exit(1);
}
