# Turismo Telegram Bot

Servicio independiente para buscar oferta de Turismo, cotizar y pagar una salida de paquete desde un chat privado de Telegram. El bot usa el contrato de Turismo por HTTP. Las reservas, el inventario y PayPal se administran en Turismo.

## Configuración local

1. Usa Python 3.11 o posterior. Desde PowerShell:

   ```powershell
   python -m venv .venv
   .\.venv\Scripts\python.exe -m pip install -e .
   Copy-Item .env.example .env
   ```

2. Configura el token de BotFather, el secreto del webhook y la credencial de servicio de Turismo con `catalog:read,quote:write,booking:write`. Apunta `TURISMO_API_URL` al prefijo versionado de Turismo. Configura `DEEPSEEK_API_KEY` para interpretar búsquedas en lenguaje natural. El modelo predeterminado es `deepseek-flash` y se puede elegir otro mediante `DEEPSEEK_MODEL`. Los botones y el formulario también funcionan sin la clave de DeepSeek.
3. Levanta el servicio con un solo proceso y un volumen persistente para SQLite:

   ```powershell
   .\.venv\Scripts\python.exe -m uvicorn turismo_bot.app:app --host 0.0.0.0 --port 8000 --workers 1
   ```

4. Registra `https://<bot>/telegram/webhook` con `setWebhook` de Telegram. Envía el mismo `secret_token` configurado en `TELEGRAM_WEBHOOK_SECRET` y limita `allowed_updates` a `message` y `callback_query`.
5. Para PayPal, configura la API de Turismo en Sandbox y registra la URL pública de su webhook. El servidor del bot solo necesita la credencial de Turismo.

## Recorrido

Envía `/start`, elige el tipo de servicio, completa destino, fechas y viajeros, agrega una opción y pulsa **Cotizar**. El botón **Confirmar selección** aparece para una cotización de una sola salida de paquete. Las habitaciones y experiencias se pueden agregar a una cotización combinada. **Pagar con PayPal** abre la URL de aprobación y `/reserva` consulta la compra más reciente de ese chat. El bot también consulta en segundo plano y avisa cuando el pago se confirma, falla o el apartado vence.

La base SQLite conserva selección, sesión y mensajes pendientes. Cada actualización de Telegram se registra por `update_id`. Recepción y procesamiento ocurren por separado para que Telegram reciba una respuesta HTTP rápida y el trabajo pueda continuar después de reiniciar. Si se pierde la respuesta a un envío de Telegram, el reintento puede repetir el mensaje.

## Verificación

```powershell
.\.venv\Scripts\python.exe -m unittest discover -s tests -v
```

La prueba local simula Telegram, Turismo y PayPal en las respuestas HTTP. Para validar la compra completa, usa una salida futura con cupo, una cuenta compradora de Sandbox y los webhooks reales de ambos servicios.
