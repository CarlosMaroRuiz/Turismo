# Cuentas de prueba: Playa del Carmen y Yucatán

Ocho socios de demostración para alimentar el bot de Telegram y probar el portal:
once hoteles y diez agencias, repartidos entre Quintana Roo (Cancún, Playa del Carmen, Tulum y Cozumel) y Yucatán (Mérida, Valladolid, Izamal y Progreso).

Todas las cuentas las crea el seeder `playa-yucatan`, así que se regeneran con:

```bash
cd api
npm run seed
```

El seeder es idempotente: si la cuenta ya existe no la duplica ni le cambia la
contraseña. Solo corre fuera de producción.

> Estas credenciales son públicas a propósito y solo sirven en desarrollo.
> Antes de publicar el sistema hay que eliminarlas o cambiarles la contraseña.

## Contraseña común

```
Turismo123!
```

## Hoteles

| Correo | Negocio | Zona | Habitaciones |
|---|---|---|---|
| `temptation@turismo.test` | Temptation Cancun Resort | Cancún | Trendy Garden View ($4,200), Bash Tower Suite ($6,900) |
| `playa-azul@turismo.test` | Hotel Playa Azul | Playa del Carmen | Doble vista mar ($1,800), Junior suite ($2,900) |
| `coral-maya@turismo.test` | Hotel Coral Maya | Playa del Carmen | Doble estándar ($1,500), Suite familiar ($2,500) |
| `hacienda-merida@turismo.test` | Hacienda Mérida Centro | Mérida | Habitación colonial ($1,600) |
| `posada-valladolid@turismo.test` | Posada Valladolid | Valladolid | Cuarto doble ($1,200), Cuarto triple ($1,700) |
| `casa-tulum@turismo.test` | Casa Tulum Boutique | Tulum | Cuarto selva ($2,300), Suite playa ($3,600) |
| `cozumel-reef@turismo.test` | Cozumel Reef Hotel | Cozumel | Estándar arrecife ($1,900), Junior suite buceo ($2,800) |
| `cancun-mar@turismo.test` | Hotel Cancún Mar | Cancún | Doble vista laguna ($2,100), Familiar vista mar ($3,200) |
| `malecon-progreso@turismo.test` | Hotel Malecón Progreso | Progreso | Cuarto malecón ($1,300), Suite familiar ($1,900) |
| `amarillo-izamal@turismo.test` | Hotel Amarillo Izamal | Izamal | Cuarto convento ($1,200), Suite amarilla ($1,700) |
| `convento-valladolid@turismo.test` | Hotel El Convento | Valladolid | Cuarto claustro ($1,400), Suite cenote ($2,000) |

Cada habitación tiene inventario con tarifa propia para los próximos 90 días, con
un día cerrado cada 30 para poder probar el caso de "sin disponibilidad".

## Agencias

| Correo | Negocio | Zona | Paquete |
|---|---|---|---|
| `riviera-tours@turismo.test` | Riviera Tours | Playa del Carmen | Riviera Maya Todo Incluido · 4D/3N · $7,900 |
| `quinta-aventuras@turismo.test` | Quinta Aventuras | Playa del Carmen | Aventura en Cenotes · 3D/2N · $5,400 |
| `cancun-paradise@turismo.test` | Cancún Paradise | Cancún | Cancún Todo Incluido · 5D/4N · $12,900 |
| `tulum-vibes@turismo.test` | Tulum Vibes | Tulum | Tulum y Cenotes · 3D/2N · $6,400 |
| `cozumel-dive@turismo.test` | Cozumel Dive Center | Cozumel | Buceo en Cozumel · 4D/3N · $9,500 |
| `yucatan-experience@turismo.test` | Yucatán Experience | Mérida | Ruta Maya Yucatán · 5D/4N · $9,800 |
| `merida-colonial@turismo.test` | Mérida Colonial Tours | Mérida | Mérida y Haciendas · 3D/2N · $5,900 |
| `tours-valladolid@turismo.test` | Tours Valladolid | Valladolid | Valladolid y Cenotes · 3D/2N · $5,100 |
| `izamal-magica@turismo.test` | Izamal Mágica | Izamal | Izamal y Chichén · 2D/1N · $3,900 |
| `progreso-beach@turismo.test` | Progreso Beach Tours | Progreso | Progreso y Flamencos · 2D/1N · $3,500 |

Cada paquete queda **publicado**, con ítems incluidos, itinerario día por día y
**dos salidas abiertas** (a 15 y 30 días) para que el bot pueda cotizar y apartar.

## Cómo entrar

Portal del socio:

```
http://localhost:5173/login
```

Con cualquiera de los correos de arriba y la contraseña común. Un hotel ve el
módulo **Habitaciones**; una agencia verá **Paquetes** cuando ese módulo exista.

## Cómo los usa el bot

El bot de Telegram cotiza contra el catálogo público, así que con estos datos ya
puede:

- Buscar hoteles por destino y huéspedes (`/hotels/availability`).
- Buscar paquetes por destino (`/packages`).
- Cotizar y apartar salidas de paquete (`/quotes`, `/bookings/checkout`).

Destinos disponibles para la conversación:

```
Cancún             -> región Benito Juárez (Quintana Roo)
Cancún             -> región Benito Juárez (Quintana Roo)
Playa del Carmen   -> región Solidaridad (Quintana Roo)
Tulum              -> región Tulum (Quintana Roo)
Cozumel            -> región Cozumel (Quintana Roo)
Mérida             -> región Mérida (Yucatán)
Valladolid         -> región Valladolid (Yucatán)
Izamal             -> región Izamal (Yucatán)
Progreso           -> región Progreso (Yucatán)
```

Los alias de región aceptan "Cancún", "Cancun", "CUN", "Temptation", "Playa", "PDC", "Merida" y
"Zaci", que es lo que escribe la gente.

## Cuentas adicionales que ya existían

Estas venían de los seeders anteriores y también son de desarrollo:

| Correo | Tipo | Notas |
|---|---|---|
| `hotel.demo@plataforma.com` | Hotel | Contraseña `Hotel1234!` |
| `atractivo.demo@plataforma.com` | Atractivo | Contraseña `Atractivo1234!`, con experiencia y turnos |
| `agencia.test@plataforma.com` | Agencia | Contraseña `Test1234!` |
| `admin@gmail.com` | Administrador | Panel `/admin`, no es socio |

## Si algo no aparece

1. Confirma que el seeder corrió sin errores: `npm run seed`.
2. Revisa que el socio esté `active` con `GET /partners` desde el panel.
3. Los listados públicos (`/hotels/room-types`, `/packages`) solo muestran socios
   activos y habitaciones o paquetes activos.
