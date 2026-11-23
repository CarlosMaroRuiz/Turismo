import { DataSource } from "typeorm";

export interface Seeder {
  run(dataSource: DataSource): Promise<void>;
}

export interface SeedOptions {
  name: string;
  order?: number; // Controla el orden de ejecución (ej. 1)
}

export interface RegisteredSeeder {
  name: string;
  order: number;
  target: new () => Seeder;
}