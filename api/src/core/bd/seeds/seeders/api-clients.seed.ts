import bcrypt from "bcryptjs";
import { DataSource } from "typeorm";
import { Seed } from "../utils/seed.decorator.js";
import type { Seeder } from "../types/index.js";
import { ApiClient } from "../../entities/ApiClient.js";
import { METACONFIG } from "../../../metaconfig/index.js";
import { getEnvOptional } from "../../../metaconfig/utils.js";

/**
 * Credencial de servicio para el equipo que conecta el agente (LLM/WhatsApp).
 * Se configura por entorno; nunca se guarda el secreto en claro.
 */
@Seed({ name: "api-clients", order: 7 })
export class ApiClientSeeder implements Seeder {
  async run(dataSource: DataSource): Promise<void> {
    const clientId = getEnvOptional("SERVICE_CLIENT_ID", "").trim();
    const secret = getEnvOptional("SERVICE_CLIENT_SECRET", "").trim();

    if (clientId === "" || secret === "") {
      console.warn(
        "[api-clients] SERVICE_CLIENT_ID / SERVICE_CLIENT_SECRET no configurados. Se omite."
      );
      return;
    }

    const repo = dataSource.getRepository(ApiClient);
    const existing = await repo.findOne({ where: { clientId } });

    // No se pisa el secreto: rotarlo es una decisión explícita.
    if (existing) return;

    const scopes = getEnvOptional("SERVICE_CLIENT_SCOPES", "catalog:read")
      .split(",")
      .map((scope) => scope.trim())
      .filter((scope) => scope.length > 0);

    const client = repo.create({
      clientId,
      name: getEnvOptional("SERVICE_CLIENT_NAME", "Servicio LLM"),
      secretHash: await bcrypt.hash(secret, METACONFIG.security.bcryptRounds),
      scopes,
      isActive: true,
      lastUsedAt: null,
    });

    await repo.save(client);
    console.log(`[api-clients] Credencial "${clientId}" creada con scopes: ${scopes.join(", ")}`);
  }
}
