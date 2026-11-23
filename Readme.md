# Turismo

Plataforma de turismo , catalogo de paquetes, hoteles y experiencias,
panel de administracion, portal para socios y bot de ventas por Telegram.

```
api/                     API REST (Node 22, Express, TypeORM, MySQL)
frontend/                App web (React 19, Vite, Tailwind v4)
turismo-telegram-bot/    Bot de Telegram (Python, FastAPI, LangGraph, DeepSeek)
docs/                    Guias de operacion
scripts/                 Utilidades (URL publica del tunel)
```

## Que puede hacer

- **Viajero**: busca paquetes, hoteles y experiencias; cotiza una combinacion y
  aparta una salida con pago en PayPal.
- **Socio (hotel, agencia, atractivo)**: carga su catalogo, inventario por fecha,
  paquetes con itinerario y salidas, y gestiona a su equipo.
- **Administrador**: da de alta socios, aprueba, supervisa el catalogo y las
  regiones.
- **Bot**: atiende por Telegram, consulta el catalogo real y aparta reservas.

## Requisitos

- Docker Desktop (Windows, macOS) o Docker Engine con Compose v2 (Linux).
- Opcional, para desarrollo sin contenedores: Node 22 y Python 3.11 o superior.

## Puesta en marcha con Docker

**1. Crear los archivos de entorno** (no se versionan):

```bash
cp .env.example .env
cp api/.env.example api/.env
cp turismo-telegram-bot/.env.example turismo-telegram-bot/turismo_bot/.env
```

Completa como minimo:

| Archivo | Que hay que poner |
|---|---|
| `.env` | `DB_PASSWORD` (la clave que quieras para MySQL) |
| `api/.env` | `JWT_SECRET`, `MAIL_USER`, `MAIL_PASS`, `PAYPAL_CLIENT_ID`, `PAYPAL_CLIENT_SECRET`, `SUPER_USER_EMAIL`, `SUPER_USER_PASSWORD` |
| `turismo-telegram-bot/turismo_bot/.env` | `TELEGRAM_BOT_TOKEN`, `TELEGRAM_WEBHOOK_SECRET`, `DEEPSEEK_API_KEY` |

El detalle de cada variable esta en [DOCKER.md](DOCKER.md).

**2. Levantar todo con un solo comando:**

Windows (doble clic o desde la consola):

```bat
scripts\up.cmd
```

Linux y macOS:

```bash
bash scripts/up.sh
```

Ese comando hace todo: levanta MySQL, la API, el frontend y el bot; abre el
tunel publico; guarda la URL en `.env`; reinicia la API para que los enlaces y
PayPal usen ese dominio; registra el webhook de Telegram; comprueba que la API y
el bot responden; y al final imprime la URL y las cuentas de prueba.

```
============================================================
  Listo, ya puedes comenzar.
============================================================
  App local      http://localhost:8080
  URL publica    https://algo-aleatorio.trycloudflare.com
  API            https://.../api/v1/openapi.json  (responde)
  Bot            https://.../bot/health          (responde)
```

`up.cmd` solo envuelve a `up.ps1` con `-ExecutionPolicy Bypass`, para que
funcione aunque PowerShell tenga la politica restringida (el error tipico es
"is not digitally signed"). Si prefieres llamar al `.ps1` directo:

```powershell
powershell -NoProfile -ExecutionPolicy Bypass -File scripts/up.ps1
```

**3. Abrir la app:** <http://localhost:8080>

### Paso a paso (si prefieres hacerlo a mano)

```bash
docker compose up -d --build                          # servicios
docker compose --profile public up -d tunnel          # dominio publico
scripts\public-url.cmd -Telegram                      # URL + webhook (Windows)
bash scripts/public-url.sh --telegram                 # URL + webhook (Linux/macOS)
```

La version de Linux y macOS de ese ultimo paso es
`bash scripts/public-url.sh --telegram`.

## Servicios y puertos

| Servicio | Puerto local | Para que |
|---|---|---|
| `frontend` | `8080` | La app y el proxy `/api` y `/bot` |
| `bot` | `8000` | Webhook de Telegram (tambien por `/bot/`) |
| `api` | interno | Solo por la red de Docker |
| `mysql` | interno | Base de datos |

Un unico dominio publico sirve los tres: `/` la app, `/api/v1` la API y
`/bot/...` el bot. Asi no hay CORS y funciona igual en `http`.

## Webhooks y correo

| Servicio | Ruta |
|---|---|
| PayPal | `https://<dominio>/api/v1/bookings/paypal/webhook` |
| Telegram | `https://<dominio>/bot/telegram/webhook` |
| Enlaces de correo | se arman con `APP_URL` |

PayPal se registra a mano en el panel de desarrollador. Telegram lo hace el
script del paso 4.

## Cuentas de prueba

Las crea el seeder `playa-yucatan`: cuatro hoteles y cuatro agencias de Playa
del Carmen y Yucatan, todas activas.

| Rol | Correo | Contrasena |
|---|---|---|
| Administrador | `admin@gmail.com` | la de `SUPER_USER_PASSWORD` en `api/.env` |
| Hotel | `playa-azul@turismo.test` | `Turismo123!` |
| Agencia | `riviera-tours@turismo.test` | `Turismo123!` |

La lista completa, con lo que incluye cada socio, esta en
[api/docs/usuarios-de-prueba.md](api/docs/usuarios-de-prueba.md).

## Desarrollo sin Docker

API:

```bash
cd api
npm ci
npm run migration:run     # crea las tablas
npm run seed              # datos de prueba
npm run dev               # http://localhost:3000
```

Frontend (proxy `/api` hacia el 3000):

```bash
cd frontend
npm ci
npm run dev               # http://localhost:5173
```

Bot:

```bash
cd turismo-telegram-bot
python -m venv .venv && source .venv/bin/activate   # Windows: .venv\Scripts\activate
pip install -e .
uvicorn turismo_bot.app:app --reload --port 8000
```

En desarrollo, el bot necesita que Telegram pueda alcanzarlo: usa el mismo tunel
apuntando al 8000 o prueba el flujo con el contenedor.

## Pruebas

```bash
cd api
npm test              # e2e de la API
npm run test:flow     # flujos: agencia, cotizacion, hotel
npm run test:booking  # reserva con PayPal

cd turismo-telegram-bot
pytest                # pruebas del bot
```

## Documentacion

| Documento | Contenido |
|---|---|
| [DOCKER.md](DOCKER.md) | Todas las variables de entorno, una por una |
| [docs/docker.md](docs/docker.md) | Runbook de Docker, URL publica y webhooks |
| [api/docs/usuarios-de-prueba.md](api/docs/usuarios-de-prueba.md) | Cuentas de prueba |
| [api/docs/api/operaciones-y-flujos.md](api/docs/api/operaciones-y-flujos.md) | Operaciones y flujos del negocio |
| [api/docs/flujos/README.md](api/docs/flujos/README.md) | Guias paso a paso por tipo de socio |
| [api/docs/entidades.md](api/docs/entidades.md) | Modelo de datos |
| [api/docs/reservas-paypal.md](api/docs/reservas-paypal.md) | Como funciona el pago |
| [api/docs/pruebas-e2e.md](api/docs/pruebas-e2e.md) | Como correr las pruebas |
| `GET /api/v1/openapi.json` | Contrato completo, generado desde Zod |

## Problemas comunes

**`docker` responde pero compose falla.** Docker Desktop no esta corriendo. En
Windows abrelo y espera a que diga "Engine running".

**El puerto 8080 esta ocupado.** Cambia la publicacion en `docker-compose.yml`
(`"8080:80"`) por otro puerto.

**La base quedo vacia.** Si bajaste los volumenes (`docker compose down -v`),
vuelve a arrancar: el contenedor de la API corre migraciones y seeders solo.

**El login responde 429.** Hay limite de intentos: 10 por cada 15 minutos por
IP. Reiniciar la API limpia el contador.

**La URL publica dejo de responder.** El tunel se reconecto con otra URL.
Repite el paso 4.

**Un enlace de correo apunta a `localhost`.** `PUBLIC_URL` no esta aplicada:
vuelve a correr el script del paso 4.

