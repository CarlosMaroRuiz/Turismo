# Flujo 03 — El agente cotiza un viaje multi-servicio

**Objetivo:** el servicio de LLM (no una persona) prepara una cotización que combina paquete de agencia + estancia de hotel + turno de atractivo, y el API devuelve el desglose calculado, con descuento, impuestos y vencimiento.

**Prueba ejecutable:** [src/test/flow/agente-cotizacion.flow.test.ts](../../src/test/flow/agente-cotizacion.flow.test.ts)
**Comando:** `npm run test:flow` (corre los dos flujos)
**Alcance:** solo endpoints. La única lectura fuera de HTTP es el buzón falso, por el token de activación de los proveedores.

**Precondiciones**

- Base `turista_test` recreada y sembrada.
- Super usuario del seeder.
- Agencia sembrada (`agencia.test@plataforma.com`) usada como proveedor de paquetes.
- Cliente de servicio de test con scopes `catalog:read,quote:write`.

---

## Recorrido paso a paso

| # | Petición | Resultado esperado |
|---|---|---|
| 1 | `GET /health` | `200` |
| 2 | `POST /auth/login` (admin del seeder) | `200`, `role: "super_user"` |
| 3 | `GET /partner-categories?includeInactive=true` · `GET /regions?status=all&type=municipality` | categorías `agency`/`hotel`/`attraction` y un municipio |
| 4 | `POST /auth/login` (agencia sembrada) | `200`, `role: "partner"` |
| 5 | `POST /packages` con `promotions: [10 %]` | `201`, borrador |
| 6 | `POST /packages/:id/departures` → `PATCH /packages/:id/status` | `201` y `200` (`published`) |
| 7 | `POST /partners` (hotel) → `PATCH /approve` → `POST /auth/activate` → login | hotel activo y con sesión |
| 8 | `POST /hotels/room-types` → `PUT /hotels/room-types/:id/inventory` | `201` y `200`, 3 noches tarifadas a 1500 |
| 9 | `POST /partners` (atractivo) → `PATCH /approve` → `POST /auth/activate` → login | operador activo y con sesión |
| 10 | `POST /experiences` → `POST /experiences/:id/slots` | `201`, turno con aforo 4 |
| 11 | `POST /auth/service-token` | `200`, scopes incluyen `quote:write` |
| 12 | `POST /quotes` con los 3 ítems | `201`, subtotal **13700**, descuento **900**, impuestos **0**, total **12800**, referencia `QT-…` |
| 13 | `GET /quotes/:id` | `200`, mismo total; vence en ~15 minutos |
| 14 | `GET /quotes/:id` (desglose por línea) | paquete 9000 con 900 de descuento; habitación 2 noches; turno a 850 por adulto |
| 15 | `POST /quotes` con 5 personas en un turno de 4, y con 3 adultos en habitación de 2 | `400 INSUFFICIENT_AVAILABILITY` y `400 ROOM_CAPACITY_EXCEEDED` |
| 16 | `POST /quotes` sin token, con token de usuario y con token de servicio | `401`, `403 SERVICE_TOKEN_REQUIRED` y `201` |

## Aritmética que valida el paso 12

| Ítem | Cálculo | Importe |
|---|---|---|
| Paquete | 2 adultos × 4500 | 9000 |
| Descuento 10 % (promoción vigente) | 9000 × 10 % | −900 |
| Habitación | 2 noches × 1500 | 3000 |
| Turno | 2 adultos × 850 | 1700 |
| **Subtotal** | 9000 + 3000 + 1700 | **13700** |
| **Total** | 13700 − 900 + 0 | **12800** |

## Reglas que valida este flujo

- **El precio lo calcula el API**: el cliente manda ids y cantidades; si mandara precios, se ignoran.
- **La cotización es un objeto con vencimiento** (`expiresAt` ~15 min), no una respuesta suelta.
- **La promoción se aplica sola** cuando la fecha de salida cae en vigencia y se cumple el mínimo de personas.
- **La disponibilidad se revalida al cotizar**: cupo de la salida, unidades y cierre de la habitación, aforo del turno.
- **La capacidad del hotel se respeta** (adultos/menores por tipo de habitación).
- **El actor es una máquina**: la cotización exige credencial de servicio con `quote:write`; un token de usuario no sirve.
- **Cada proveedor gestiona solo lo suyo**, y cada alta exige su activación por correo.

## Observaciones y huecos

1. **El vencimiento no se fuerza en este flujo.** Al ser “solo endpoints” no se puede adelantar `expiresAt`; acá se verifica que la vigencia sea ~15 min. El `410 QUOTE_EXPIRED` se prueba en la suite de recursos, donde sí se puede manipular la fecha.
2. **Impuestos:** el paquete del flujo tiene `taxesIncluded: true`, así que los impuestos son 0. El caso con `taxesIncluded: false` (aplicar `QUOTE_TAX_RATE`) y el desglose fiscal por estado (IVA/ISH) **no están cubiertos**: el modelo fiscal sigue pendiente.
3. **La cotización no reserva nada**: no toca inventario. El bloqueo de 15 minutos y la reserva son la siguiente fase del producto.
4. **Se reutiliza la agencia sembrada** para el paquete; hoteles y atractivos se crean en el flujo porque no hay fixtures de esos tipos.
5. La cotización no valida que el socio esté activo por separado: lo hace a través de la regla de negocio (paquete publicado + agencia activa, habitación activa + hotel activo, experiencia activa + operador activo).

## Cómo mantenerlo

- Un `it()` por paso; el nombre indica dónde se rompió.
- Datos con sufijo `RUN`; no requiere limpieza.
- Si cambia la aritmética de precios o la vigencia, actualizar la tabla del paso 12 y este documento.
