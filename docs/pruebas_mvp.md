# Guion de demostración del MVP

Para presentar la plataforma y el bot en unos **15 minutos**, en el orden que
mejor luce y con lo que está realmente funcionando hoy.

---

## 0. Antes de la demo (10 minutos antes)

**1. Docker arriba y servicios sanos**

```powershell
docker compose ps
```

Debe verse `api (healthy)`, `mysql (healthy)`, `frontend`, `bot` y `tunnel` en
`Up`.

**2. URL pública vigente y webhook**

```powershell
scripts\public-url.cmd -Telegram
```

Ese comando lee la URL del túnel, la guarda en `.env`, reinicia la API y vuelve
a registrar el webhook de Telegram. **La URL cambia cada vez que se reinicia el
túnel**, así que este paso no se salta.

La URL aparece al final del comando. Compruébala:

```powershell
$url = (Select-String -Path .env -Pattern PUBLIC_URL).Line -replace 'PUBLIC_URL=',''
curl.exe -s -o NUL -w "%{http_code}\n" "$url/api/v1/openapi.json"
curl.exe -s "$url/bot/health"
```

Esperado: `200` y `{"ok":true}`.

**3. Pestañas abiertas antes de entrar**

1. `http://localhost:8080` (la app)
2. El panel de administración
3. Telegram, con el chat del bot abierto
4. Una terminal, para mostrar logs si hace falta

**4. Cuentas**

| Rol | Correo | Contraseña |
|---|---|---|
| Administrador | `admin@gmail.com` | la que cambiaste al entrar la primera vez |
| Hotel | `playa-azul@turismo.test` | `Turismo123!` |
| Agencia | `riviera-tours@turismo.test` | `Turismo123!` |

Si no recuerdas la del administrador, al final de esta guía está el
procedimiento para dejarla en una conocida.

**Datos que hay cargados:** 17 hoteles y 10 agencias, 41 habitaciones con
inventario y 11 paquetes publicados en 10 destinos (Cancún, Playa del Carmen,
Tulum, Cozumel, Isla Mujeres, Bacalar, Mérida, Valladolid, Izamal y Progreso).
El hotel de la demo, Playa Azul, tiene 8 tipos de habitación: desde $1,200
hasta el penthouse de $11,500.

---

## 1. Apertura (1 minuto)

Abre `http://localhost:8080`.

> "Es una plataforma multi-socio: cada hotel, agencia u operador carga su
> propio catálogo, y la plataforma supervisa todo. El viajero llega por el bot
> de Telegram."

Muestra el login y los dos accesos:

- **Acceso para socios** (hoteles, agencias, atractivos)
- **Acceso administrador** (equipo interno)

No entres todavía; primero muestra el panel.

---

## 2. Panel de administración (3 minutos)

Entra como administrador.

**a. Socios**

- La lista con avatar, categoría, estado y el dot de color.
- Filtra por **Activos** y busca "tulum": se filtran en la URL, sin recargar la
  página.
- Cambia de página si hay más de 20.

> "El administrador no crea catálogo: valida socios, supervisa regiones y
> aprueba o suspende."

**b. Detalle de un socio**

Entra a **Hotel Playa Azul**.

- Datos del negocio, ubicación y contacto.
- **Equipo**: el responsable con rol Propietario y estado Activo.
- Muestra los botones de estado: suspender, rechazar con motivo (10 a 255
  caracteres).

Si hay un miembro en **Sin activar**, señala el botón **Reenviar invitación**:

> "El socio no arranca hasta activar su cuenta; desde aquí se reenvía el
> correo sin borrar y recrear la cuenta."

Si la demo es en vivo, evita mostrar el correo: Gmail suele mandar a Spam las
invitaciones con enlace de túnel. Ten a mano la captura
`api/docs/correos/activacion.png` por si preguntan cómo se ve.

**c. Categorías y regiones**

- `/admin/categorias` → **Agregar categoría**: el modal pide código y nombre;
  el código define las capacidades del portal.
- `/admin/regiones` → **Agregar región**: municipio (sin padre) o zona (con
  municipio padre). El slug es opcional y se genera del nombre.

> "Esto es lo que permite abrir la plataforma a nuevos destinos sin tocar
> código."

---

## 3. Portal del socio — hotel (3 minutos)

Cierra sesión y entra como `playa-azul@turismo.test`. Al entrar cae directo en **Habitaciones**, que es la primera pantalla del portal para un hotel.

**a. La navegación cambia según la categoría**

> "Un hotel ve Habitaciones. Una agencia ve Paquetes. Un atractivo vería
> Experiencias. No es un menú fijo: se arma con la categoría del socio."

**b. Habitaciones**

- Tarjetas con foto, capacidad, unidades, precio y estado.
- Abre **Inventario** en "Doble vista mar":
  - El modal grande tiene el formulario a la izquierda y el **calendario** a la
    derecha.
  - Los días con tarifa propia se ven en verde; los cerrados en rosa; los que
    usan la base en blanco.
  - Selecciona un rango con clic, cambia unidades y tarifa, y **Aplicar al
    rango**. Los días cambian de color al instante.
  - Marca **Cerrar estas fechas** para mostrar cómo se bloquea una fecha.

> "El inventario manda sobre el precio base. Si no hay fila para un día, se
> usa la tarifa del tipo."

**c. Equipo**

- Invita a un colaborador con un correo que tengas a mano.
- Aparece con **Sin activar** y el botón **Reenviar invitación**.
- Explica: "el responsable invita a su equipo; los colaboradores operan el
  catálogo pero no editan la ficha ni administran al equipo."

---

## 4. Portal del socio — agencia (3 minutos)

Entra como `riviera-tours@turismo.test`.

**a. Paquetes**

- Tarjetas con portada, destino, duración, precio desde y estado.
- Abre **Riviera Maya Todo Incluido**.

**b. El detalle del paquete**

- **Incluye**: ítems con tipo (hospedaje, alimentos, transporte) y los que no
  están incluidos, tachados.
- **Itinerario**: día por día.
- **Salidas**: fechas con cupo, precio adulto y de menor; se pueden abrir y
  cerrar.
- **Portada**: se pega una URL y se ve la vista previa.

**c. La regla de publicación**

Si el paquete está en borrador, pulsa **Publicar** y explica:

> "Para publicarse necesita al menos un ítem incluido, itinerario y una salida
> abierta con cupo. Si falta algo, la API lo rechaza y el motivo aparece
> arriba."

Muestra **Pausar** y **Publicar** para cerrar el ciclo.

---

## 5. El bot de Telegram (5 minutos) — el cierre

Abre Telegram y escribe al bot.

**a. Bienvenida**

```
/start
```

El bot manda el saludo, pide el nombre y después el sticker.

```
¡Hola! Hoy seré tu asistente de viaje. ¿Con quién tengo el gusto?
[sticker]
```

Responde con tu nombre. Llega el menú personalizado:

```
Mucho gusto, Carlos. ¿Qué te gustaría hacer hoy?
[Paquetes] [Hoteles] [Experiencias]
[Ver mi selección] [Consultar mi reserva]
```

> "No es un formulario: el bot pregunta lo mínimo y se adapta."

**b. La conversación**

Escribe esto tal cual (funciona):

```
quiero playa en pareja en diciembre
tulum del 8 al 10 de diciembre
me interesa
apártalo
```

Respuestas esperadas, en orden:

1. Pide las fechas exactas.
2. Encuentra **Tulum y Cenotes**, desde $6,400 por adulto, y deja un botón por
   opción.
3. Cotiza: **$12,800 MXN** para dos personas.
4. Aparta: folio tipo **TRV-XXXXXX**, enlace de PayPal sandbox y vencimiento en
   hora de México (15 minutos).

> "Todo lo que dice sale de la API: buscó disponibilidad real, cotizó contra el
> catálogo y apartó con cupo. No inventa precios."

**c. Detalles que vale mencionar mientras responde**

- Aparece **"escribiendo…"** mientras piensa, y se mantiene si tarda.
- Si escribes tres mensajes seguidos, los **junta** y responde una sola vez.
- Tiene **memoria de la conversación**: recuerda destino, fechas y personas.
- Si le pides algo sin fecha, pregunta; **no dice "no hay cupo" a ciegas**.

**d. Lo que puedes enseñar si hay tiempo**

- **Consultar reserva**: el estado del apartado.
- **Pago**: abre el enlace de PayPal sandbox. Si tienes cuenta compradora,
  completa el pago y vuelve al bot: la reserva pasa a confirmada y el bot manda
  el comprobante con **QR**.
- **Correo al proveedor**: al confirmarse el pago, el socio recibe un correo
  con la clave y los datos del viajero.
- **El log**, si quieres mostrar la trazabilidad:

```powershell
docker compose logs -f api | Select-String "\[mail\]"
```

---

## 6. Cierre técnico (2 minutos)

> "Tres piezas: API en Node con MySQL, web en React y bot en Python con
> LangGraph y DeepSeek. Todo corre en Docker y se publica con un solo dominio:
> el mismo sirve la web, la API y los webhooks de Telegram y PayPal."

**Lo que está listo**

- Alta y gobierno de socios (aprobación, equipo, activación).
- Catálogo real: habitaciones con inventario por fecha, paquetes con itinerario
  y salidas.
- Reservas con apartado de cupo y pago en PayPal sandbox.
- Bot conversacional con herramientas: busca, cotiza, aparta y consulta.

**Lo que sigue (dilo tú, no esperes que lo pregunten)**

- Canal de WhatsApp además de Telegram.
- Reserva de varios servicios en una sola compra.
- Check-in con validación del QR.
- Recordatorios automáticos y cancelaciones.

---

## Plan B: si algo falla en vivo

| Síntoma | Causa probable | Qué hacer |
|---|---|---|
| La URL pública no responde | El túnel se reinició | `scripts\public-url.cmd -Telegram` y usa la URL nueva |
| El bot no contesta en Telegram | Webhook viejo | El mismo comando de arriba lo vuelve a registrar |
| `admin@gmail.com` da 401 | Cambiaste la contraseña | Reset al final de esta guía |
| El catálogo aparece vacío | Se bajaron los volúmenes | `docker compose exec -T api npm run seed` |
| El correo no llega | Gmail lo manda a Spam | Muestra `api/docs/correos/activacion.png` y sigue |
| PayPal no carga | Red o cuenta sandbox | Muestra el enlace y explica que es sandbox |
| El bot tarda | El modelo está pensando | Ya se ve "escribiendo…": narra mientras tanto |

---

## Reset para dejar la demo limpia

Borra datos y vuelve a sembrar (la primera vez tarda unos minutos):

```powershell
docker compose down -v
docker compose up -d --build
docker compose --profile public up -d tunnel
scripts\public-url.cmd -Telegram
```

Después de esto, el administrador vuelve a la contraseña de `api/.env`.

---

## Si olvidaste la contraseña del administrador

```powershell
# 1. Genera el hash de la nueva contraseña
docker compose exec -T api node -e "require('bcryptjs').hash('Admin12345!',10).then(h=>console.log(h))"

# 2. Copia el hash que imprime y pégalo aquí
$clave = (Get-Content .env | Where-Object { $_ -match '^DB_PASSWORD=' }) -replace 'DB_PASSWORD=',''
docker compose exec -T -e MYSQL_PWD=$clave mysql mysql -uroot -D turista -e "UPDATE users SET password_hash='PEGA_EL_HASH', must_change_password=0 WHERE email='admin@gmail.com';"
```

---

## Qué no conviene prometer

- **WhatsApp**: hoy el canal es Telegram. El contrato ya separa el canal del
  identificador, así que entrar después no rompe nada.
- **Varios servicios en una compra**: el apartado funciona por servicio.
- **Validación del QR en la entrada**: el comprobante con QR ya se genera; falta
  la pantalla del proveedor para validarlo.
- **Cancelar un apartado**: vence solo en 15 minutos; no hay cancelación
  manual.

Si preguntan por eso, respóndelo como siguiente fase. Es mejor que descubrirlo
en la demo.
