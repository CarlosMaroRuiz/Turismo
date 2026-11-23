#!/usr/bin/env bash
#
# Levanta todo el proyecto y deja la URL publica configurada.
#
#   bash scripts/up.sh
#   bash scripts/up.sh --no-telegram
#
# Hace, en orden:
#   1. Revisa que Docker este corriendo.
#   2. Levanta MySQL, API, frontend y bot (compila si faltan imagenes).
#   3. Levanta el tunel de Cloudflare y espera su URL.
#   4. Guarda la URL en .env y reinicia la API para que la tome.
#   5. Registra el webhook de Telegram (salvo --no-telegram).
#   6. Comprueba que todo responde y las imprime.

set -uo pipefail

RAIZ="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$RAIZ"

TELEGRAM=1
if [ "${1:-}" = "--no-telegram" ]; then
  TELEGRAM=0
fi

paso() {
  echo ""
  echo "==> $1"
}

leer_env() {
  local archivo="$1" clave="$2"
  if [ ! -f "$archivo" ]; then
    return 0
  fi
  grep -m1 "^${clave}=" "$archivo" | cut -d= -f2- | tr -d '"' | tr -d "'" || true
}

# ---------------------------------------------------------------- 1. Docker
paso "Revisando Docker"
if ! docker info >/dev/null 2>&1; then
  echo "Docker no esta corriendo. Arrancalo y vuelve a intentar."
  exit 1
fi
echo "  Docker responde."

if [ ! -f ".env" ]; then
  echo ""
  echo "Falta el .env de la raiz. Copialo y completa la clave de la base:"
  echo "  cp .env.example .env"
  exit 1
fi

# ---------------------------------------------------------------- 2. Servicios
paso "Levantando servicios (mysql, api, frontend, bot)"
NECESITA_BUILD=0
for imagen in turismo-api:latest turismo-frontend:latest turismo-bot:latest; do
  if ! docker image inspect "$imagen" >/dev/null 2>&1; then
    NECESITA_BUILD=1
  fi
done

if [ "$NECESITA_BUILD" -eq 1 ]; then
  echo "  Faltan imagenes: construyendo (la primera vez tarda unos minutos)."
  docker compose up -d --build >/dev/null 2>&1
else
  docker compose up -d >/dev/null 2>&1
fi
echo "  Servicios levantados."

# ---------------------------------------------------------------- 3. Tunel
paso "Levantando el tunel publico"
# Se recrea a proposito: si el tunel reconecta cambia de URL, y asi el log
# contiene solo la vigente.
docker compose --profile public rm -sf tunnel >/dev/null 2>&1
docker compose --profile public up -d tunnel >/dev/null 2>&1

URL=""
for intento in $(seq 1 30); do
  sleep 3
  URL="$(docker compose logs tunnel 2>/dev/null | grep -oE 'https://[a-z0-9-]+\.trycloudflare\.com' | tail -1 || true)"
  if [ -n "$URL" ]; then
    break
  fi
  echo "  esperando la URL del tunel ($intento/30)"
done

if [ -z "$URL" ]; then
  echo "No aparecio la URL del tunel. Revisa:"
  echo "  docker compose logs tunnel"
  exit 1
fi
echo "  $URL"

# ---------------------------------------------------------------- 4. .env + API
paso "Configurando el dominio publico"
if grep -q '^PUBLIC_URL=' .env; then
  sed -i.bak "s|^PUBLIC_URL=.*|PUBLIC_URL=${URL}|" .env && rm -f .env.bak
else
  printf '\nPUBLIC_URL=%s\n' "$URL" >> .env
fi
echo "  .env actualizado."

docker compose up -d api >/dev/null 2>&1
echo "  API reiniciada con el dominio nuevo."

# ---------------------------------------------------------------- 5. Telegram
if [ "$TELEGRAM" -eq 1 ]; then
  paso "Registrando el webhook de Telegram"
  ENV_BOT="$RAIZ/turismo-telegram-bot/turismo_bot/.env"
  TOKEN="$(leer_env "$ENV_BOT" TELEGRAM_BOT_TOKEN)"
  SECRETO="$(leer_env "$ENV_BOT" TELEGRAM_WEBHOOK_SECRET)"

  if [ -z "$TOKEN" ] || [ -z "$SECRETO" ]; then
    echo "  Sin TELEGRAM_BOT_TOKEN o TELEGRAM_WEBHOOK_SECRET: se omite."
  else
    RESPUESTA="$(curl -s -X POST "https://api.telegram.org/bot${TOKEN}/setWebhook" \
      -d "url=${URL}/bot/telegram/webhook" \
      -d "secret_token=${SECRETO}" \
      -d "drop_pending_updates=true" || true)"

    case "$RESPUESTA" in
      *'"ok":true'*) echo "  Webhook registrado." ;;
      *) echo "  Telegram respondio: ${RESPUESTA}" ;;
    esac
  fi
fi

# ---------------------------------------------------------------- 6. Comprobacion
paso "Comprobando que todo responde"
API_OK="no"
for intento in $(seq 1 30); do
  if curl -sf -o /dev/null "${URL}/api/v1/openapi.json"; then
    API_OK="si"
    break
  fi
  sleep 3
done

LOCAL_OK="no"
if [ "$API_OK" = "no" ]; then
  if curl -sf -o /dev/null "http://localhost:8080/api/v1/openapi.json"; then
    LOCAL_OK="si"
  fi
fi

BOT_OK="no"
for intento in $(seq 1 10); do
  if curl -sf -o /dev/null "${URL}/bot/health"; then
    BOT_OK="si"
    break
  fi
  sleep 3
done

# ---------------------------------------------------------------- Resumen
echo ""
echo "============================================================"
echo "  Listo, ya puedes comenzar."
echo "============================================================"
echo ""
echo "  App local      http://localhost:8080"
echo "  URL publica    $URL"
ESTADO_API="no responde"
if [ "$API_OK" = "si" ]; then
  ESTADO_API="responde"
elif [ "$LOCAL_OK" = "si" ]; then
  ESTADO_API="responde en local; el dominio tarda un poco"
fi
echo "  API            $URL/api/v1/openapi.json  ($ESTADO_API)"
echo "  Bot            $URL/bot/health           (responde: $BOT_OK)"
echo ""
echo "  Entra con:"
echo "    admin@gmail.com              (la clave esta en api/.env)"
echo "    playa-azul@turismo.test      Turismo123!"
echo "    riviera-tours@turismo.test   Turismo123!"
echo ""
echo "  Webhooks que hay que registrar en los paneles:"
echo "    PayPal    $URL/api/v1/bookings/paypal/webhook"
echo "    Telegram  $URL/bot/telegram/webhook"
echo ""
echo "  Logs:   docker compose logs -f api"
echo "  Apagar: docker compose down"
echo ""
