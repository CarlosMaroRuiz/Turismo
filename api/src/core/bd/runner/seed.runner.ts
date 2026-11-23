import { DataSource } from "typeorm";
import { SEEDER_REGISTRY } from "../seeds/utils/seed.decorator.js";

// <SEEDERS_IMPORTS>
import "../seeds/seeders/api-clients.seed.js";
import "../seeds/seeders/partner-categories.seed.js";
import "../seeds/seeders/roles.seed.js";
import "../seeds/seeders/states.seed.js";
import "../seeds/seeders/test-agencies.seed.js";
import "../seeds/seeders/users.seed.js";
// </SEEDERS_IMPORTS>

export class SeedRunner {
  constructor(private dataSource: DataSource) {}

  async execute(): Promise<void> {
    const sortedSeeders = [...SEEDER_REGISTRY].sort((a, b) => a.order - b.order);

    if (sortedSeeders.length === 0) {
      console.log("No hay seeders registrados para ejecutar.");
      return;
    }

    console.log("Ejecutando todos los seeders...");
    for (const entry of sortedSeeders) {
      console.log(`Corriendo [${entry.order}]: ${entry.name}`);
      const instance = new entry.target();
      await instance.run(this.dataSource);
    }
  }
}
