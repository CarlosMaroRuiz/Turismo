import "reflect-metadata";
import { DataSource } from "typeorm";
import { connectDB } from "../connectorBd.js";
import { SeedRunner } from "../runner/seed.runner.js";

async function bootstrap() {
  let ds: DataSource | null = null;

  try {
    ds = await connectDB();
    const runner = new SeedRunner(ds);
    await runner.execute();
    console.log("Seeders finalizados.");
  } catch (error) {
    console.error("Error en SeedRunner:", error);
    process.exit(1);
  } finally {
    if (ds?.isInitialized) {
      await ds.destroy();
    }
  }
}

bootstrap();
