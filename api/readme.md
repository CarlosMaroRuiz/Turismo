# API Servicio - Documentación

Documentación técnica y guía de comandos para el entorno de desarrollo.

---

## Primeros pasos (Instalación desde cero)

Sigue estos pasos en orden la primera vez que configures el proyecto en tu equipo:

1. **Instala las dependencias:**
   ```bash
   npm install

```

2. **Configura tus variables de entorno:**
Crea un archivo `.env` en la raíz del proyecto con todas las variables obligatorias (el servidor no arrancará si falta alguna):
```env
# Server
PORT=3000
NODE_ENV=development

# Database
TYPE_BD=mysql
DB_HOST=localhost
DB_PORT=3306
DB_USER=root
DB_PASSWORD=tu_contraseña
DB_NAME=turista

```


3. **Crea la base de datos vacía:**
Asegúrate de crear el esquema vacío en tu gestor de base de datos con el mismo nombre definido en `DB_NAME` (ej. `CREATE DATABASE turista;`).
4. **Construye las tablas y carga los datos iniciales:**
```bash
npm run db:setup

```


5. **Inicia el servidor de desarrollo:**
```bash
npm run dev

```



---

## Scripts para desarrollo

Todos los comandos se ejecutan desde la raíz del proyecto utilizando `npm run <comando>`.

| Comando | Descripción |
| --- | --- |
| `npm run dev` | Inicia el servidor en modo desarrollo con recarga automática al guardar cambios (`tsx watch`). |
| `npm run build` | Compila el código TypeScript de `src/` a JavaScript en la carpeta `dist/`. |
| `npm start` | Ejecuta la aplicación compilada en producción desde `dist/index.js`. |
| `npm run migration:generate` | Detecta todos los cambios en tus entidades y genera automáticamente una migración general ajustada para ESM. |
| `npm run migration:run` | Ejecuta todas las migraciones pendientes para construir o actualizar las tablas en la BD. |
| `npm run migration:revert` | Revierte la última migración aplicada en la BD. |
| `npm run sync:seeds` | Escanea `src/core/bd/seeds/seeders/` y registra automáticamente los seeders en el `SeedRunner`. |
| `npm run seed` | Sincroniza y ejecuta **todos** los seeders registrados en orden de prioridad (`order`). |
| `npm run db:setup` | Ejecuta las migraciones pendientes (`migration:run`) y puebla la BD (`seed`) en un solo paso. |
| `npm run test:e2e` | Ejecuta las pruebas de extremo a extremo (`src/test/e2e/*.e2e.ts`) contra el servidor en ejecución. |

---

## Guías detalladas

* [Guía de Migraciones (Creación y control de tablas)](https://www.google.com/search?q=./docs/migraciones.md)
* [Guía de Seeders (Creación y sincronización)](https://www.google.com/search?q=./docs/seeder.md)
* [Guía de Pruebas E2E (Validación de endpoints)](https://www.google.com/search?q=./docs/pruebas-e2e.md)
* [Reservas de paquetes y configuración de PayPal](./docs/reservas-paypal.md)
