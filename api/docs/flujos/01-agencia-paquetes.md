# Flujo 01 — De cero a paquete publicado

**Objetivo:** recorrer el camino completo de una agencia: el administrador la da de alta, el responsable activa su cuenta desde el correo, entra al panel y publica un paquete que aparece en el catálogo público.

**Prueba ejecutable:** [src/test/flow/agencia-paquetes.flow.test.ts](../../src/test/flow/agencia-paquetes.flow.test.ts)
**Comando:** `npm run test:flow`
**Alcance:** solo endpoints. La única lectura fuera de HTTP es el buzón falso de correo, porque el token de activación solo existe dentro del mensaje enviado.

**Precondiciones**

- Base `turista_test` recreada y sembrada (`node scripts/test-db.mjs`).
- Super usuario del seeder (`SUPER_USER_EMAIL` / `SUPER_USER_PASSWORD`) con `mustChangePassword = false` en el entorno de test.
- Agencia de respaldo sembrada (`agencia.test@plataforma.com`) usada como "agencia rival" en el paso 16.

---

## Recorrido paso a paso

| # | Petición | Resultado esperado |
|---|---|---|
| 1 | `GET /health` | `200` |
| 2 | `POST /auth/login` con las credenciales del seeder | `200` + `accessToken` / `refreshToken`, `role: "super_user"` |
| 3 | `GET /regions/states` · `GET /partner-categories?includeInactive=true` · `GET /regions?status=all&type=municipality&limit=1` | catálogos disponibles: estado activo, categoría `agency`, municipio |
| 4 | `POST /partners` (categoría `agency`, `invite:false`) | `201`, socio en `pending`, owner en `invited` |
| 5 | `POST /auth/login` con el owner **antes** de activar | `401 INVALID_CREDENTIALS` |
| 6 | `PATCH /partners/:id/approve` | `200` y **1 correo** en el buzón |
| 7 | `POST /auth/activate` con el token extraído del correo | `200` |
| 8 | `POST /auth/activate` repitiendo el mismo token | `400 ACTIVATION_TOKEN_USED` |
| 9 | `POST /auth/login` con el owner ya activado | `200`, `role: "partner"`, `partner.id` = la agencia creada, `partner.role: "owner"` |
| 10 | `GET /partners` con el token de la agencia | `403 ROLE_NOT_ALLOWED` |
| 11 | `POST /packages` (ítems + itinerario, sin salida) | `201`, estado `draft` |
| 12 | `PATCH /packages/:id/status` → `published` | `422 VALIDATION_ERROR` con `errors.departures` |
| 13 | `POST /packages/:id/departures` (fecha futura, 10 cupos, 4500) | `201`, `availableSeats: 10` |
| 14 | `PATCH /packages/:id/status` → `published` | `200`, `status: "published"`, `minPriceAdult: 4500` |
| 15 | `GET /packages?search=…` y `GET /packages/:id` | el paquete aparece en el catálogo con su salida e ítems |
| 16 | `PATCH /packages/:id` con el token de otra agencia | `403 PACKAGE_ACCESS_DENIED` |
| 17 | `PATCH /partners/:id/suspend` y luego `GET /partners/:id` con el token de la agencia | `200` al suspender y **`403 PARTNER_INACTIVE`** en la siguiente petición |
| 18 | `PATCH /partners/:id/reactivate` y `GET /packages/:id` | `200` y el paquete sigue publicado |

## Reglas que valida este flujo

- El alta por administrador crea **socio + usuario invitado + vínculo owner** en una transacción; el socio queda `pending`.
- La invitación **solo se envía al aprobar**, no al crear.
- El token de activación es **de un solo uso** y viaja únicamente en el correo (en base solo queda su hash).
- Un usuario `invited` **no puede iniciar sesión** hasta activar.
- El rol `partner` **no ve el listado global** de socios.
- **Publicar exige** al menos un ítem incluido, un día de itinerario y una salida abierta con cupo y precio.
- Cada agencia **solo gestiona sus paquetes**.
- Suspender un socio **corta el acceso en la siguiente petición** (no espera a que expire el token), y reactivar lo devuelve.

## Observaciones y huecos encontrados

1. **El 401 del paso 5 no distingue "cuenta sin activar" de "contraseña incorrecta".** Es correcto por seguridad (no filtra si el correo existe), pero el panel no puede mostrar "revisá tu correo para activar" sin una pista adicional. Si se quiere ese mensaje, hay que decidirlo de producto.
2. **No existe endpoint para crear super usuarios.** El flujo arranca con el administrador sembrado; el alta de administradores es una funcionalidad pendiente, no una prueba.
3. **El token de activación solo se puede obtener leyendo el correo.** Para automatizar sin buzón falso haría falta exponerlo de algún modo, lo que sería peor. La prueba usa el transporte falso (`MAIL_TRANSPORT=fake`), que no abre SMTP.
4. **El flujo no toca pagos ni bloqueo de inventario** porque esas piezas todavía no existen en el API.

## Cómo mantenerlo

- Cada `it()` es un paso; si falla, el nombre indica exactamente dónde se rompió el recorrido.
- Los datos usan el sufijo `RUN` (marca de tiempo) para no chocar entre corridas y no requerir limpieza.
- Si se agrega un paso al recorrido real, se agrega acá **y** se actualiza esta tabla.
