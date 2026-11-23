import { DataSource } from "typeorm";
import { Seed } from "../utils/seed.decorator.js";
import type { Seeder } from "../types/index.js";
import { Role, RoleCode } from "../../entities/Role.js";

const ROLES = [
  { code: RoleCode.SUPER_USER, name: "Super usuario" },
  { code: RoleCode.PARTNER, name: "Socio" },
];

@Seed({ name: "roles", order: 4 })
export class RoleSeeder implements Seeder {
  async run(dataSource: DataSource): Promise<void> {
    const repo = dataSource.getRepository(Role);

    // Idempotente: el índice único en "code" dispara ON DUPLICATE KEY UPDATE.
    // No se envía isActive para no reactivar un rol desactivado al re-ejecutar.
    await repo.upsert(ROLES, ["code"]);
  }
}