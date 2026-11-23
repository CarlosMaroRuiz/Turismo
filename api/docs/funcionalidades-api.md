# Funcionalidades de la API

Documento funcional de la API turística ubicada en `api/`. Describe qué puede hacer el sistema, quién puede hacerlo y cuáles son las reglas de negocio que aplica.

## 1. Propósito

La API es el sistema central de operación y consulta de una plataforma turística. Su responsabilidad es:

- Gestionar usuarios y permisos.
- Registrar y validar hoteles, agencias de viajes y operadores de atractivos.
- Mantener el catálogo geográfico.
- Publicar paquetes turísticos.
- Administrar habitaciones, inventario por fecha y disponibilidad.
- Administrar experiencias y turnos.
- Calcular cotizaciones combinadas sin que el cliente envíe ni manipule precios.
- Exponer documentación OpenAPI del contrato.

El viajero no tiene cuenta en esta versión. El usuario final es atendido por un canal externo, como un agente o WhatsApp, mientras los proveedores trabajan desde el panel web.

## 2. Información general

| Elemento | Valor |
|---|---|
| Prefijo base | `/api/v1` |
| Formato | JSON |
| Base de datos | MySQL |
| Autenticación web | JWT de usuario mediante `Authorization: Bearer <accessToken>` |
| Integraciones máquina a máquina | JWT de servicio con scopes |
| Cotización | MXN |
| Estado público de salud | `GET /health` |
| Contrato OpenAPI | `GET /api/v1/openapi.json` |

Las respuestas normales tienen esta forma:

```json
{
  "ok": true,
  "message": "Operación exitosa",
  "data": {}
}
```

Las respuestas con paginación incluyen `meta` con información como `page`, `limit`, `total` y `totalPages`.

Las respuestas de error incluyen un código estable:

```json
{
  "ok": false,
  "code": "CODIGO_DE_ERROR",
  "message": "Descripción del problema"
}
```

El API usa códigos HTTP convencionales, por ejemplo `400` para datos o reglas inválidas, `401` cuando falta o venció la autenticación, `403` para permisos insuficientes, `404` para recursos inexistentes y `429` para límites de solicitudes.

## 3. Arquitectura funcional

La API separa el sistema en módulos:

| Módulo | Función |
|---|---|
| Autenticación | Login, activación, renovación de sesión, cambio de contraseña y perfiles |
| Socios | Solicitudes, aprobación, rechazo, suspensión y equipos |
| Regiones | Estados, municipios y zonas turísticas |
| Categorías de socio | Tipos hotel, agencia y atractivo |
| Paquetes | Oferta de agencias, salidas, cupos, promociones e itinerarios |
| Hoteles | Tipos de habitación e inventario por fecha |
| Experiencias | Tours o atractivos y turnos con aforo |
| Cotizaciones | Precio combinado de paquetes, hoteles y experiencias |
| Servicio | Identificación de integraciones máquina a máquina |

Los servicios aplican las reglas de negocio y realizan las consultas a MySQL mediante TypeORM. Las rutas definen autenticación, roles y scopes antes de entregar la petición al controlador correspondiente.

## 4. Autenticación y autorización

### 4.1 Usuarios del panel

Existen dos roles globales:

- `super_user`: administra el catálogo, socios, regiones y puede supervisar recursos.
- `partner`: representa al personal de un hotel, agencia o operador de atractivos.

Un usuario de tipo `partner` además puede tener un puesto dentro del socio:

- `owner`: propietario responsable del socio y de su equipo.
- `staff`: miembro con acceso limitado según las operaciones disponibles.

### 4.2 Sesiones

El proceso de login valida:

- Que el usuario exista.
- Que tenga contraseña.
- Que su cuenta esté activa.
- Que la contraseña sea correcta.
- Que el vínculo con el socio siga activo.
- Que el socio esté activo.

El login devuelve:

- Access token JWT.
- Refresh token.
- Información del usuario.
- Información del socio asociado, si existe.
- Indicador `mustChangePassword`.

Los refresh tokens se guardan como hash en la base de datos y se rotan al usarse. El logout revoca el refresh token indicado. El cambio de contraseña revoca las demás sesiones e incrementa la versión del token del usuario, invalidando los access tokens existentes.

Las cuentas invitados deben activar su enlace recibido por correo antes de iniciar sesión.

### 4.3 Endpoints de autenticación

| Método | Ruta | Funcionalidad |
|---|---|---|
| `POST` | `/auth/login` | Inicio de sesión |
| `POST` | `/auth/activate` | Activación de cuenta con token y contraseña |
| `POST` | `/auth/refresh` | Rotación del refresh token |
| `POST` | `/auth/logout` | Revocación de una sesión |
| `POST` | `/auth/service-token` | Emisión de token para integración |
| `POST` | `/auth/change-password` | Cambio obligatorio o voluntario de contraseña |
| `GET` | `/auth/me` | Perfil del usuario autenticado |

Las rutas de login, activación, refresh y logout tienen límites especiales contra fuerza bruta.

### 4.4 Credenciales de servicio

Las integraciones no son usuarios. Utilizan un `clientId` y un secreto almacenado como hash. Tras validar las credenciales reciben un access token JWT sin refresh.

Scopes disponibles:

- `catalog:read`: consultar la identidad y permisos de la integración.
- `quote:write`: crear y consultar cotizaciones.

Las rutas de cotización exigen una credencial de servicio, no un token de usuario.

## 5. Catálogo geográfico

### Estados

Los estados tienen clave, nombre, slug y aliases. Solo se consideran activos los estados con oferta disponible.

`GET /regions/states` permite consultar estados activos para formularios y filtros.

### Regiones

Una región puede ser:

- `municipality`: municipio sin zona padre.
- `zone`: zona turística vinculada a un municipio.

Funciones disponibles:

| Función | Acceso |
|---|---|
| Consultar estados | Público |
| Listar regiones con filtros | Público |
| Obtener detalle de región | Público |
| Crear municipio o zona | Administrador |
| Editar región | Administrador |
| Activar o desactivar región | Administrador |

Los municipios se identifican por estado y los filtros permiten buscar por estado, tipo, padre, estado operativo y texto.

Reglas:

- Una zona debe tener municipio padre.
- El estado de la zona debe coincidir con el estado del municipio padre.
- El catálogo público puede ocultar regiones inactivas.

## 6. Categorías de socios

Las categorías existentes son:

- `hotel`
- `agency`
- `attraction`

La API permite:

- Consultar categorías activas.
- Consultar una categoría.
- Crear categorías.
- Editar categorías.
- Activar o desactivar una categoría.
- Dar de baja lógica una categoría.

Crear, editar, activar y eliminar requiere rol `super_user`.

La baja física no se utiliza: se desactiva `isActive`.

## 7. Socios

Un socio representa una empresa que ofrece servicios turísticos.

Estados:

- `pending`: solicitud recibida pero aún no aprobada.
- `active`: puede operar y aparecer en catálogos públicos.
- `suspended`: operación temporalmente bloqueada.
- `rejected`: solicitud no aprobada.

### 7.1 Registro público

`POST /partners/register` recibe los datos de la empresa y del responsable.

La API:

- Valida categoría y región activas.
- Evita correos ya registrados.
- Crea el socio en `pending`.
- Crea al responsable con estado `invited`.
- Vincula al responsable con el socio como `owner`.
- Genera el slug a partir del nombre comercial.

### 7.2 Alta administrativa

`POST /partners` permite al `super_user` crear directamente un socio.

Si `invite=true`, la API aprueba al socio y envía la invitación de activación automáticamente.

### 7.3 Ciclo de aprobación

| Acción | Transición |
|---|---|
| Aprobar | `pending → active` |
| Rechazar | `pending → rejected` |
| Suspender | `active → suspended` |
| Reactivar | `suspended → active` |

Rechazar o suspender exige un motivo.

Al aprobar se genera un token de activación válido por 48 horas. Solo se guarda en la base su hash SHA-256; el valor en claro se envía por correo.

Si el correo falla, el socio y su usuario pueden seguir existiendo y el administrador puede reenviar la invitación.

### 7.4 Administración de equipos

Los administradores y los propietarios pueden:

- Consultar los miembros del socio.
- Agregar nuevos miembros.
- Cambiar entre `owner` y `staff`.
- Activar o desactivar miembros.

Reglas:

- Un socio debe conservar al menos un `owner` activo.
- Un miembro invitado recibe un enlace de activación.
- El correo de cada usuario debe ser único.
- Un vínculo desactivado no puede operar.

## 8. Paquetes turísticos

Los paquetes pertenecen a agencias de viajes. Cada paquete contiene información general, servicios incluidos, itinerario, promociones y fechas de salida.

### 8.1 Información del paquete

Un paquete define:

- Nombre, resumen y descripción.
- Región destino.
- Número de noches.
- Mínimo y máximo de viajeros.
- Edades aplicables a menores.
- Punto de encuentro.
- Requisitos.
- Política de cancelación.
- Si los impuestos están incluidos.

### 8.2 Estados

| Estado | Significado |
|---|---|
| `draft` | En preparación |
| `published` | Visible en el catálogo público |
| `paused` | Pausado temporalmente |

Solo se publican paquetes cuyo socio esté activo y cuya región esté activa.

### 8.3 Contenido detallado

- **Ítems:** alojamiento, transporte, comidas, actividades u otros servicios. Cada uno puede estar incluido o excluido.
- **Itinerario:** lista ordenada de días con título y descripción.
- **Salidas:** fecha, cupo total, cupo vendido, precio adulto, precio menor y estado.
- **Promociones:** porcentaje o importe fijo, vigencia, mínimo de viajeros y días de semana aplicables.

### 8.4 Endpoints

| Método | Ruta | Funcionalidad |
|---|---|---|
| `GET` | `/packages` | Catálogo público |
| `GET` | `/packages/mine` | Paquetes del socio autenticado |
| `GET` | `/packages/:id` | Detalle público o privado según permisos |
| `POST` | `/packages` | Crear borrador |
| `PATCH` | `/packages/:id` | Reemplazar o modificar datos e hijos |
| `PATCH` | `/packages/:id/status` | Cambiar estado |
| `POST` | `/packages/:id/departures` | Agregar salida |
| `PATCH` | `/packages/:id/departures/:departureId` | Modificar cupo, precio o estado |

Solo agencias activas pueden crear y modificar paquetes. El administrador puede supervisarlos.

### 8.5 Reglas de publicación

Para pasar a `published`, el paquete debe tener:

- Al menos un ítem marcado como incluido.
- Al menos un día de itinerario.
- Al menos una salida abierta.
- Salida con cupo disponible y precio adulto mayor que cero.
- Región activa.
- Agencia activa.

Al actualizar ítems, itinerario o promociones, el API reemplaza el conjunto completo enviado.

Las promociones vigentes se aplican al cotizar. Si hay varias válidas, se calcula la de mayor beneficio.

## 9. Hoteles

### 9.1 Tipos de habitación

Un hotel define tipos como habitación doble, suite o familiar.

Cada tipo incluye:

- Capacidad de adultos y menores.
- Número total de unidades.
- Precio base.
- Amenidades.
- Estado activo o inactivo.

Solo socios de categoría `hotel` pueden crear tipos de habitación.

### 9.2 Inventario

El hotel puede cargar o actualizar un rango de fechas indicando para cada día:

- Unidades disponibles.
- Precio.
- Si está cerrado.

Si no existe una fila específica para una fecha, se usan `totalUnits` y `basePrice` del tipo de habitación.

### 9.3 Endpoints

| Método | Ruta | Funcionalidad |
|---|---|---|
| `GET` | `/hotels/room-types` | Catálogo público de habitaciones |
| `GET` | `/hotels/room-types/mine` | Habitaciones del hotel autenticado |
| `POST` | `/hotels/room-types` | Crear tipo de habitación |
| `PATCH` | `/hotels/room-types/:id` | Actualizar habitación |
| `PUT` | `/hotels/room-types/:id/inventory` | Cargar o actualizar inventario de un rango |
| `GET` | `/hotels/room-types/:id/inventory` | Consultar inventario |
| `GET` | `/hotels/availability` | Buscar disponibilidad por fechas y huéspedes |

### 9.4 Disponibilidad

La búsqueda verifica cada noche solicitada:

- Hotel activo.
- Habitación activa.
- Región activa.
- Capacidad suficiente.
- No estar cerrado.
- Tener al menos una unidad.
- Tarifa correspondiente a cada noche.

Devuelve el desglose diario y el total de la estancia.

La estancia se limita a 30 noches y el rango de carga de inventario a 370 días.

## 10. Experiencias y atractivos

Un operador de atractivos puede publicar experiencias como tours, museos, cenotes, parques o actividades.

Una experiencia define:

- Región.
- Nombre y descripción.
- Duración.
- Edad mínima.
- Precio adulto y menor.
- Requisitos.
- Estado activo.

Los turnos tienen fecha, hora de inicio, aforo y lugares ya ocupados.

### Endpoints

| Método | Ruta | Funcionalidad |
|---|---|---|
| `GET` | `/experiences` | Catálogo público |
| `GET` | `/experiences/availability` | Consultar turnos disponibles |
| `GET` | `/experiences/mine` | Experiencias del operador autenticado |
| `GET` | `/experiences/:id` | Detalle y próximos turnos |
| `POST` | `/experiences` | Crear experiencia |
| `PATCH` | `/experiences/:id` | Actualizar experiencia |
| `POST` | `/experiences/:id/slots` | Crear turno |
| `PATCH` | `/experiences/:id/slots/:slotId` | Actualizar aforo o cerrar turno |

Solo operadores de categoría `attraction` pueden gestionar experiencias.

Reglas:

- No se crean turnos en fechas pasadas.
- Dos turnos no pueden repetir experiencia, fecha y hora.
- El aforo no puede quedar por debajo de los lugares reservados.
- La disponibilidad pública considera cupo restante y estado abierto.

## 11. Cotizaciones

Las cotizaciones son creadas exclusivamente por integraciones mediante `POST /quotes`, usando el scope `quote:write`.

Una cotización puede incluir hasta diez servicios entre:

- Una salida de paquete turístico.
- Una estancia de habitación.
- Un turno de experiencia.

Cada servicio contiene IDs y cantidades. El cliente no debe enviar ni controlar el precio.

### 11.1 Cálculo de paquete

Para una salida de paquete se recalcula:

- Cupo disponible.
- Estado abierto de la salida.
- Paquete publicado.
- Agencia activa.
- Precio adulto y menor.
- Promoción vigente.
- Impuestos, si el paquete no incluye impuestos.

El descuento máximo puede provenir de una promoción porcentual o fija. Solo se aplica si la promoción está vigente y cumple límites de viajeros y días de semana.

### 11.2 Cálculo de hotel

Para una estancia se recalcula:

- Tipo de habitación activo.
- Hotel activo.
- Rango de fechas válido.
- Capacidad adulta y menor.
- Disponibilidad y cierre por noche.
- Precio específico de inventario o precio base por noche.

### 11.3 Cálculo de experiencia

Para un turno se recalcula:

- Turno abierto.
- Experiencia activa.
- Operador activo.
- Aforo restante.
- Precio adulto y menor.

### 11.4 Resultado

Una cotización contiene:

- Referencia corta, por ejemplo `QT-8F3A21`.
- Moneda `MXN`.
- Subtotal.
- Descuento total.
- Impuestos totales.
- Total.
- Desglose por línea.
- Fecha de creación.
- Fecha de vencimiento.

La vigencia predeterminada es 15 minutos y puede configurarse mediante `QUOTE_TTL_MINUTES`.

`GET /quotes/:id` devuelve la cotización mientras siga vigente. Después vence devuelve `410 QUOTE_EXPIRED`.

### 11.5 Limitación actual

La cotización solo fija y devuelve un precio. No reserva cupos ni bloquea inventario. No crea reservas ni pagos. No realiza una reserva temporal de 15 minutos.

## 12. Estado y contrato técnico

### Health check

`GET /health` no requiere autenticación y devuelve estado del servicio, entorno y marca de tiempo.

### OpenAPI

`GET /api/v1/openapi.json` devuelve el contrato generado por el registro de rutas. Está pensado para el frontend y servicios externos que necesiten conocer los endpoints disponibles.

## 13. Validación, seguridad y operación

### Seguridad HTTP

La API aplica:

- Cabeceras Helmet.
- CORS limitado por configuración.
- Límites de tamaño para JSON y formularios.
- CORS configurable por orígenes permitidos.
- Cabeceras que exponen el request ID y límites de tasa.
- Tokens JWT firmados.
- Contraseñas con bcrypt.
- Hash SHA-256 para refresh tokens y tokens de activación.
- Baja lógica en lugar de borrado físico para catálogos y socios.

### Rate limiting

Hay tres niveles:

- Global por IP.
- Estricto para autenticación.
- Especial para registro público de socios.

El almacenamiento predeterminado está en memoria de una instancia. Para varias réplicas se debe usar un almacén compartido.

### Respuestas de validación

Zod valida los cuerpos de entrada y los parámetros relevantes antes de ejecutar los servicios.

Si faltan datos o hay más de una regla inválida, la respuesta puede incluir un objeto `errors` con los campos afectados.

### Base de datos

TypeORM usa `synchronize: false`. Los cambios de entidades deben controlar:

- Generación de migraciones.
- Ejecución de migraciones.
- Ejecución de seeders.
- Registro de todas las entidades en `AppDataSource`.

Las migraciones y seeders pueden reconstruir el entorno mediante `npm run db:setup`.

## 14. Funcionalidades pendientes

La implementación actual todavía no incluye:

- Reservas y viajeros con `whatsapp_id`.
- Bloqueos temporales de inventario.
- Pagos.
- Conversaciones y mensajes del agente.
- Notificaciones programadas.
- Historial de auditoría completo.
- Documentos y cuentas bancarias de socios.
- Etiquetas de servicios y relaciones asociadas.
- Desglose fiscal por estado, como IVA o ISH.
- Reserva real después de emitir una cotización.

## 15. Regla central del producto

El API debe ser la fuente única de verdad:

- La IA no calcula precios.
- La IA no modifica disponibilidad.
- Los clientes no deben enviar precios finales.
- Los catálogos públicos solo muestran socios y regiones activos.
- Los servicios verifican cupos y precios al momento de cotizar.
- Las cotizaciones vencen y no reservan por sí mismas.
