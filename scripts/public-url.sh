#!/usr/bin/env bash
#
# Descubre la URL publica del tunel y deja todo apuntando ahi.
#
#   bash scripts/public-url.sh
#   bash scripts/public-url.sh --telegram
#
# Hace tres cosas:
#   1. Lee la URL de Cloudflare del log del tunel.
#   2. La guarda en el .env de la raiz como PUBLIC_URL.
#   3. Reinicia la API para que APP_URL y PAYPAL_PUBLIC_API_URL la tomen.
#
# Con --telegram ademas vuelve a registrar el webhook del bot, que es necesario
# porque la URL cambia cada vez que arranca el tunel.

set -euo pipefail

RAIZ="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$RAIZ"

TELEGRAM=0
if [ "${1:-}" = "--telegram" ]; then
  TELEGRAM=1
fi

leer_env() {
  local archivo="$1" clave="$2"
  if [ ! -f "$archivo" ]; then
    return 0
  fi
  grep -m1 "^${clave}=" "$archivo" | cut -d= -f2- | tr -d '"' | tr -d "'" || true
}

# 1. URL del tunel
if ! docker compose ps --status running --services 2>/dev/null | grep -qx tunnel; then
  echo "El tunel no esta corriendo. Leventalo con:"
  echo "  docker compose --profile public up -d tunnel"
  exit 1
fi

URL="$(docker compose logs tunnel 2>/dev/null | grep -oE 'https://[a-z0-9-]+\.trycloudflare\.com' | tail -1 || true)"

if [ -z "$URL" ]; then
  echo "No encontre la URL en el log. Prueba:"
  echo "  docker compose logs -f tunnel"
  exit 1
fi

# 2. .env
if [ ! -f ".env" ]; then
  echo "Falta el .env de la raiz. Copialo de .env.example."
  exit 1
fi

if grep -q '^PUBLIC_URL=' .env; then
  sed -i.bak "s|^PUBLIC_URL=.*|PUBLIC_URL=${URL}|" .env && rm -f .env.bak
else
  printf '\nPUBLIC_URL=%s\n' "$URL" >> .env
fi

# 3. Reiniciar la API para que tome el dominio
docker compose up -d api >/dev/null 2>&1

# 4. Webhook de Telegram (opcional)
if [ "$TELEGRAM" -eq 1 ]; then
  ENV_BOT="$RAIZ/turismo-telegram-bot/turismo_bot/.env"
  TOKEN="$(leer_env "$ENV_BOT" TELEGRAM_BOT_TOKEN)"
  SECRETO="$(leer_env "$ENV_BOT" TELEGRAM_WEBHOOK_SECRET)"

  if [ -z "$TOKEN" ] || [ -z "$SECRETO" ]; then
    echo "No encontre TELEGRAM_BOT_TOKEN o TELEGRAM_WEBHOOK_SECRET en el .env del bot."
  else
    RESPUESTA="$(curl -s -X POST "https://api.telegram.org/bot${TOKEN}/setWebhook" \
      -d "url=${URL}/bot/telegram/webhook" \
      -d "secret_token=${SECRETO}" \
      -d "drop_pending_updates=true" || true)"

    case "$RESPUESTA" in
      *'"ok":true'*) echo "Webhook de Telegram registrado." ;;
      *) echo "Telegram respondio: ${RESPUESTA}" ;;
    esac
  fi
fi

echo ""
echo "URL publica:"
echo "  $URL"
echo ""
echo "Rutas que hay que registrar en los paneles:"
echo "  PayPal webhook    $URL/api/v1/bookings/paypal/webhook"
echo "  Telegram webhook  $URL/bot/telegram/webhook"
echo ""
echo "La API tarda unos segundos en volver."
