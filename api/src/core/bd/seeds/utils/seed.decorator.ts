import type { RegisteredSeeder,SeedOptions,Seeder } from "../types/index.js";

export const SEEDER_REGISTRY: RegisteredSeeder[] = [];

export function Seed(options: SeedOptions) {
  return function (target: new () => Seeder) {
    SEEDER_REGISTRY.push({
      name: options.name,
      order: options.order ?? 99,
      target,
    });
  };
}