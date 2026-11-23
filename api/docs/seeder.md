# Guía de Seeders

Este proyecto utiliza un motor automatizado (`SeedRunner`) basado en decoradores para poblar la base de datos de forma ordenada.

---

## Cómo crear y registrar un nuevo Seeder

1. Crea un archivo dentro de `src/core/bd/seeds/seeders/` con la terminación `.seed.ts` (por ejemplo: `municipalities.seed.ts`).
2. Implementa la interfaz `Seeder` y agrega el decorador `@Seed` indicando su nombre único y su orden de ejecución (`order`):

```typescript
import { DataSource } from "typeorm";
import { Seed, Seeder } from "../utils/seed.decorator.js";

@Seed({ name: "municipalities", order: 2 })
export class MunicipalitySeeder implements Seeder {
  async run(dataSource: DataSource): Promise<void> {
    // Lógica de inserción usando dataSource.getRepository(...)
  }
}
```

3. Ejecuta el comando de sincronización o corre directamente los seeders:
   * **Solo registrar en el runner:** `npm run sync:seeds`
   * **Sincronizar y ejecutar todos:** `npm run seed`

---

## Reglas importantes

* **Orden de ejecución (`order`):** Los seeders se ejecutan de menor a mayor según su propiedad `order` (ej. `1` para estados, `2` para municipios).
* **Idempotencia:** Utiliza métodos como `.upsert()` en tus repositorios para evitar errores por registros duplicados al ejecutar `npm run seed` varias veces.
