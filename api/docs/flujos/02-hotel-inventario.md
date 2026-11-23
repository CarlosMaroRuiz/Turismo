# Flujo 02 — El hotel carga habitaciones e inventario

**Objetivo:** recorrer el portal de hotel de punta a punta: el administrador da de alta el hotel, el owner activa su cuenta, carga dos tipos de habitación con imágenes, define tarifas e inventario por fecha y el catálogo público empieza a ofrecerlas (incluido el cierre rápido).

**Prueba ejecutable:** [src/test/flow/hotel-inventario.flow.test.ts](../../src/test/flow/hotel-inventario.flow.test.ts)
**Comando:** `npm run test:flow` (corre los tres flujos)
**Alcance:** solo endpoints. La única lectura fuera de HTTP es el buzón falso, por el token de activación.

**Precondiciones**

- Base `turista_test` recreada y sembrada.
- Super usuario del seeder.
- Categoría `hotel` y una región activa en los catálogos.

---

## Recorrido paso a paso

| # | Petición | Resultado esperado |
|---|---|---|
| 1 | `GET /health` | `200` |
| 2 | `POST /auth/login` (admin del seeder) | `200` |
| 3 | `GET /partner-categories?includeInactive=true` · `GET /regions?status=all&type=municipality` | categoría `hotel` y municipio activo |
| 4 | `POST /partners` (categoría `hotel`, `invite:false`) | `201`, socio `pending` |
| 5 | `PATCH /partners/:id/approve` | `200` y **1 correo** |
| 6 | `POST /auth/activate` con el token del correo | `200` |
| 7 | `POST /auth/login` con el owner | `200`, `partner.id` = el hotel y **`categoryCode: "hotel"`** |
| 8 | `POST /hotels/room-types` (doble, 2/1, 4 unidades, 1200) con `images` | `201`, devuelve las imágenes |
| 9 | `POST /hotels/room-types` (suite, 4/2, 2 unidades, 2200) | `201` |
| 10 | `PUT /hotels/room-types/:id/inventory` (rango de 4 fechas, 3 unidades, 1500) | `200`, `created: 4` |
| 11 | `PUT .../inventory` (mismo rango, solo `price: 1600`) | `200`, `updated: 4` |
| 12 | `GET .../inventory?from&to` | 4 filas ordenadas, primera con precio 1600 y 3 unidades |
| 13 | `GET /hotels/room-types?partnerId=…&guests=2` | la habitación aparece con sus imágenes y amenidades |
| 14 | `GET /hotels/availability` (3 noches, 2 adultos + 1 menor) | `nights: 3`, `totalPrice: 4800` y 3 tarifas nocturnas |
| 15 | Misma consulta con 3 adultos | la **doble desaparece** (capacidad 2) y la **suite aparece** (capacidad 4) |
| 16 | `PUT .../inventory` con `isClosed: true` en la primera noche → consultar → reabrir | la habitación deja de ofrecerse y vuelve al reabrir |
| 17 | `PATCH /hotels/room-types/:id` con el token de una agencia | `403 ROOM_TYPE_ACCESS_DENIED` |

## Aritmética que valida el paso 14

| Concepto | Cálculo | Importe |
|---|---|---|
| Noche 1 | tarifa cargada en el paso 11 | 1600 |
| Noche 2 | ídem | 1600 |
| Noche 3 | ídem | 1600 |
| **Total** | 3 × 1600 | **4800** |

El rango del inventario es **inclusivo en ambas fechas** (4 filas para un rango de 3 noches); la estancia solo cobra las noches entre `checkIn` y `checkOut`.

## Reglas que valida este flujo

- El alta del hotel exige **aprobación + activación por correo** antes de operar.
- La sesión del hotel trae **`categoryCode: "hotel"`**, así el frontend sabe qué portal mostrar sin otro request.
- Sin fila de inventario se usan `totalUnits` y `basePrice`; con fila, manda la fila.
- **La capacidad filtra la disponibilidad** (adultos/menores por habitación).
- **Cierre rápido**: una fecha cerrada deja de ofrecerse de inmediato y reabrirla la devuelve.
- **Aislamiento**: otro socio (una agencia) no puede editar la habitación.
- Los precios viajan como número, no como string.

## Observaciones y huecos

1. **No hay endpoint para editar una sola noche**: se usa `PUT` con `from = to`. Funciona, pero el panel necesitará un selector de rango igualmente.
2. **El inventario no se descuenta con reservas** porque aún no existen reservas ni bloqueo de 15 minutos.
3. **No hay borrado de habitación**: se desactiva con `PATCH { isActive: false }` y deja de aparecer en el catálogo público, pero sigue existiendo para el hotel.
4. Las imágenes son **URLs**; la subida de archivos no está implementada.

## Cómo mantenerlo

- Un `it()` por paso; el nombre indica dónde se rompió.
- Datos con sufijo `RUN`; no requiere limpieza.
- Si cambia la aritmética de precios o la regla de inventario, actualizar la tabla del paso 14 y este documento.
