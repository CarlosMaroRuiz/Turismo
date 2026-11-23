import { DataSource } from "typeorm";
import { Seed } from "../utils/seed.decorator.js";
import type { Seeder } from "../types/index.js";
import { PartnerCategory } from "../../entities/PartnerCategory.js";

const CATEGORIES = [
  { code: "hotel", name: "Hotel" },
  { code: "agency", name: "Agencia de viajes" },
  { code: "attraction", name: "Operador de atractivos" },
];

@Seed({ name: "partner-categories", order: 3 })
export class PartnerCategorySeeder implements Seeder {
  async run(dataSource: DataSource): Promise<void> {
    const repo = dataSource.getRepository(PartnerCategory);

    // Idempotente: el índice único en "code" dispara ON DUPLICATE KEY UPDATE.
    // No se envía isActive a propósito: se inserta con el default (true) y
    // al volver a correr el seeder no reactiva una categoría desactivada.
    await repo.upsert(CATEGORIES, ["code"]);
  }
}