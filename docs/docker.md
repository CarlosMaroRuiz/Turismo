# Levantar el proyecto con Docker

Todo el sistema en contenedores, con **un solo puerto publico** que sirve el
frontend, la API y el bot. Ese dominio es el que necesitan PayPal, Telegram y
los enlaces de los correos.

## Requisitos

- Docker Desktop con Compose v2.
- Los archivos de secretos ya existentes: `api/.env` y
  `turismo-telegram-bot/turismo_bot/.env`.
- Un `.env` en la raiz (copialo de `.env.example`):

```bash
cp .env.example .env
```

```env
DB_PASSWORD=la-misma-clave-de-la-base
DB_NAME=turista
PUBLIC_URL=http://localhost:8080
```

`DB_PASSWORD` tiene que coincidir con la que usa la API cuando corre fuera de
Docker. En el contenedor, `api/.env` aporta el resto (JWT, correo, PayPal,
cliente de servicio) y el compose solo sobreescribe la conexion a la base.

## Arrancar

**Todo en uno** (servicios, tunel, `.env`, reinicio de la API, webhook y
comprobacion):

Windows:

```bat
scripts\up.cmd
```

Linux y macOS:

```bash
bash scripts/up.sh
```

Al terminar imprime la URL publica, las cuentas de prueba y las rutas de los
webhooks. No hace falta nada mas.

`up.cmd` llama a `up.ps1` con `-ExecutionPolicy Bypass`, asi que no falla con el
error "is not digitally signed".

**Paso a paso**, si prefieres ver que pasa en cada momento:

```bash
docker compose up -d --build
```

| Servicio | Puerto en tu maquina | Para que |
|---|---|---|
| `frontend` | `8080` | La app y el proxy `/api` |
| `bot` | `8000` | Webhook de Telegram |
| `mysql` | no publicado | Base de datos interna |
| `api` | no publicado | Solo accesible por la red de Docker |

La app queda en **http://localhost:8080**. La API responde en
`http://localhost:8080/api/v1/openapi.json`.

Al arrancar, el contenedor de la API corre migraciones y seeders
(`AUTO_MIGRATE` y `AUTO_SEED`), asi que la primera vez tarda un poco mas.

```bash
docker compose ps            # estado
docker compose logs -f api   # ver migraciones, correo y peticiones
docker compose down          # apagar
docker compose down -v       # apagar y borrar la base
```

## Exponer un puerto publico

PayPal no puede llamar a `localhost`, Telegram tampoco, y un enlace de correo
con `localhost` solo funciona en esa maquina. Para eso esta el servicio
`tunnel` (Cloudflare, sin cuenta):

```bash
docker compose --profile public up -d tunnel
docker compose logs -f tunnel
```

En el log aparece una linea como:

```
https://algo-aleatorio.trycloudflare.com
```

1. Copia esa URL en el `.env` de la raiz:

```env
PUBLIC_URL=https://algo-aleatorio.trycloudflare.com
```

2. Reinicia la API para que tome el dominio nuevo:

```bash
docker compose up -d api
```

Con eso el sistema ya atiende desde internet:

| Servicio externo | URL que hay que registrar |
|---|---|
| PayPal webhook | `https://<dominio>/api/v1/bookings/paypal/webhook` |
| PayPal retorno | lo genera la API con `PAYPAL_PUBLIC_API_URL` |
| Telegram webhook | `https://<dominio>/bot/telegram/webhook` |
| Enlaces de correo | se arman con `APP_URL` |

La URL de `trycloudflare` cambia cada vez que reinicias el tunel. Para algo
estable hace falta un dominio propio con un tunel con nombre, o desplegar en un
servidor.

### Registrar el webhook de Telegram

```bash
curl "https://api.telegram.org/bot<TELEGRAM_BOT_TOKEN>/setWebhook" \
  -d "url=https://<dominio>/bot/telegram/webhook" \
  -d "secret_token=<TELEGRAM_WEBHOOK_SECRET>"
```

El `secret_token` es el mismo `TELEGRAM_WEBHOOK_SECRET` del `.env` del bot: el
bot rechaza cualquier actualizacion que no lo traiga.

## Probar las tres integraciones

**Correo.** Crea un socio desde el panel con la casilla "Aprobar y enviar la
invitacion ahora" y un correo nuevo. El enlace debe abrir el dominio publico,
no `localhost`:

```bash
docker compose logs -f api | grep mail
```

**Pagos.** Desde el bot, cotiza un paquete y aparta. El enlace de PayPal debe
regresar al dominio publico. Tras pagar en sandbox, el webhook llega a
`/api/v1/bookings/paypal/webhook` y la reserva pasa a `confirmed`.

**Bot.** Escribe al bot en Telegram. Si el webhook quedo registrado, responde.
Prueba: `docker compose logs -f bot`.

## Como ver la URL publica

La URL de `trycloudflare` es aleatoria y aparece en el log del tunel. Hay tres
formas de encontrarla.

**1. El atajo (recomendado).** Deja la URL en el `.env`, reinicia la API y, si
quieres, vuelve a registrar el webhook del bot.

Windows:

```powershell
powershell -NoProfile -File scripts/public-url.ps1 -Telegram
```

Linux y macOS:

```bash
bash scripts/public-url.sh --telegram
```

Sin la bandera (`-Telegram` / `--telegram`) solo actualiza la URL y reinicia la
API. Las dos versiones del script hacen lo mismo.

El script imprime al final las dos rutas que hay que pegar en PayPal y en
Telegram.

**2. A mano, con el log:**

```bash
docker compose logs tunnel | grep -o 'https://[a-z0-9-]*\.trycloudflare\.com' | tail -1
```

**3. Preguntandole al sistema:**

```bash
curl -s https://<la-url>/api/v1/openapi.json > /dev/null && echo "sigue viva"
```

Si `docker compose ps` muestra el tunel como `Up` pero la URL no responde, el
tunel se reconecto y genero otra: vuelve a leer el log.

### Evitar el baile de la URL

Para que no cambie nunca, hace falta un dominio propio y un tunel con nombre de
Cloudflare (gratis, requiere cuenta y un dominio):

```yaml
  tunnel:
    image: cloudflare/cloudflared:latest
    restart: unless-stopped
    command: tunnel --no-autoupdate run --token ${CLOUDFLARE_TUNNEL_TOKEN}
```

```env
PUBLIC_URL=https://turismo.tudominio.com
```

Con un comienzo fijo, `PUBLIC_URL` no cambia, los webhooks se registran una sola
vez y los enlaces de los correos siguen siendo validos tras reiniciar.

## Notas

- El `frontend` se compila con `VITE_API_URL=/api/v1`, o sea ruta relativa: el
  navegador pega al mismo dominio y nginx envia a la API. Asi no hay CORS ni
  contenido mixto cuando el dominio es `https`.
- `mysql` no publica el 3306 para no chocar con una base local. Si necesitas
  conectarte con un cliente, agrega un `ports` temporal o usa
  `docker compose exec mysql mysql -uroot -p`.
- El bot guarda su SQLite en el volumen `bot_data`, asi que sobrevive a
  reinicios.
