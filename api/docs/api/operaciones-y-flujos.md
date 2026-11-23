# Operaciones y flujos del API

Documento de referencia para el cliente (React) y para cualquier integración. El contrato ejecutable y actualizado es `GET /api/v1/openapi.json`; este documento lo cuenta en prosa, agrupado por rol, con los flujos de negocio al final.

- **Base URL**: `http://localhost:3000/api/v1`
- **Contrato**: `GET /api/v1/openapi.json` (OpenAPI 3.1)
- **Salud**: `GET /health` (fuera del prefijo `/api/v1`)
- **Total**: 58 operaciones en 44 rutas (+ el propio `openapi.json`)

---

## 1. Convenciones

### Sobre de respuesta

```json
// éxito
{ "ok": true, "message": "…", "data": {}, "meta": { "page": 1, "limit": 50, "total": 12, "totalPages": 1 } }

// error
{ "ok": false, "code": "VALIDATION_ERROR", "message": "…", "errors": { "email": ["…"] } }
```

`meta` solo aparece en listados. `errors` solo en `VALIDATION_ERROR` (422).

### Autenticación y roles

- `Authorization: Bearer <accessToken>` en todas las rutas que no sean públicas.
- El access token es corto (`expiresIn`, ~15 min). Se renueva con `POST /auth/refresh` usando el `refreshToken`; el refresh rota y el anterior queda revocado.
- Roles globales: `super_user` (administración de la plataforma) y `partner` (socio). El rol interno dentro del socio viene en `user.partner.role`: `owner` o `staff`.
- Si la cuenta tiene `mustChangePassword`, cualquier ruta que no sea `/auth/me`, `/auth/change-password`, `/auth/refresh` o `/auth/logout` responde **403 `PASSWORD_CHANGE_REQUIRED`**.
- Cada petición revalida en base: cuenta activa, `tokenVersion`, vínculo del socio activo y socio no suspendido.

### Códigos de error principales

| HTTP | Códigos |
|---|---|
| 400 | `BAD_REQUEST`, `INVALID_JSON`, `INVALID_DATE_RANGE`, `INSUFFICIENT_AVAILABILITY`, `ROOM_CAPACITY_EXCEEDED`, `DEPARTURE_DATE_PAST`, `SLOT_DATE_PAST`, `SEATS_BELOW_SOLD`, `CAPACITY_BELOW_BOOKED`, `PASSWORD_REUSED` |
| 401 | `TOKEN_REQUIRED`, `INVALID_TOKEN`, `TOKEN_EXPIRED`, `TOKEN_REVOKED`, `INVALID_CREDENTIALS`, `ACCOUNT_INACTIVE`, `INVALID_REFRESH_TOKEN`, `REFRESH_TOKEN_REVOKED`, `REFRESH_TOKEN_EXPIRED` |
| 403 | `ROLE_NOT_ALLOWED`, `PASSWORD_CHANGE_REQUIRED`, `PARTNER_REQUIRED`, `PARTNER_INACTIVE`, `PARTNER_ACCESS_REVOKED`, `PARTNER_NOT_AGENCY`, `PARTNER_NOT_HOTEL`, `PARTNER_NOT_ATTRACTION`, `*_ACCESS_DENIED`, `USER_TOKEN_REQUIRED`, `SERVICE_TOKEN_REQUIRED`, `INSUFFICIENT_SCOPE` |
| 404 | `ROUTE_NOT_FOUND`, `NOT_FOUND`, `PACKAGE_NOT_FOUND`, `ROOM_TYPE_NOT_FOUND`, `EXPERIENCE_NOT_FOUND`, `SLOT_NOT_FOUND`, `DEPARTURE_NOT_FOUND`, `QUOTE_NOT_FOUND`, `CATEGORY_NOT_AVAILABLE`, `REGION_NOT_AVAILABLE` |
| 409 | `DUPLICATE_RESOURCE`, `EMAIL_ALREADY_REGISTERED`, `CATEGORY_CODE_TAKEN`, `SLUG_TAKEN`, `DEPARTURE_DATE_TAKEN`, `SLOT_TAKEN` |
| 410 | `QUOTE_EXPIRED` |
| 422 | `VALIDATION_ERROR` |
| 429 | `RATE_LIMITED` |
| 500 | `INTERNAL_ERROR` |

### Paginación

`?page=1&limit=50` (`limit` máximo 200, por defecto 50). Respuesta con `meta`.

### Fechas y precios

- Fechas sin hora: `YYYY-MM-DD` (string). Horas de turno: `HH:MM`.
- Precios: número (no string) en `MXN`.

---

## 2. Operaciones por área

### 2.1 Autenticación y sesión

| Método | Ruta | Acceso | Descripción |
|---|---|---|---|
| POST | `/auth/login` | público | `{ email, password }` → tokens + perfil |
| POST | `/auth/refresh` | público | `{ refreshToken }` → par nuevo |
| POST | `/auth/logout` | público | `{ refreshToken? }` → revoca |
| POST | `/auth/activate` | público | `{ token, password }` → activa la cuenta |
| POST | `/auth/change-password` | usuario | `{ currentPassword, newPassword }` → cierra otras sesiones |
| GET | `/auth/me` | usuario | Perfil (incluye `mustChangePassword`) |
| POST | `/auth/service-token` | máquina | Credencial de servicio (no la usa el frontend) |

### 2.2 Administración: socios

| Método | Ruta | Acceso | Descripción |
|---|---|---|---|
| GET | `/partners` | admin | Listado `?status=pending\|active\|suspended\|rejected` + paginación |
| POST | `/partners` | admin | Alta directa; `invite: true` aprueba y envía el correo |
| GET | `/partners/:id` | admin o socio propio | Ficha |
| PATCH | `/partners/:id` | admin u owner | Ficha; `categoryId`, `regionId` y `slug` solo admin |
| PATCH | `/partners/:id/approve` | admin | `pending → active` + invitación |
| PATCH | `/partners/:id/reject` | admin | `{ reason }` (mín. 10) → `rejected` + correo |
| PATCH | `/partners/:id/suspend` | admin | `{ reason }` → `suspended` |
| PATCH | `/partners/:id/reactivate` | admin | `suspended → active` |
| POST | `/partners/:id/resend-invite` | admin | Reenvía si el owner sigue `invited` |
| POST | `/partners/register` | público | Solicitud pública (queda `pending`) |

### 2.3 Administración: equipo del socio

| Método | Ruta | Acceso | Descripción |
|---|---|---|---|
| GET | `/partners/:id/members` | admin o socio propio | Equipo |
| POST | `/partners/:id/members` | admin u owner | `{ name, email, phone?, role }` → invitación |
| PATCH | `/partners/:id/members/:memberId` | admin u owner | `{ role?, isActive? }`; no permite quedarse sin owner activo |

### 2.4 Catálogos: categorías de socio

| Método | Ruta | Acceso | Descripción |
|---|---|---|---|
| GET | `/partner-categories` | público | Activas; `?includeInactive=true` para admin |
| GET | `/partner-categories/:id` | público | Detalle |
| POST | `/partner-categories` | admin | `{ code, name }`; `code` único |
| PATCH | `/partner-categories/:id` | admin | `{ name?, isActive? }` |
| PATCH | `/partner-categories/:id/toggle-status` | admin | Alterna activa/inactiva |
| DELETE | `/partner-categories/:id` | admin | Baja lógica |

### 2.5 Catálogos: regiones

| Método | Ruta | Acceso | Descripción |
|---|---|---|---|
| GET | `/regions/states` | público | Estados (`?includeInactive=true`) |
| GET | `/regions` | público | Filtros `stateId`, `type`, `parentId`, `status` (`active` por defecto, `all`), `search` |
| GET | `/regions/:id` | público | Detalle con estado y padre |
| POST | `/regions` | admin | Municipio (sin padre) o zona (con padre municipio del mismo estado) |
| PATCH | `/regions/:id` | admin | `name`, `slug`, `aliases`, `lat`, `lng`, `status` |
| PATCH | `/regions/:id/toggle-status` | admin | Activa/desactiva |

### 2.6 Paquetes (agencia)

| Método | Ruta | Acceso | Descripción |
|---|---|---|---|
| GET | `/packages` | público | Publicados de socios y regiones activos; `regionId`, `partnerId`, `search`; incluye `minPriceAdult` |
| GET | `/packages/mine` | socio o admin | Cualquier estado |
| GET | `/packages/:id` | público / dueño | Detalle con ítems, itinerario, salidas y promociones; el dueño ve borradores |
| POST | `/packages` | agencia | Crea en `draft` (admite `items`, `itinerary`, `promotions`) |
| PATCH | `/packages/:id` | agencia dueña o admin | Escalares; los arreglos **reemplazan** lo existente |
| PATCH | `/packages/:id/status` | agencia dueña o admin | `{ status }`; publicar exige ítem incluido, itinerario y salida abierta con cupo |
| POST | `/packages/:id/departures` | agencia dueña o admin | `{ departureDate, totalSeats, adultPrice, childPrice?, status? }` |
| PATCH | `/packages/:id/departures/:departureId` | agencia dueña o admin | `{ totalSeats?, adultPrice?, childPrice?, status? }` |

### 2.7 Hoteles

| Método | Ruta | Acceso | Descripción |
|---|---|---|---|
| GET | `/hotels/room-types` | público | `partnerId`, `regionId`, `guests` |
| GET | `/hotels/room-types/mine` | hotel o admin | Mis habitaciones |
| POST | `/hotels/room-types` | hotel | `{ name, maxAdults, maxChildren, totalUnits, basePrice, amenities }` |
| PATCH | `/hotels/room-types/:id` | hotel dueño o admin | Capacidad, precio, amenidades, estado |
| PUT | `/hotels/room-types/:id/inventory` | hotel dueño o admin | `{ from, to, units?, price?, isClosed? }` → crea/actualiza el rango |
| GET | `/hotels/room-types/:id/inventory` | hotel dueño o admin | `?from&to` |
| GET | `/hotels/availability` | público | `checkIn`, `checkOut`, `adults`, `children`, `regionId?`, `partnerId?` → tarifa por noche y total |

### 2.8 Experiencias (atractivo)

| Método | Ruta | Acceso | Descripción |
|---|---|---|---|
| GET | `/experiences` | público | `partnerId`, `regionId`, `search` |
| GET | `/experiences/availability` | público | `date`, `people`, `regionId?`, `partnerId?` → turnos con cupo |
| GET | `/experiences/mine` | operador o admin | Mis experiencias |
| GET | `/experiences/:id` | público / dueño | Detalle con próximos turnos |
| POST | `/experiences` | operador | `{ regionId, name, description, durationMinutes, minAge?, priceAdult, priceChild?, requirements? }` |
| PATCH | `/experiences/:id` | operador dueño o admin | Precios, duración, requisitos, región, estado |
| POST | `/experiences/:id/slots` | operador dueño o admin | `{ date, startTime, capacity }` |
| PATCH | `/experiences/:id/slots/:slotId` | operador dueño o admin | `{ capacity?, status? }` |

### 2.9 Servicio y cotización (máquina)

| Método | Ruta | Acceso | Descripción |
|---|---|---|---|
| POST | `/quotes` | servicio `quote:write` | Cotiza paquete/estancia/turno → desglose + `quoteId` con vencimiento (15 min) |
| GET | `/quotes/:id` | servicio `quote:write` | Cotización vigente; vencida → 410 `QUOTE_EXPIRED` |
| GET | `/service/whoami` | servicio `catalog:read` | Verifica credencial y scopes |

---

## 3. Matriz de permisos

| Área | Público | Usuario | Socio (`partner`) | Admin (`super_user`) | Servicio |
|---|---|---|---|---|---|
| Login / activación / refresh | ✅ | — | — | — | — |
| Catálogos (regiones, categorías) | lectura | — | — | escritura | — |
| Socios | solo `register` | — | ver/editar el propio | todo | — |
| Equipo del socio | — | — | owner | todo | — |
| Paquetes | lectura | — | su agencia | todo | — |
| Hoteles | lectura | — | su hotel | todo | — |
| Experiencias | lectura | — | su operador | todo | — |
| Cotizaciones | — | — | — | — | ✅ |

---

## 4. Flujos de negocio

### 4.1 Alta y activación de un socio

1. `POST /partners` (admin, `invite: false`) → socio `pending`, owner `invited`. *(O `POST /partners/register` público.)*
2. `PATCH /partners/:id/approve` → socio `active` y **correo con el enlace de activación**.
3. El responsable abre el enlace y `POST /auth/activate` con `{ token, password }`.
4. `POST /auth/login` → sesión con `role: "partner"`.
5. Opcional: `POST /partners/:id/resend-invite` si el correo se perdió.

> El token de activación es de un solo uso; reutilizarlo devuelve `400 ACTIVATION_TOKEN_USED`. Antes de activar, el login devuelve `401 INVALID_CREDENTIALS`.

### 4.2 Agencia: publicar un paquete

1. `POST /packages` → `draft`.
2. `PATCH /packages/:id` con `items` e `itinerary` (o directamente en el alta).
3. `POST /packages/:id/departures` → salida con cupo y precio.
4. `PATCH /packages/:id/status` → `published` (si falta algo: **422** con `errors.items`, `errors.itinerary` o `errors.departures`).
5. `GET /packages` (público) → aparece con `minPriceAdult`.
6. `PATCH /packages/:id/departures/:departureId` con `status: "closed"` → deja de ofrecerse.

### 4.3 Hotel: de la habitación a la disponibilidad

1. `POST /hotels/room-types` → tipo de habitación con capacidad y precio base.
2. `PUT /hotels/room-types/:id/inventory` → rango con `units`, `price` e `isClosed` (cierre rápido).
3. `GET /hotels/availability?checkIn=…&checkOut=…&adults=…` → opciones con tarifa por noche y total.
4. Una fecha cerrada o con `units: 0` desaparece de la disponibilidad.

> Si no hay fila de inventario para una fecha, se usa `totalUnits` y `basePrice`.

### 4.4 Atractivo: experiencias y turnos

1. `POST /experiences` → experiencia con duración y precios.
2. `POST /experiences/:id/slots` → turnos (fecha + hora + aforo).
3. `GET /experiences/availability?date=…&people=…` → turnos con `remaining = capacity - booked`.
4. `PATCH /experiences/:id/slots/:slotId` con `status: "closed"` → deja de ofrecerse.
5. El aforo no puede bajar de lo ya reservado (`CAPACITY_BELOW_BOOKED`).

### 4.5 Suspensión y reactivación

1. `PATCH /partners/:id/suspend` (admin, con motivo).
2. La siguiente petición del socio responde **403 `PARTNER_INACTIVE`** (no espera a que expire el token).
3. `PATCH /partners/:id/reactivate` → recupera el acceso.

### 4.6 Agente: cotización multi-servicio

1. `POST /auth/service-token` con `clientId` y `secret` → token con `quote:write`.
2. `POST /quotes` con los ítems:
   ```json
   { "items": [
     { "type": "package_departure", "departureId": "…", "adults": 2, "children": 0 },
     { "type": "room_stay", "roomTypeId": "…", "checkIn": "2026-12-10", "checkOut": "2026-12-12", "adults": 2, "children": 1 },
     { "type": "experience_slot", "slotId": "…", "adults": 2, "children": 0 }
   ] }
   ```
3. La respuesta trae `quoteId`, `reference` (`QT-…`), `expiresAt`, desglose por ítem y totales.
4. `GET /quotes/:id` devuelve lo mismo mientras esté vigente; después, **410 `QUOTE_EXPIRED`**.
5. El cliente **nunca envía precios**: el API los calcula y los congela en la cotización.

### 4.7 Recorridos automatizados

Los flujos 4.1–4.2 y 4.6 están cubiertos por pruebas ejecutables:

- [01-agencia-paquetes.md](../flujos/01-agencia-paquetes.md) — 18 pasos
- [03-agente-cotizacion.md](../flujos/03-agente-cotizacion.md) — 16 pasos

```bash
npm run test:flow
```

---

## 5. Pantallas sugeridas y endpoints

| Pantalla | Endpoints |
|---|---|
| Login | `POST /auth/login`, `POST /auth/refresh` |
| Activación de cuenta | `POST /auth/activate` |
| Cambio de contraseña forzado | `POST /auth/change-password`, `GET /auth/me` |
| Admin · socios | `GET /partners`, `POST /partners`, `GET/PATCH /partners/:id`, `.../approve|reject|suspend|reactivate|resend-invite` |
| Admin · catálogos | `/regions*`, `/partner-categories*` |
| Socio · equipo | `GET/POST /partners/:id/members`, `PATCH .../members/:memberId` |
| Agencia · paquetes | `/packages*` |
| Hotel · habitaciones | `/hotels/room-types*` |
| Atractivo · experiencias | `/experiences*` |
| Catálogo público | `GET /packages`, `GET /hotels/room-types`, `GET /experiences`, disponibilidades |
| Perfil | `GET /auth/me`, `PATCH /partners/:id` |

## 6. Lo que todavía no existe

Reservas y bloqueo de inventario (15 min), pagos y webhooks, notificaciones/WhatsApp, check-in y validación por QR, métricas del administrador, subida de imágenes y desglose fiscal por estado (IVA/ISH). No hay endpoints para esas piezas: si una pantalla las necesita, hay que planificarlas antes.

## 7. Mantenimiento

- El contrato vivo es `openapi.json`; si este documento y el JSON difieren, manda el JSON.
- Cada operación se documenta junto a su ruta en `src/features/*/routes/*.ts`.
- Al agregar un endpoint, actualizar la tabla de su área y, si cambia un flujo, el flujo correspondiente.

---

## 8. Datos de demostración

El seeder `demo-providers` (solo fuera de producción) crea dos proveedores activos, listos para probar el frontend:

| Proveedor | Credenciales | Qué tiene |
|---|---|---|
| **Hotel Demo Playa** | `hotel.demo@plataforma.com` / `Hotel1234!` | 2 tipos de habitación (*Doble estándar* 1500, *Suite familiar* 2400) con imágenes, inventario para los próximos 60 días y logo |
| **Atractivos Demo** | `atractivo.demo@plataforma.com` / `Atractivo1234!` | Experiencia *Ruta del Cacao* (180 min, 850 adulto / 450 menor) con imágenes y turnos a las 09:00 y 13:00 durante 14 días |
| **Agencia (fixture)** | `agencia.test@plataforma.com` / `Test1234!` | Paquete publicado *Escapada Caribeña y Ruta de Cenotes* con salidas y una promoción |

Se cargan con `npm run seed` (o al recrear la base de test). Son de desarrollo: en producción el seeder se salta solo.

### Campos agregados en esta iteración

| Dónde | Campos nuevos |
|---|---|
| `POST /auth/login` y `GET /auth/me` → `user.partner` | `categoryId`, `categoryCode`, `logoUrl` (además de `id`, `commercialName`, `role`; `/auth/me` suma `slug`) |
| `GET /partners` y `GET /partners/:id` | `categoryName`, `regionName`, `logoUrl` |
| `PATCH /partners/:id` | acepta `logoUrl` (URL o `null`) |
| Paquetes (`/packages*`) | `images: string[]` en alta, edición y respuesta |
| Habitaciones (`/hotels/room-types*`) | `images: string[]` |
| Experiencias (`/experiences*`) | `images: string[]` |

Las imágenes son **URLs** (máx. 20 por recurso): el frontend las sirve desde su propio CDN. La subida de archivos sigue pendiente.

### Sesión en desarrollo

Con `ACCESS_TOKEN_TTL=15m` en `.env` (recomendado) el access token dura 15 minutos y el interceptor de refresh se ejercita de verdad. Si no se define, hereda `JWT_EXPIRES_IN`. Con `MAIL_TRANSPORT=fake`, la API no abre SMTP e imprime en consola el enlace de activación de cada correo simulado.
