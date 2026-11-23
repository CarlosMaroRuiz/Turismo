# Guía de Migraciones

Este proyecto mantiene desactivada la sincronización automática (`synchronize: false`) para controlar de forma segura y versionada todos los cambios de esquema en la base de datos mediante migraciones generales de TypeORM.

---

## Flujo de trabajo para crear o modificar tablas

1. **Crea o edita tus entidades** dentro de `src/core/bd/entities/` (puedes agregar una o varias tablas a la vez).
2. **Genera la migración general:**
   ```bash
   npm run migration:generate
   ```
   *(Este comando compara tus entidades contra la base de datos, crea un archivo con marca de tiempo `...-SchemaUpdate.ts` dentro de `src/core/bd/migrations/` y ajusta automáticamente las importaciones para compatibilidad con ESM).*
3. **Revisa el archivo generado** en `src/core/bd/migrations/` para confirmar que las consultas `up()` y `down()` sean correctas y no eliminen datos por accidente.
4. **Aplica los cambios en la base de datos:**
   * **Solo aplicar migraciones:** `npm run migration:run`
   * **Aplicar migraciones y ejecutar seeders:** `npm run db:setup`

---

## Cómo revertir cambios

Si detectas un error después de ejecutar una migración, puedes deshacer la **última** migración aplicada ejecutando:

```bash
npm run migration:revert
```
*(Nota: Si necesitas deshacer varias migraciones, ejecuta el comando una vez por cada migración que desees revertir).*

---

## Convenciones estándar y reglas para MySQL

Para mantener consistencia en toda la base de datos y evitar errores de compatibilidad al generar migraciones en **MySQL**, sigue estas reglas al crear tus entidades en `src/core/bd/entities/`:

* **Archivos de entidades (`PascalCase` en singular):** `State.ts`, `Municipality.ts`, `UserProfile.ts`.
* **Tablas y columnas en BD (`snake_case`):** Tablas en plural (`states`, `municipalities`) y columnas en minúsculas separadas por guion bajo (`is_active`, `created_at`, `state_id`).
* **Tipos de datos compatibles con MySQL:**
  * Para fechas con zona horaria usa `type: "timestamp"` o `"datetime"` (no uses `timestamptz`, ya que es exclusivo de PostgreSQL).
  * Para listas o arreglos usa `type: "json"` (no uses `array: true`).
