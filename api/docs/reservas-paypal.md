# Reservas de paquetes con PayPal

El bot de Telegram se despliega como servicio independiente desde la carpeta [`turismo-telegram-bot`](../../turismo-telegram-bot/README.md). Turismo emite las cotizaciones y administra inventario, órdenes de pago y reservas.

## Configuración

- Ejecuta la migración con `npm run migration:run`.
- Registra una credencial de servicio con `SERVICE_CLIENT_SCOPES=catalog:read,quote:write,booking:write`. El seeder crea credenciales nuevas; para una existente configura explícitamente sus scopes.
- Configura `PAYPAL_MODE=sandbox`, `PAYPAL_CLIENT_ID`, `PAYPAL_CLIENT_SECRET`, `PAYPAL_WEBHOOK_ID` y `PAYPAL_PUBLIC_API_URL`. La última variable contiene el origen HTTPS público de la API, sin `/api/v1`.
- En la app de PayPal registra `https://<api>/api/v1/bookings/paypal/webhook` y suscribe `CHECKOUT.ORDER.APPROVED`, `PAYMENT.CAPTURE.COMPLETED`, `PAYMENT.CAPTURE.PENDING` y `PAYMENT.CAPTURE.DENIED`. Prueba primero con un vendedor y un comprador de Sandbox.

## Contrato

1. `POST /api/v1/quotes` emite una cotización vinculada al cliente de servicio.
2. `POST /api/v1/bookings/checkout` recibe `{ "quoteId": "...", "travelerRef": "telegram:123" }` con scope `booking:write`. Para una sola salida, aparta cupos por 15 minutos y devuelve `bookingId`, `status`, `total`, `currency`, `expiresAt` y `paymentUrl`. Reintentar una cotización recupera la misma compra.
3. `GET /api/v1/bookings/:id?travelerRef=telegram:123` consulta el estado y puede conciliar el pago con PayPal. La consulta exige la credencial y la referencia de viajero que crearon la compra.
4. La API verifica el webhook de aprobación y consulta el estado de la orden. Una captura cuyo resultado se desconoce mantiene el apartado mientras se concilia. La captura completada convierte el apartado en lugares vendidos dentro de una transacción.

La fase de pago cubre una salida de paquete por compra con una cuenta receptora. Los tres tipos de servicios siguen disponibles para cotizar. Una cotización anterior a la migración se puede consultar durante su vigencia y requiere volver a cotizar para crear un apartado.

La suite `npm run test:booking` prepara la base de pruebas y verifica el apartado concurrente, la firma del webhook y la captura con un proveedor simulado.
