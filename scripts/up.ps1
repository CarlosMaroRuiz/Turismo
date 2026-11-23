# Levanta todo el proyecto y deja la URL publica configurada.
#
#   powershell -NoProfile -File scripts/up.ps1
#   powershell -NoProfile -File scripts/up.ps1 -NoTelegram
#
# Hace, en orden:
#   1. Revisa que Docker este corriendo.
#   2. Levanta MySQL, API, frontend y bot (compila si faltan imagenes).
#   3. Levanta el tunel de Cloudflare y espera su URL.
#   4. Guarda la URL en .env y reinicia la API para que la tome.
#   5. Registra el webhook de Telegram (salvo -NoTelegram).
#   6. Comprueba que todo responde y las imprime.

param(
    [switch]$NoTelegram
)

$ErrorActionPreference = 'Continue'
$raiz = Split-Path -Parent $PSScriptRoot
Set-Location $raiz

function Paso([string]$texto) {
    Write-Host ''
    Write-Host "==> $texto" -ForegroundColor Cyan
}

function Leer-Env([string]$ruta, [string]$clave) {
    if (-not (Test-Path $ruta)) { return '' }
    $linea = Get-Content $ruta | Where-Object { $_ -match "^$clave=" } | Select-Object -First 1
    if (-not $linea) { return '' }
    return (($linea -split '=', 2)[1]).Trim().Trim('"')
}

# ---------------------------------------------------------------- 1. Docker
Paso 'Revisando Docker'
& docker info --format '{{.ServerVersion}}' > $null 2>&1
if ($LASTEXITCODE -ne 0) {
    Write-Host 'Docker no esta corriendo.' -ForegroundColor Red
    Write-Host 'Abre Docker Desktop y vuelve a intentar.'
    exit 1
}
Write-Host '  Docker responde.'

if (-not (Test-Path '.env')) {
    Write-Host ''
    Write-Host 'Falta el .env de la raiz. Copialo y completa la clave de la base:' -ForegroundColor Red
    Write-Host '  cp .env.example .env'
    exit 1
}

# ---------------------------------------------------------------- 2. Servicios
Paso 'Levantando servicios (mysql, api, frontend, bot)'
$necesitaBuild = $false
foreach ($imagen in 'turismo-api:latest', 'turismo-frontend:latest', 'turismo-bot:latest') {
    & docker image inspect $imagen > $null 2>&1
    if ($LASTEXITCODE -ne 0) { $necesitaBuild = $true }
}

if ($necesitaBuild) {
    Write-Host '  Faltan imagenes: construyendo (la primera vez tarda unos minutos).'
    & docker compose up -d --build 2>$null | Out-Null
} else {
    & docker compose up -d 2>$null | Out-Null
}
Write-Host '  Servicios levantados.'

# ---------------------------------------------------------------- 3. Tunel
Paso 'Levantando el tunel publico'
# Se recrea a proposito: si el tunel reconecta cambia de URL, y asi el log
# contiene solo la vigente.
& docker compose --profile public rm -sf tunnel 2>$null | Out-Null
& docker compose --profile public up -d tunnel 2>$null | Out-Null

$url = ''
for ($intento = 1; $intento -le 30; $intento++) {
    Start-Sleep -Seconds 3
    $log = (& docker compose logs tunnel 2>$null | Out-String)
    $coincidencias = [regex]::Matches($log, 'https://[a-z0-9-]+\.trycloudflare\.com')
    if ($coincidencias.Count -gt 0) {
        $url = $coincidencias[$coincidencias.Count - 1].Value
        break
    }
    Write-Host "  esperando la URL del tunel ($intento/30)"
}

if ($url -eq '') {
    Write-Host 'No aparecio la URL del tunel. Revisa:' -ForegroundColor Red
    Write-Host '  docker compose logs tunnel'
    exit 1
}
Write-Host "  $url"

# ---------------------------------------------------------------- 4. .env + API
Paso 'Configurando el dominio publico'
$contenido = Get-Content '.env' -Raw
if ($contenido -match '(?m)^PUBLIC_URL=') {
    $contenido = $contenido -replace '(?m)^PUBLIC_URL=.*$', "PUBLIC_URL=$url"
} else {
    $contenido = $contenido.TrimEnd() + "`nPUBLIC_URL=$url`n"
}
Set-Content -LiteralPath '.env' -Value $contenido -NoNewline
Write-Host '  .env actualizado.'

& docker compose up -d api 2>$null | Out-Null
Write-Host '  API reiniciada con el dominio nuevo.'

# ---------------------------------------------------------------- 5. Telegram
if (-not $NoTelegram) {
    Paso 'Registrando el webhook de Telegram'
    $envBot = Join-Path $raiz 'turismo-telegram-bot/turismo_bot/.env'
    $token = Leer-Env $envBot 'TELEGRAM_BOT_TOKEN'
    $secreto = Leer-Env $envBot 'TELEGRAM_WEBHOOK_SECRET'

    if ($token -eq '' -or $secreto -eq '') {
        Write-Host '  Sin TELEGRAM_BOT_TOKEN o TELEGRAM_WEBHOOK_SECRET: se omite.' -ForegroundColor Yellow
    } else {
        try {
            $respuesta = Invoke-RestMethod -Uri "https://api.telegram.org/bot$token/setWebhook" -Method Post -Body @{
                url                  = "$url/bot/telegram/webhook"
                secret_token         = $secreto
                drop_pending_updates = 'true'
            } -TimeoutSec 30

            if ($respuesta.ok) {
                Write-Host '  Webhook registrado.'
            } else {
                Write-Host ('  Telegram respondio: ' + $respuesta.description) -ForegroundColor Yellow
            }
        } catch {
            Write-Host '  No se pudo registrar el webhook.' -ForegroundColor Yellow
        }
    }
}

# ---------------------------------------------------------------- 6. Comprobacion
Paso 'Comprobando que todo responde'
$apiOk = $false
for ($intento = 1; $intento -le 30; $intento++) {
    try {
        $r = Invoke-WebRequest -Uri "$url/api/v1/openapi.json" -TimeoutSec 8 -UseBasicParsing
        if ($r.StatusCode -eq 200) { $apiOk = $true; break }
    } catch {
        # El tunel tarda unos segundos en enrutar; se reintenta.
    }
    Start-Sleep -Seconds 3
}

$localOk = $false
if (-not $apiOk) {
    try {
        $l = Invoke-WebRequest -Uri 'http://localhost:8080/api/v1/openapi.json' -TimeoutSec 8 -UseBasicParsing
        $localOk = ($l.StatusCode -eq 200)
    } catch {
        $localOk = $false
    }
}

$botOk = $false
for ($intento = 1; $intento -le 10; $intento++) {
    try {
        $b = Invoke-WebRequest -Uri "$url/bot/health" -TimeoutSec 8 -UseBasicParsing
        if ($b.StatusCode -eq 200) { $botOk = $true; break }
    } catch {
        # Igual que la API: puede tardar en quedar accesible.
    }
    Start-Sleep -Seconds 3
}

# ---------------------------------------------------------------- Resumen
Write-Host ''
Write-Host '============================================================' -ForegroundColor Green
Write-Host '  Listo, ya puedes comenzar.' -ForegroundColor Green
Write-Host '============================================================' -ForegroundColor Green
Write-Host ''
Write-Host '  App local      http://localhost:8080'
Write-Host "  URL publica    $url"
$estadoApi = if ($apiOk) { '(responde)' } elseif ($localOk) { '(local; el dominio tarda un poco)' } else { '(no responde)' }
Write-Host "  API            $url/api/v1/openapi.json  $estadoApi"
Write-Host "  Bot            $url/bot/health          $(if ($botOk) { '(responde)' } else { '(aun no)' })"
Write-Host ''
Write-Host '  Entra con:'
Write-Host '    admin@gmail.com              (la clave esta en api/.env)'
Write-Host '    playa-azul@turismo.test      Turismo123!'
Write-Host '    riviera-tours@turismo.test   Turismo123!'
Write-Host ''
Write-Host '  Webhooks que hay que registrar en los paneles:'
Write-Host "    PayPal    $url/api/v1/bookings/paypal/webhook"
Write-Host "    Telegram  $url/bot/telegram/webhook"
Write-Host ''
Write-Host '  Logs:   docker compose logs -f api'
Write-Host '  Apagar: docker compose down'
Write-Host ''
