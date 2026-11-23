# Guía de Pruebas — Plataforma y Bot Turístico

Esta guía describe el procedimiento paso a paso para validar el funcionamiento del sistema, comenzando por el Happy Path (flujo ideal exitoso de punta a punta) y continuando con flujos alternativos.

---

## 1. Prerrequisitos

Antes de iniciar las pruebas, verifica que los servicios estén activos y con datos inicializados:

1. **Servicios corriendo**:
   ```bash
   docker-compose up -d
   ```
   O en desarrollo local: API en puerto 3000 y Bot en puerto 8000.

2. **Datos de prueba cargados (Seeders)**:
   ```bash
   # Dentro del contenedor API:
   docker-compose exec api npm run seed

   # O en local:
   cd api && npm run seed
   ```

3. **Destinos cargados en el catálogo**:
   - **Quintana Roo**: Cancún / Benito Juárez (Temptation Cancun Resort), Playa del Carmen / Solidaridad (Hotel Playa Azul, Hotel Coral Maya)
   - **Yucatán**: Mérida (Hacienda Mérida Centro), Valladolid (Posada Valladolid)
   - **Chiapas**: Palenque

4. **Cuenta PayPal Sandbox para pruebas de pago**:
   - Usa una cuenta compradora personal creada desde el dashboard de [PayPal Developer](https://developer.paypal.com).

---

## 2. Happy Path 1: Búsqueda, Cotización y Pago de Paquete Turístico

Este es el flujo principal donde el viajero descubre una opción, la aparta con bloqueo de 15 minutos, paga en PayPal y recibe su comprobante con código QR.

### Paso 1: Inicio de conversación
- **Acción del usuario**: Abre el chat con el bot en Telegram y envía:
  ```text
  /start
  ```
- **Respuesta esperada del bot**:
  - Mensaje de bienvenida cálido.
  - Botones interactivos: `[Paquetes turísticos]`, `[Hoteles y Hospedaje]`, `[Tours y Experiencias]`, `[Ver mi selección]`, `[Consultar mi reserva]`.

### Paso 2: Búsqueda conversacional
- **Acción del usuario**: Envía un mensaje en lenguaje natural:
  ```text
  Quiero un paquete para Yucatán
  ```
- **Respuesta esperada del bot**:
  - Reconoce el destino (Yucatán) y pregunta de forma natural para cuántas personas y en qué fecha aproximada, ofreciendo botones rápidos de viajeros `[1 adulto]`, `[2 adultos]`, etc.

- **Acción del usuario**:
  ```text
  Para 2 adultos
  ```
  *(O pulsa el botón `[2 adultos]`)*.

- **Respuesta esperada del bot**:
  - Pregunta la fecha deseada.

- **Acción del usuario**: Envía una fecha futura con salida disponible (por ejemplo, a 15 o 30 días, o usa el formato directo si lo prefieres):
  ```text
  15 de diciembre del 2026
  ```

### Paso 3: Presentación de opciones y selección
- **Respuesta esperada del bot**:
  - Muestra las opciones encontradas con nombre del paquete, proveedor, fecha y cupo.
  - Cada opción incluye un botón interactivo para agregarla a la selección.
- **Acción del usuario**: Pulsa el botón de la opción deseada (ej. `Ruta Maya Yucatán`).

### Paso 4: Cotización formal
- **Respuesta esperada del bot**:
  - Muestra el resumen de "Tu selección actual" con el ítem agregado.
  - Botones: `[Cotizar ahora]`, `[Agregar otro servicio]`, `[Vaciar selección]`.
- **Acción del usuario**: Pulsa `[Cotizar ahora]`.
- **Respuesta esperada del bot**:
  - Desglose con clave de cotización (`QT-XXXXXX`), desglose por persona, total en MXN y fecha/hora de vencimiento UTC.
  - Botón: `[Confirmar y continuar al pago]`.

### Paso 5: Captura de datos del viajero y apartado
- **Acción del usuario**: Pulsa `[Confirmar y continuar al pago]`.
- **Respuesta esperada del bot**:
  - Solicita el nombre completo para el comprobante oficial.
- **Acción del usuario**:
  ```text
  Juan Pérez García
  ```
- **Respuesta esperada del bot**:
  - Agradece por nombre y solicita el correo electrónico.
- **Acción del usuario**:
  ```text
  juan.perez@ejemplo.com
  ```

### Paso 6: Generación de clave única maestra y enlace PayPal
- **Respuesta esperada del bot**:
  - Mensaje formal: *"Tu lugar está apartado por $X MXN bajo la clave de reserva TRV-XXXXXX. Tienes 15 minutos para completar el pago antes de que se libere el cupo."*
  - Botón URL directo: `[Pagar con PayPal]`.
  - Botón: `[Ver estado de mi reserva]`.

### Paso 7: Pago en pasarela (PayPal Sandbox)
- **Acción del usuario**:
  - Hace clic en `[Pagar con PayPal]`.
  - Se abre el navegador en el entorno seguro de PayPal Sandbox.
  - Inicia sesión con la cuenta compradora de prueba y completa la autorización del cobro.
  - PayPal redirige a la página de retorno: *"Vuelve a Telegram para consultar el estado de tu reserva"*.

### Paso 8: Confirmación automática y entrega de QR
- **Respuesta esperada del bot** (en segundo plano vía worker/webhook, máximo 30 segundos):
  - Mensaje de confirmación:
    - *"Tu pago fue confirmado. Clave única de reserva: TRV-XXXXXX"*
    - Paquete, fechas, número de viajeros y total pagado.
  - **Imagen de código QR oficial**: Se envía automáticamente en el chat con la leyenda: *"Muestra este QR al proveedor al iniciar el servicio"*.
  - Correo electrónico: La API envía automáticamente la notificación al proveedor del servicio.

### Paso 9: Verificación posterior de reserva
- **Acción del usuario**: En cualquier momento posterior, envía:
  ```text
  /reserva
  ```
- **Respuesta esperada del bot**:
  - Estado: `confirmed`.
  - Clave maestra `TRV-XXXXXX`, desglose completo y datos del viaje.

---

## 3. Happy Path 2: Búsqueda y Reserva Fluida de Hotel

Prueba la capacidad del bot para capturar múltiples datos en un solo mensaje sin pasar por un cuestionario rígido.

### Paso 1: Búsqueda en un solo mensaje
- **Acción del usuario**:
  ```text
  Busco hotel en Cancún del 1 al 10 de diciembre para 2 personas
  ```
  *(O también: `Busco hotel en Mérida del 1 al 10 de diciembre para 2 personas` o `Busco hotel Temptation del 1 al 5 de diciembre`)*.
- **Comportamiento esperado**:
  - El bot detecta simultáneamente:
    - Tipo: Hotel
    - Destino: Cancún (Quintana Roo)
    - Check-in: 2026-12-01
    - Check-out: 2026-12-10
    - Viajeros: 2 adultos
  - **No hace preguntas intermedias**; consulta la disponibilidad y despliega directamente las opciones de habitaciones (ej. *Trendy Garden View · Temptation Cancun Resort*, *Bash Tower Suite · Temptation Cancun Resort* o las habitaciones de Mérida si se eligió Mérida).

### Paso 2: Selección y Cotización
- **Acción del usuario**: Selecciona la habitación y pulsa `[Cotizar ahora]`.
- **Respuesta esperada**: Cotización con noches calculadas (9 noches), precio por noche, total y botón para continuar.

### Paso 3: Pago y Venta Cruzada (Cross-selling)
- **Acción del usuario**: Confirma y completa el pago en PayPal.
- **Respuesta esperada del bot**:
  - Entrega de clave maestra y QR de la habitación.
  - **Sugerencia proactiva de venta cruzada**:
    *"Tip: Si deseas tours o actividades para tus fechas, puedes pulsar 'Buscar experiencias'."*
    Botón: `[Buscar experiencias]`.

---

## 4. Happy Path 3: Búsqueda y Reserva de Experiencia / Tour

### Paso 1: Consulta de actividad
- **Acción del usuario**:
  ```text
  Qué experiencias tienen en Valladolid para mañana
  ```
- **Respuesta esperada**:
  - Lista de actividades activas con horario de turno (ej. *Cenotes y Zací · 09:00*).

### Paso 2: Cotización y apartado
- **Acción del usuario**: Selecciona el turno y procede a cotizar.
- **Respuesta esperada**:
  - Cotización por persona con cupo bloqueado por 15 minutos bajo clave `TRV-XXXXXX`.
  - Al confirmarse el cobro, el cupo del turno (`booked` en `experience_slots`) se incrementa definitivamente.

---

## 5. Verificación en Base de Datos y Panel Administrativo

Para auditar que el sistema ejecutó todas las operaciones correctamente:

### Verificación en MySQL
Ejecuta en la base de datos `turista`:

```sql
-- 1. Verificar la reserva creada con su clave maestra
SELECT id, reference, item_type, item_id, seats, total, status, traveler_ref, expires_at
FROM bookings
ORDER BY created_at DESC
LIMIT 5;

-- 2. Verificar que el comprobante guarda los detalles del ítem
SELECT reference, item_type, item_detail
FROM bookings
ORDER BY created_at DESC
LIMIT 1;

-- 3. Verificar que los cupos vendidos se actualizaron
-- Para paquetes:
SELECT id, departure_date, total_seats, sold_seats
FROM package_departures
WHERE sold_seats > 0;

-- Para experiencias:
SELECT id, date, start_time, capacity, booked
FROM experience_slots
WHERE booked > 0;
```

### Verificación en el Portal del Socio
1. Ingresa a `http://localhost:5173/login`.
2. Inicia sesión con la cuenta del socio correspondiente (ej. `yucatan-experience@turismo.test` / `Turismo123!`).
3. Comprueba que el cupo disponible de la salida o habitación refleje la reducción tras la reserva confirmada.

---

## 6. Pruebas de Casos Borde y Manejo de Errores

| Caso de prueba | Entrada del usuario | Comportamiento esperado |
|---|---|---|
| **Fechas en el pasado** | `Hotel en Cancún del 1 al 5 de enero del 2020` | El bot advierte: *"Elige una fecha de hoy en adelante"*. |
| **Estancia mayor a 30 noches** | `Hotel del 1 de diciembre al 15 de enero` | El bot advierte: *"Elige una estancia de 1 a 30 noches"*. |
| **Destino inexistente** | `Busco hotel en Marte` | El bot indica que no encontró opciones y sugiere verificar el municipio o estado. |
| **Vencimiento de los 15 min sin pagar** | Generar enlace y no pagar | La reserva pasa a `expired`, la salida libera los asientos y el bot informa al consultar: *"El apartado venció. Vuelve a cotizar"*. |
| **Reserva duplicada en proceso** | Pulsar dos veces el botón de checkout | El bot reconoce la reserva existente y no duplica órdenes en PayPal (idempotencia). |
