# Descubre la URL publica del tunel y deja todo apuntando ahi.
#
#   powershell -NoProfile -File scripts/public-url.ps1
#   powershell -NoProfile -File scripts/public-url.ps1 -Telegram
#
# Hace tres cosas:
#   1. Lee la URL de Cloudflare del log del tunel.
#   2. La guarda en el .env de la raiz como PUBLIC_URL.
#   3. Reinicia la API para que APP_URL y PAYPAL_PUBLIC_API_URL la tomen.
#
# Con -Telegram ademas vuelve a registrar el webhook del bot, que es necesario
# porque la URL cambia cada vez que arranca el tunel.

param(
    [switch]$Telegram
)

$ErrorActionPreference = 'Continue'
$raiz = Split-Path -Parent $PSScriptRoot
Set-Location $raiz

function Leer-Env([string]$ruta, [string]$clave) {
    if (-not (Test-Path $ruta)) {
        return ''
    }

    $linea = Get-Content $ruta | Where-Object { $_ -match "^$clave=" } | Select-Object -First 1
    if (-not $linea) {
        return ''
    }

    return (($linea -split '=', 2)[1]).Trim().Trim('"')
}

# 1. URL del tunel
$servicios = & docker compose ps --status running --services 2>$null
if ($servicios -notcontains 'tunnel') {
    Write-Host 'El tunel no esta corriendo. Leventalo con:' -ForegroundColor Yellow
    Write-Host '  docker compose --profile public up -d tunnel'
    exit 1
}

$log = (& docker compose logs tunnel 2>$null | Out-String)
$url = [regex]::Match($log, 'https://[a-z0-9-]+\.trycloudflare\.com').Value

if ($url -eq '') {
    Write-Host 'No encontre la URL en el log. Prueba:' -ForegroundColor Yellow
    Write-Host '  docker compose logs -f tunnel'
    exit 1
}

# 2. .env
$rutaEnv = Join-Path $raiz '.env'
if (-not (Test-Path $rutaEnv)) {
    Write-Host 'Falta el .env de la raiz. Copialo de .env.example.' -ForegroundColor Red
    exit 1
}

$contenido = Get-Content $rutaEnv -Raw
if ($contenido -match '(?m)^PUBLIC_URL=') {
    $contenido = $contenido -replace '(?m)^PUBLIC_URL=.*$', "PUBLIC_URL=$url"
} else {
    $contenido = $contenido.TrimEnd() + "`nPUBLIC_URL=$url`n"
}
Set-Content -LiteralPath $rutaEnv -Value $contenido -NoNewline

# 3. Reiniciar la API para que tome el dominio
& docker compose up -d api 2>$null | Out-Null

# 4. Webhook de Telegram (opcional)
if ($Telegram) {
    $envBot = Join-Path $raiz 'turismo-telegram-bot/turismo_bot/.env'
    $token = Leer-Env $envBot 'TELEGRAM_BOT_TOKEN'
    $secreto = Leer-Env $envBot 'TELEGRAM_WEBHOOK_SECRET'

    if ($token -eq '' -or $secreto -eq '') {
        Write-Host 'No encontre TELEGRAM_BOT_TOKEN o TELEGRAM_WEBHOOK_SECRET en el .env del bot.' -ForegroundColor Red
    } else {
        try {
            $respuesta = Invoke-RestMethod -Uri "https://api.telegram.org/bot$token/setWebhook" -Method Post -Body @{
                url                  = "$url/bot/telegram/webhook"
                secret_token         = $secreto
                drop_pending_updates = 'true'
            } -TimeoutSec 30

            if ($respuesta.ok) {
                Write-Host 'Webhook de Telegram registrado.' -ForegroundColor Green
            } else {
                Write-Host ('Telegram respondio: ' + $respuesta.description) -ForegroundColor Red
            }
        } catch {
            Write-Host 'No se pudo registrar el webhook de Telegram.' -ForegroundColor Red
        }
    }
}

Write-Host ''
Write-Host 'URL publica:' -ForegroundColor Cyan
Write-Host "  $url"
Write-Host ''
Write-Host 'Rutas que hay que registrar en los paneles:'
Write-Host "  PayPal webhook    $url/api/v1/bookings/paypal/webhook"
Write-Host "  Telegram webhook  $url/bot/telegram/webhook"
Write-Host ''
Write-Host 'La API tarda unos segundos en volver.'
