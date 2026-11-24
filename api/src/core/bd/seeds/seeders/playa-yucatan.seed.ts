import { DataSource } from "typeorm";
import { Seed } from "../utils/seed.decorator.js";
import type { Seeder } from "../types/index.js";
import { METACONFIG } from "../../../metaconfig/index.js";
import { PasswordService } from "../../../security/PasswordService.js";
import { State } from "../../entities/State.entity.js";
import { Region, RegionStatus, RegionType } from "../../entities/Region.entity.js";
import { PartnerCategory } from "../../entities/PartnerCategory.js";
import { Partner, PartnerStatus } from "../../entities/Partner.js";
import { Role, RoleCode } from "../../entities/Role.js";
import { User, UserStatus } from "../../entities/User.js";
import { PartnerUser, PartnerUserRole } from "../../entities/PartnerUser.js";
import { RoomType } from "../../entities/RoomType.js";
import { RoomInventory } from "../../entities/RoomInventory.js";
import { Package, PackageStatus } from "../../entities/Package.js";
import { PackageItem, PackageItemType } from "../../entities/PackageItem.js";
import { PackageItineraryDay } from "../../entities/PackageItineraryDay.js";
import {
  PackageDeparture,
  DepartureStatus,
} from "../../entities/PackageDeparture.js";

/** Zona donde viven los socios de prueba: Quintana Roo y Yucatán. */
type Zona = "playa" | "cancun" | "tulum" | "cozumel" | "merida" | "valladolid" | "izamal" | "progreso" | "islamujeres" | "bacalar";

interface RegionSeed {
  name: string;
  slug: string;
  stateCode: string;
  aliases: string[];
  lat: number;
  lng: number;
}

interface RoomSeed {
  name: string;
  description: string;
  maxAdults: number;
  maxChildren: number;
  totalUnits: number;
  basePrice: number;
  amenities: string[];
  /** Id de picsum para la foto de la habitacion. */
  foto: number;
  /** Foto propia: si viene, manda sobre el id de picsum. */
  fotoUrl?: string;
}

interface HotelSeed {
  slug: string;
  email: string;
  /** Id de picsum para el logo del socio. */
  logo: number;
  commercialName: string;
  legalName: string;
  zona: Zona;
  address: string;
  description: string;
  rooms: RoomSeed[];
}

interface AgencySeed {
  slug: string;
  email: string;
  /** Id de picsum para el logo del socio. */
  logo: number;
  commercialName: string;
  legalName: string;
  zona: Zona;
  address: string;
  description: string;
  packageName: string;
  packageSlug: string;
  /** Id de picsum para la portada del paquete. */
  portada: number;
  summary: string;
  nights: number;
  adultPrice: number;
  childPrice: number;
}

const REGIONES: Record<Zona, RegionSeed> = {
  playa: {
    name: "Solidaridad",
    slug: "solidaridad",
    stateCode: "23",
    aliases: ["Playa del Carmen", "Playa", "PDC", "Solidaridad"],
    lat: 20.6296,
    lng: -87.0739,
  },
  cancun: {
    name: "Benito Juárez",
    slug: "benito-juarez",
    stateCode: "23",
    aliases: ["Cancún", "Cancun", "CUN", "Benito Juárez", "Zona Hotelera", "Temptation"],
    lat: 21.1619,
    lng: -86.8515,
  },
  merida: {
    name: "Mérida",
    slug: "merida",
    stateCode: "31",
    aliases: ["Merida", "MID", "Ciudad Blanca"],
    lat: 20.9674,
    lng: -89.5926,
  },
  valladolid: {
    name: "Valladolid",
    slug: "valladolid",
    stateCode: "31",
    aliases: ["Valladolid", "Zaci"],
    lat: 20.6896,
    lng: -88.2011,
  },
  tulum: {
    name: "Tulum",
    slug: "tulum",
    stateCode: "23",
    aliases: ["Tulum", "TUL", "Riviera Maya Sur"],
    lat: 20.2114,
    lng: -87.4654,
  },
  cozumel: {
    name: "Cozumel",
    slug: "cozumel",
    stateCode: "23",
    aliases: ["Cozumel", "CZM", "Isla de Cozumel"],
    lat: 20.5083,
    lng: -86.9458,
  },
  izamal: {
    name: "Izamal",
    slug: "izamal",
    stateCode: "31",
    aliases: ["Izamal", "La Ciudad Amarilla"],
    lat: 20.9314,
    lng: -89.0178,
  },
  progreso: {
    name: "Progreso",
    slug: "progreso",
    stateCode: "31",
    aliases: ["Progreso", "Puerto Progreso", "Chicxulub"],
    lat: 21.282,
    lng: -89.6635,
  },
  islamujeres: {
    name: "Isla Mujeres",
    slug: "isla-mujeres",
    stateCode: "23",
    aliases: ["Isla Mujeres", "Isla", "IMU"],
    lat: 21.2367,
    lng: -86.7316,
  },
  bacalar: {
    name: "Bacalar",
    slug: "bacalar",
    stateCode: "23",
    aliases: ["Bacalar", "Laguna de Bacalar", "Laguna de los Siete Colores"],
    lat: 18.6813,
    lng: -88.392,
  },
};

/**
 * Cuentas de prueba para alimentar el bot: cuatro hoteles y cuatro agencias
 * repartidos entre Playa del Carmen y Yucatán, todos con inventario real
 * (habitaciones con tarifa por fecha, paquetes publicados con salidas).
 *
 * Las credenciales están documentadas en `api/docs/usuarios-de-prueba.md`.
 */
@Seed({ name: "playa-yucatan", order: 9 })
export class PlayaYucatanSeeder implements Seeder {
  /** Una sola contrasena para todas las cuentas de prueba. */
  private static readonly PASSWORD = "Turismo123!";

  /** Fotos reales de habitacion, para que ningun cuarto quede con un paisaje. */
  private static readonly FOTOS_HABITACION = [
    "https://images.unsplash.com/photo-1618773928121-c32242e63f39?q=80&w=1170&auto=format&fit=crop&ixlib=rb-4.1.0&ixid=NHwxMjA3fDA%3D",
    "https://images.unsplash.com/photo-1611892440504-42a792e24d32?q=80&w=1170&auto=format&fit=crop&ixlib=rb-4.1.0&ixid=NHwxMjA3fDA%3D",
    "https://images.unsplash.com/photo-1631049307264-da0ec9d70304?q=80&w=1170&auto=format&fit=crop&ixlib=rb-4.1.0&ixid=NHwxMjA3fDA%3D",
    "https://plus.unsplash.com/premium_photo-1675616563084-63d1f129623d?w=600&auto=format&fit=crop&q=60&ixlib=rb-4.1.0&ixid=NHwxMjA3fDA%3D",
  ];

  private static readonly HOTELES: HotelSeed[] = [
    {
      slug: "temptation-cancun-resort",
      email: "temptation@turismo.test",
      logo: 1048,
      commercialName: "Temptation Cancun Resort",
      legalName: "Temptation Cancún Resort S.A. de C.V.",
      zona: "cancun",
      address: "Blvd. Kukulcán Km 3.5, Zona Hotelera, Cancún",
      description: "Resort all-inclusive exclusivo para adultos en Cancún con albercas temáticas, fiestas, espectáculos en vivo y restaurantes gourmet.",
      rooms: [
        {
          name: "Trendy Garden View",
          description: "Habitación de diseño contemporáneo para adultos con cama king size, terraza con vista a jardines tropicales y minibar surtido.",
          maxAdults: 2,
          maxChildren: 0,
          totalUnits: 8,
          basePrice: 4200,
          foto: 1029,
          amenities: ["wifi", "todo incluido", "alberca", "aire acondicionado", "minibar", "adults only"],
        },
        {
          name: "Bash Tower Suite",
          description: "Suite de lujo en la torre principal con jacuzzi privado, vista panorámica al mar Caribe, servicio a la habitación 24 horas y amenidades VIP.",
          maxAdults: 2,
          maxChildren: 0,
          totalUnits: 4,
          basePrice: 6900,
          foto: 1048,
          amenities: ["wifi", "todo incluido", "jacuzzi", "vista al mar", "acceso vip", "room service 24/7", "adults only"],
        },
      ],
    },
    {
      slug: "hotel-playa-azul",
      email: "playa-azul@turismo.test",
      logo: 1050,
      commercialName: "Hotel Playa Azul",
      legalName: "Hotel Playa Azul S.A. de C.V.",
      zona: "playa",
      address: "5a Avenida esquina calle 10, Centro",
      description: "Hotel frente al mar con alberca, desayuno incluido y acceso directo a la playa.",
      rooms: [
        {
          name: "Doble vista mar",
          description: "Dos camas queen, balcón con vista al mar y desayuno buffet.",
          maxAdults: 2,
          maxChildren: 1,
          totalUnits: 6,
          basePrice: 1800,
          foto: 1061,
          fotoUrl: "https://images.unsplash.com/photo-1618773928121-c32242e63f39?q=80&w=1170&auto=format&fit=crop&ixlib=rb-4.1.0&ixid=NHwxMjA3fDA%3D",
          amenities: ["wifi", "desayuno", "alberca", "vista al mar"],
        },
        {
          name: "Junior suite",
          description: "Sala pequeña, cama king y terraza privada.",
          maxAdults: 3,
          maxChildren: 2,
          totalUnits: 3,
          basePrice: 2900,
          foto: 1050,
          fotoUrl: "https://images.unsplash.com/photo-1611892440504-42a792e24d32?q=80&w=1170&auto=format&fit=crop&ixlib=rb-4.1.0&ixid=NHwxMjA3fDA%3D",
          amenities: ["wifi", "desayuno", "alberca", "jacuzzi"],
        },
        {
          name: "Cuarto estándar",
          description: "Cama matrimonial, ventilador de techo y baño privado a dos calles de la playa.",
          maxAdults: 2,
          maxChildren: 0,
          totalUnits: 10,
          basePrice: 1200,
          foto: 1015,
          fotoUrl: "https://images.unsplash.com/photo-1631049307264-da0ec9d70304?q=80&w=1170&auto=format&fit=crop&ixlib=rb-4.1.0&ixid=NHwxMjA3fDA%3D",
          amenities: ["wifi", "abanico", "baño privado"],
        },
        {
          name: "Cuarto king jardín",
          description: "Cama king, ventanal al jardín interior y desayuno continental.",
          maxAdults: 2,
          maxChildren: 1,
          totalUnits: 6,
          basePrice: 1650,
          foto: 1065,
          fotoUrl: "https://plus.unsplash.com/premium_photo-1675616563084-63d1f129623d?w=600&auto=format&fit=crop&q=60&ixlib=rb-4.1.0&ixid=NHwxMjA3fDA%3D",
          amenities: ["wifi", "desayuno", "jardín", "aire acondicionado"],
        },
        {
          name: "Suite familiar",
          description: "Dos recámaras, sala con sofá cama y balcón con vista lateral al mar.",
          maxAdults: 4,
          maxChildren: 2,
          totalUnits: 4,
          basePrice: 3900,
          foto: 1043,
          fotoUrl: "https://images.unsplash.com/photo-1618773928121-c32242e63f39?q=80&w=1170&auto=format&fit=crop&ixlib=rb-4.1.0&ixid=NHwxMjA3fDA%3D",
          amenities: ["wifi", "desayuno", "alberca", "cocina", "vista al mar"],
        },
        {
          name: "Suite presidencial",
          description: "Dos baños, jacuzzi, cocina equipada y terraza panorámica sobre la Quinta Avenida.",
          maxAdults: 4,
          maxChildren: 2,
          totalUnits: 2,
          basePrice: 6500,
          foto: 1048,
          fotoUrl: "https://images.unsplash.com/photo-1611892440504-42a792e24d32?q=80&w=1170&auto=format&fit=crop&ixlib=rb-4.1.0&ixid=NHwxMjA3fDA%3D",
          amenities: ["wifi", "desayuno", "jacuzzi", "cocina", "terraza", "room service"],
        },
        {
          name: "Villa privada con alberca",
          description: "Casa de dos pisos con alberca privada, cocina completa y jardín con camastros.",
          maxAdults: 4,
          maxChildren: 2,
          totalUnits: 2,
          basePrice: 8900,
          foto: 1060,
          fotoUrl: "https://images.unsplash.com/photo-1631049307264-da0ec9d70304?q=80&w=1170&auto=format&fit=crop&ixlib=rb-4.1.0&ixid=NHwxMjA3fDA%3D",
          amenities: ["wifi", "alberca privada", "cocina", "jardín", "estacionamiento"],
        },
        {
          name: "Penthouse terraza",
          description: "Último piso con terraza de 40 m², jacuzzi exterior y vista completa a la bahía.",
          maxAdults: 2,
          maxChildren: 1,
          totalUnits: 1,
          basePrice: 11500,
          foto: 1053,
          fotoUrl: "https://plus.unsplash.com/premium_photo-1675616563084-63d1f129623d?w=600&auto=format&fit=crop&q=60&ixlib=rb-4.1.0&ixid=NHwxMjA3fDA%3D",
          amenities: ["wifi", "jacuzzi", "terraza", "vista al mar", "room service"],
        },
      ],
    },
    {
      slug: "hotel-coral-maya",
      email: "coral-maya@turismo.test",
      logo: 1011,
      commercialName: "Hotel Coral Maya",
      legalName: "Coral Maya Hoteles S. de R.L.",
      zona: "playa",
      address: "Calle 28 Norte entre 1a y 5a Avenida",
      description: "Hotel boutique a tres calles de la Quinta Avenida, con terraza y bar.",
      rooms: [
        {
          name: "Doble estándar",
          description: "Cama matrimonial, aire acondicionado y baño privado.",
          maxAdults: 2,
          maxChildren: 0,
          totalUnits: 8,
          basePrice: 1500,
          foto: 1011,
          amenities: ["wifi", "aire acondicionado", "terraza"],
        },
        {
          name: "Suite familiar",
          description: "Dos habitaciones conectadas, ideal para familias.",
          maxAdults: 4,
          maxChildren: 2,
          totalUnits: 2,
          basePrice: 2500,
          foto: 1018,
          amenities: ["wifi", "cocina", "aire acondicionado"],
        },
      ],
    },
    {
      slug: "hacienda-merida-centro",
      email: "hacienda-merida@turismo.test",
      logo: 1047,
      commercialName: "Hacienda Mérida Centro",
      legalName: "Hacienda Mérida Centro S.A. de C.V.",
      zona: "merida",
      address: "Calle 60 número 450, Centro Histórico",
      description: "Casona restaurada del siglo XIX a dos cuadras del Paseo de Montejo.",
      rooms: [
        {
          name: "Habitación colonial",
          description: "Techo alto, pisos de pasta original y patio interior.",
          maxAdults: 2,
          maxChildren: 1,
          totalUnits: 5,
          basePrice: 1600,
          foto: 1047,
          amenities: ["wifi", "desayuno", "patio", "aire acondicionado"],
        },
      ],
    },
    {
      slug: "posada-valladolid",
      email: "posada-valladolid@turismo.test",
      logo: 1051,
      commercialName: "Posada Valladolid",
      legalName: "Posada Valladolid S.A. de C.V.",
      zona: "valladolid",
      address: "Calle 41 número 200, Centro",
      description: "Posada familiar a cinco minutos del convento de San Bernardino.",
      rooms: [
        {
          name: "Cuarto doble",
          description: "Dos camas individuales, ventilador y baño privado.",
          maxAdults: 2,
          maxChildren: 1,
          totalUnits: 7,
          basePrice: 1200,
          foto: 1051,
          amenities: ["wifi", "estacionamiento"],
        },
        {
          name: "Cuarto triple",
          description: "Tres camas individuales, ideal para amigos.",
          maxAdults: 3,
          maxChildren: 1,
          totalUnits: 3,
          basePrice: 1700,
          foto: 1044,
          amenities: ["wifi", "estacionamiento", "agua caliente"],
        },
      ],
    },
    {
      slug: "casa-tulum-boutique",
      email: "casa-tulum@turismo.test",
      logo: 1053,
      commercialName: "Casa Tulum Boutique",
      legalName: "Casa Tulum Boutique S.A. de C.V.",
      zona: "tulum",
      address: "Calle Centauro Sur, Tulum Centro",
      description: "Casona de nueve cuartos entre la selva y la playa, con desayuno artesanal y bicicletas incluidas.",
      rooms: [
        {
          name: "Cuarto selva",
          description: "Cama king, terraza entre palmeras y regadera al aire libre.",
          maxAdults: 2,
          maxChildren: 1,
          totalUnits: 5,
          basePrice: 2300,
          foto: 1053,
          amenities: ["wifi", "desayuno", "bicicletas", "alberca"],
        },
        {
          name: "Suite playa",
          description: "Vista al mar, hamaca en la terraza y servicio a la habitación.",
          maxAdults: 2,
          maxChildren: 2,
          totalUnits: 3,
          basePrice: 3600,
          foto: 1054,
          amenities: ["wifi", "desayuno", "alberca", "vista al mar", "aire acondicionado"],
        },
      ],
    },
    {
      slug: "cozumel-reef-hotel",
      email: "cozumel-reef@turismo.test",
      logo: 1059,
      commercialName: "Cozumel Reef Hotel",
      legalName: "Cozumel Reef Hotel S.A. de C.V.",
      zona: "cozumel",
      address: "Av. Rafael E. Melgar 475, San Miguel de Cozumel",
      description: "Frente al arrecife, con muelle propio para buceo y equipo de renta.",
      rooms: [
        {
          name: "Estándar arrecife",
          description: "Dos camas matrimoniales, balcón y vista parcial al mar.",
          maxAdults: 2,
          maxChildren: 2,
          totalUnits: 6,
          basePrice: 1900,
          foto: 1059,
          amenities: ["wifi", "alberca", "aire acondicionado"],
        },
        {
          name: "Junior suite buceo",
          description: "Cuarto amplio con área de secado de equipo y vista al muelle.",
          maxAdults: 2,
          maxChildren: 1,
          totalUnits: 4,
          basePrice: 2800,
          foto: 1060,
          amenities: ["wifi", "alberca", "equipo de buceo", "vista al mar"],
        },
      ],
    },
    {
      slug: "hotel-cancun-mar",
      email: "cancun-mar@turismo.test",
      logo: 1062,
      commercialName: "Hotel Cancún Mar",
      legalName: "Hotel Cancún Mar S.A. de C.V.",
      zona: "cancun",
      address: "Blvd. Kukulcán Km 8.5, Zona Hotelera",
      description: "Playa privada, alberca panorámica y plan europeo a un paso de la vida nocturna.",
      rooms: [
        {
          name: "Doble vista laguna",
          description: "Cama king, balcón con vista a la laguna Nichupté.",
          maxAdults: 2,
          maxChildren: 1,
          totalUnits: 8,
          basePrice: 2100,
          foto: 1062,
          amenities: ["wifi", "alberca", "playa privada", "aire acondicionado"],
        },
        {
          name: "Familiar vista mar",
          description: "Dos camas queen y sofá cama, con vista directa al Caribe.",
          maxAdults: 4,
          maxChildren: 2,
          totalUnits: 5,
          basePrice: 3200,
          foto: 1063,
          amenities: ["wifi", "alberca", "playa privada", "desayuno"],
        },
      ],
    },
    {
      slug: "hotel-malecon-progreso",
      email: "malecon-progreso@turismo.test",
      logo: 1064,
      commercialName: "Hotel Malecón Progreso",
      legalName: "Hotel Malecón Progreso S.A. de C.V.",
      zona: "progreso",
      address: "Calle 80 número 120, Malecón",
      description: "A unos pasos del mar, con terraza para ver el atardecer y café de altura yucateco.",
      rooms: [
        {
          name: "Cuarto malecón",
          description: "Cama matrimonial, balcón al malecón y ventilador de techo.",
          maxAdults: 2,
          maxChildren: 1,
          totalUnits: 6,
          basePrice: 1300,
          foto: 1064,
          amenities: ["wifi", "vista al mar", "estacionamiento"],
        },
        {
          name: "Suite familiar",
          description: "Dos recámaras, cocineta y terraza con vista al Golfo.",
          maxAdults: 4,
          maxChildren: 2,
          totalUnits: 3,
          basePrice: 1900,
          foto: 1065,
          amenities: ["wifi", "cocina", "vista al mar", "aire acondicionado"],
        },
      ],
    },
    {
      slug: "hotel-amarillo-izamal",
      email: "amarillo-izamal@turismo.test",
      logo: 1066,
      commercialName: "Hotel Amarillo Izamal",
      legalName: "Hotel Amarillo Izamal S.A. de C.V.",
      zona: "izamal",
      address: "Calle 31 número 301, Centro",
      description: "Casona pintada de amarillo frente al convento, con patio de naranjos y desayuno yucateco.",
      rooms: [
        {
          name: "Cuarto convento",
          description: "Cama king, ventanal al convento y pisos de pasta original.",
          maxAdults: 2,
          maxChildren: 1,
          totalUnits: 5,
          basePrice: 1200,
          foto: 1066,
          amenities: ["wifi", "desayuno", "patio", "aire acondicionado"],
        },
        {
          name: "Suite amarilla",
          description: "Sala pequeña, tina y terraza sobre el patio interior.",
          maxAdults: 2,
          maxChildren: 2,
          totalUnits: 3,
          basePrice: 1700,
          foto: 1067,
          amenities: ["wifi", "desayuno", "tina", "terraza"],
        },
      ],
    },
    {
      slug: "hotel-convento-valladolid",
      email: "convento-valladolid@turismo.test",
      logo: 1068,
      commercialName: "Hotel El Convento",
      legalName: "Hotel El Convento S.A. de C.V.",
      zona: "valladolid",
      address: "Calle 41-A número 115, Centro",
      description: "Ex convento restaurado con alberca en el claustro y cena a la luz de las velas.",
      rooms: [
        {
          name: "Cuarto claustro",
          description: "Cama king, muros de piedra y acceso directo a la alberca.",
          maxAdults: 2,
          maxChildren: 1,
          totalUnits: 4,
          basePrice: 1400,
          foto: 1068,
          amenities: ["wifi", "alberca", "desayuno", "aire acondicionado"],
        },
        {
          name: "Suite cenote",
          description: "Cuarto de esquina con tina, terraza y vista parcial a un cenote.",
          maxAdults: 2,
          maxChildren: 2,
          totalUnits: 3,
          basePrice: 2000,
          foto: 1069,
          amenities: ["wifi", "alberca", "tina", "terraza"],
        },
      ],
    },
    {
      slug: "hotel-riviera-suite",
      email: "riviera-suite@turismo.test",
      logo: 1070,
      commercialName: "Riviera Suites",
      legalName: "Riviera Suites S.A. de C.V.",
      zona: "playa",
      address: "Av. 10 Norte esquina calle 26, Gonzalo Guerrero",
      description: "Suites con cocineta y alberca en la azotea, a tres minutos de la playa.",
      rooms: [
        {
          name: "Suite estudio",
          description: "Cama king, cocineta y balcón con vista a la alberca de azotea.",
          maxAdults: 2,
          maxChildren: 1,
          totalUnits: 8,
          basePrice: 2200,
          foto: 1070,
          amenities: ["wifi", "cocina", "alberca", "aire acondicionado"],
        },
        {
          name: "Suite dos recámaras",
          description: "Dos recámaras, cocina completa y comedor para cuatro personas.",
          maxAdults: 4,
          maxChildren: 2,
          totalUnits: 4,
          basePrice: 3800,
          foto: 1071,
          amenities: ["wifi", "cocina", "alberca", "estacionamiento"],
        },
      ],
    },
    {
      slug: "hotel-cancun-caribe",
      email: "cancun-caribe@turismo.test",
      logo: 1072,
      commercialName: "Cancún Caribe Sol",
      legalName: "Cancún Caribe Sol S.A. de C.V.",
      zona: "cancun",
      address: "Blvd. Kukulcán Km 12, Zona Hotelera",
      description: "Todo incluido familiar con toboganes, club de niños y tres restaurantes.",
      rooms: [
        {
          name: "Familiar todo incluido",
          description: "Dos camas queen, sofá cama y balcón con vista al mar.",
          maxAdults: 4,
          maxChildren: 2,
          totalUnits: 10,
          basePrice: 4100,
          foto: 1072,
          amenities: ["wifi", "todo incluido", "alberca", "club de niños"],
        },
        {
          name: "Suite coral",
          description: "Recámara independiente, sala y terraza con vista a la alberca.",
          maxAdults: 2,
          maxChildren: 2,
          totalUnits: 6,
          basePrice: 5600,
          foto: 1073,
          amenities: ["wifi", "todo incluido", "alberca", "vista al mar"],
        },
      ],
    },
    {
      slug: "hotel-tulum-jungla",
      email: "tulum-jungla@turismo.test",
      logo: 1074,
      commercialName: "Tulum Jungle Lodge",
      legalName: "Tulum Jungle Lodge S.A. de C.V.",
      zona: "tulum",
      address: "Carretera Tulum-Boca Paila Km 7",
      description: "Cabañas de madera entre la selva, con cenote propio y desayuno vegetariano.",
      rooms: [
        {
          name: "Cabaña selva",
          description: "Cabaña con mosquitero, terraza y regadera exterior.",
          maxAdults: 2,
          maxChildren: 1,
          totalUnits: 6,
          basePrice: 2100,
          foto: 1074,
          amenities: ["wifi", "cenote", "desayuno", "terraza"],
        },
        {
          name: "Cabaña cenote",
          description: "Cabaña frente al cenote, con plataforma de descanso y hamaca.",
          maxAdults: 2,
          maxChildren: 0,
          totalUnits: 3,
          basePrice: 3100,
          foto: 1075,
          amenities: ["wifi", "cenote", "desayuno", "hamaca"],
        },
      ],
    },
    {
      slug: "hotel-paseo-montejo",
      email: "paseo-montejo@turismo.test",
      logo: 1076,
      commercialName: "Hotel Paseo Montejo",
      legalName: "Hotel Paseo Montejo S.A. de C.V.",
      zona: "merida",
      address: "Calle 56 número 480, Paseo de Montejo",
      description: "Casona de 1920 sobre el paseo, con desayuno yucateco y bicicletas para recorrer el centro.",
      rooms: [
        {
          name: "Cuarto paseo",
          description: "Cama king, ventanal al Paseo de Montejo y pisos de mosaico.",
          maxAdults: 2,
          maxChildren: 1,
          totalUnits: 7,
          basePrice: 1750,
          foto: 1076,
          amenities: ["wifi", "desayuno", "bicicletas", "aire acondicionado"],
        },
        {
          name: "Suite paseo",
          description: "Sala independiente, tina y balcón francés al paseo.",
          maxAdults: 2,
          maxChildren: 2,
          totalUnits: 3,
          basePrice: 2600,
          foto: 1077,
          amenities: ["wifi", "desayuno", "tina", "balcón"],
        },
      ],
    },
    {
      slug: "hotel-isla-mujeres-azul",
      email: "isla-mujeres@turismo.test",
      logo: 1078,
      commercialName: "Isla Mujeres Beach",
      legalName: "Isla Mujeres Beach S.A. de C.V.",
      zona: "islamujeres",
      address: "Av. Rueda Medina 120, Centro",
      description: "Frente a la playa Norte, con kayaks, snorkel y transporte al muelle incluido.",
      rooms: [
        {
          name: "Cuarto playa norte",
          description: "Cama king, balcón con vista a la playa Norte y desayuno incluido.",
          maxAdults: 2,
          maxChildren: 1,
          totalUnits: 8,
          basePrice: 2400,
          foto: 1078,
          amenities: ["wifi", "desayuno", "kayaks", "vista al mar"],
        },
        {
          name: "Suite isla",
          description: "Terraza privada, tina y vista completa al Caribe.",
          maxAdults: 2,
          maxChildren: 2,
          totalUnits: 3,
          basePrice: 3900,
          foto: 1079,
          amenities: ["wifi", "desayuno", "tina", "terraza", "vista al mar"],
        },
      ],
    },
    {
      slug: "hotel-bacalar-laguna",
      email: "bacalar-laguna@turismo.test",
      logo: 1080,
      commercialName: "Bacalar Laguna",
      legalName: "Bacalar Laguna S.A. de C.V.",
      zona: "bacalar",
      address: "Av. Costera de Bacalar, orilla de la laguna",
      description: "Muelle propio sobre la laguna de los siete colores, con kayaks y desayuno al amanecer.",
      rooms: [
        {
          name: "Cuarto laguna",
          description: "Cama king, terraza con hamaca y acceso directo al muelle.",
          maxAdults: 2,
          maxChildren: 1,
          totalUnits: 6,
          basePrice: 1950,
          foto: 1080,
          amenities: ["wifi", "desayuno", "muelle", "kayaks"],
        },
        {
          name: "Suite siete colores",
          description: "Dos ambientes, tina junto al ventanal y vista panorámica a la laguna.",
          maxAdults: 2,
          maxChildren: 2,
          totalUnits: 3,
          basePrice: 3200,
          foto: 1081,
          amenities: ["wifi", "desayuno", "tina", "muelle", "vista a la laguna"],
        },
      ],
    },
  ];

  private static readonly AGENCIAS: AgencySeed[] = [
    {
      slug: "riviera-tours",
      email: "riviera-tours@turismo.test",
      logo: 1050,
      commercialName: "Riviera Tours",
      legalName: "Riviera Tours Operadora S.A. de C.V.",
      zona: "playa",
      address: "Av. 10 Norte, local 3, Gonzalo Guerrero",
      description: "Agencia receptiva con paquetes de playa, cenotes y traslados privados.",
      packageName: "Riviera Maya Todo Incluido",
      packageSlug: "riviera-maya-todo-incluido-4d3n",
      portada: 1050,
      summary: "4 días y 3 noches con hotel frente al mar, cenote y traslado del aeropuerto.",
      nights: 3,
      adultPrice: 7900,
      childPrice: 4900,
    },
    {
      slug: "quinta-aventuras",
      email: "quinta-aventuras@turismo.test",
      logo: 1063,
      commercialName: "Quinta Aventuras",
      legalName: "Quinta Aventuras S.A. de C.V.",
      zona: "playa",
      address: "Calle 12 con 15a Avenida, local 8",
      description: "Especialistas en snorkel, cenotes y aventura en la Riviera Maya.",
      packageName: "Aventura en Cenotes",
      packageSlug: "aventura-en-cenotes-3d2n",
      portada: 1063,
      summary: "3 días de snorkel en cenotes, playa y noche en Playa del Carmen.",
      nights: 2,
      adultPrice: 5400,
      childPrice: 3400,
    },
    {
      slug: "yucatan-experience",
      email: "yucatan-experience@turismo.test",
      logo: 1016,
      commercialName: "Yucatán Experience",
      legalName: "Yucatán Experience Operadora S.A. de C.V.",
      zona: "merida",
      address: "Calle 62 número 380, Centro",
      description: "Circuitos culturales por haciendas, cenotes y zonas arqueológicas de Yucatán.",
      packageName: "Ruta Maya Yucatán",
      packageSlug: "ruta-maya-yucatan-5d4n",
      portada: 1016,
      summary: "5 días por Mérida, Uxmal, Chichén Itzá e Izamal con guía certificado.",
      nights: 4,
      adultPrice: 9800,
      childPrice: 6200,
    },
    {
      slug: "tours-valladolid",
      email: "tours-valladolid@turismo.test",
      logo: 1039,
      commercialName: "Tours Valladolid",
      legalName: "Tours Valladolid S.A. de C.V.",
      zona: "valladolid",
      address: "Calle 39 número 150, Centro",
      description: "Tours de medio día a cenotes cercanos y la zona arqueológica de Ek Balam.",
      packageName: "Valladolid y Cenotes",
      packageSlug: "valladolid-y-cenotes-3d2n",
      portada: 1039,
      summary: "3 días con dos noches en Valladolid, Ek Balam y cenote Zací.",
      nights: 2,
      adultPrice: 5100,
      childPrice: 3200,
    },
    {
      slug: "cancun-paradise",
      email: "cancun-paradise@turismo.test",
      logo: 1015,
      commercialName: "Cancún Paradise",
      legalName: "Cancún Paradise Operadora S.A. de C.V.",
      zona: "cancun",
      address: "Av. Bonampak, Supermanzana 5, Cancún",
      description: "Paquetes todo incluido en la Zona Hotelera, con traslados y tours opcionales.",
      packageName: "Cancún Todo Incluido",
      packageSlug: "cancun-todo-incluido-5d4n",
      portada: 1015,
      summary: "5 días y 4 noches en Zona Hotelera con plan todo incluido y tour a Isla Mujeres.",
      nights: 4,
      adultPrice: 12900,
      childPrice: 7900,
    },
    {
      slug: "tulum-vibes",
      email: "tulum-vibes@turismo.test",
      logo: 1035,
      commercialName: "Tulum Vibes",
      legalName: "Tulum Vibes S.A. de C.V.",
      zona: "tulum",
      address: "Av. Tulum, local 14, Centro",
      description: "Escapadas de playa y cenotes en Tulum, con opción de bici y yoga al amanecer.",
      packageName: "Tulum y Cenotes",
      packageSlug: "tulum-y-cenotes-3d2n",
      portada: 1035,
      summary: "3 días en Tulum con cenotes, playa y una tarde de bici entre ruinas.",
      nights: 2,
      adultPrice: 6400,
      childPrice: 3900,
    },
    {
      slug: "cozumel-dive",
      email: "cozumel-dive@turismo.test",
      logo: 1043,
      commercialName: "Cozumel Dive Center",
      legalName: "Cozumel Dive Center S. de R.L.",
      zona: "cozumel",
      address: "Av. Rafael E. Melgar 210, San Miguel de Cozumel",
      description: "Bautismos de buceo e inmersiones guiadas en el arrecife de Cozumel.",
      packageName: "Buceo en Cozumel",
      packageSlug: "buceo-en-cozumel-4d3n",
      portada: 1043,
      summary: "4 días con tres noches, dos inmersiones guiadas y equipo incluido.",
      nights: 3,
      adultPrice: 9500,
      childPrice: 6100,
    },
    {
      slug: "merida-colonial",
      email: "merida-colonial@turismo.test",
      logo: 1044,
      commercialName: "Mérida Colonial Tours",
      legalName: "Mérida Colonial Tours S.A. de C.V.",
      zona: "merida",
      address: "Calle 59 número 480, Centro Histórico",
      description: "Circuitos por el centro histórico, haciendas henequeneras y gastronomía yucateca.",
      packageName: "Mérida y Haciendas",
      packageSlug: "merida-y-haciendas-3d2n",
      portada: 1044,
      summary: "3 días con dos noches, recorrido por haciendas y cena yucateca.",
      nights: 2,
      adultPrice: 5900,
      childPrice: 3600,
    },
    {
      slug: "izamal-magica",
      email: "izamal-magica@turismo.test",
      logo: 1050,
      commercialName: "Izamal Mágica",
      legalName: "Izamal Mágica S.A. de C.V.",
      zona: "izamal",
      address: "Calle 31 número 300, Centro",
      description: "Pueblo mágico, convento y zona arqueológica de Chichén Itzá en un solo viaje corto.",
      packageName: "Izamal y Chichén",
      packageSlug: "izamal-y-chichen-2d1n",
      portada: 1050,
      summary: "2 días con una noche en Izamal y visita guiada a Chichén Itzá.",
      nights: 1,
      adultPrice: 3900,
      childPrice: 2400,
    },
    {
      slug: "progreso-beach",
      email: "progreso-beach@turismo.test",
      logo: 1051,
      commercialName: "Progreso Beach Tours",
      legalName: "Progreso Beach Tours S.A. de C.V.",
      zona: "progreso",
      address: "Calle 80, malecón de Progreso",
      description: "Playa, malecón y avistamiento de flamencos en la costa yucateca.",
      packageName: "Progreso y Flamencos",
      packageSlug: "progreso-y-flamencos-2d1n",
      portada: 1051,
      summary: "2 días con playa en Progreso y recorrido a la reserva de flamencos.",
      nights: 1,
      adultPrice: 3500,
      childPrice: 2100,
    },
  ];

  async run(dataSource: DataSource): Promise<void> {
    if (METACONFIG.server.isProduction) {
      console.warn("[playa-yucatan] Omitido en producción (datos de prueba).");
      return;
    }

    const [hotelCategory, agencyCategory, partnerRole] = await Promise.all([
      dataSource.getRepository(PartnerCategory).findOneBy({ code: "hotel" }),
      dataSource.getRepository(PartnerCategory).findOneBy({ code: "agency" }),
      dataSource.getRepository(Role).findOneBy({ code: RoleCode.PARTNER }),
    ]);

    if (!hotelCategory || !agencyCategory || !partnerRole) {
      console.warn("[playa-yucatan] Faltan categorías o el rol partner. Se omite.");
      return;
    }

    const regiones = new Map<Zona, Region>();
    for (const [zona, datos] of Object.entries(REGIONES) as Array<[Zona, RegionSeed]>) {
      const region = await this.ensureRegion(dataSource, datos);
      if (region !== null) {
        regiones.set(zona, region);
      }
    }

    for (const hotel of PlayaYucatanSeeder.HOTELES) {
      const region = regiones.get(hotel.zona);
      if (region === undefined || region.id === undefined) {
        continue;
      }
      await this.seedHotel(dataSource, hotel, hotelCategory.id, partnerRole.id, region.id);
    }

    for (const agencia of PlayaYucatanSeeder.AGENCIAS) {
      const region = regiones.get(agencia.zona);
      if (region === undefined || region.id === undefined) {
        continue;
      }
      await this.seedAgency(dataSource, agencia, agencyCategory.id, partnerRole.id, region.id);
    }
  }

  private async ensureRegion(dataSource: DataSource, datos: RegionSeed): Promise<Region | null> {
    const regionRepo = dataSource.getRepository(Region);
    const existente = await regionRepo.findOneBy({ slug: datos.slug });
    if (existente) {
      const actuales = existente.aliases ?? [];
      const faltantes = datos.aliases.filter((a) => !actuales.includes(a));
      if (faltantes.length > 0) {
        existente.aliases = [...actuales, ...faltantes];
        return regionRepo.save(existente);
      }
      return existente;
    }

    const estado = await dataSource.getRepository(State).findOneBy({ code: datos.stateCode });
    if (!estado) {
      console.warn(`[playa-yucatan] Falta el estado ${datos.stateCode}. Se omite ${datos.name}.`);
      return null;
    }

    return regionRepo.save(
      regionRepo.create({
        stateId: estado.id,
        parentId: null,
        type: RegionType.MUNICIPALITY,
        name: datos.name,
        slug: datos.slug,
        aliases: datos.aliases,
        lat: datos.lat,
        lng: datos.lng,
        status: RegionStatus.ACTIVE,
      })
    );
  }

  private async seedHotel(
    dataSource: DataSource,
    hotel: HotelSeed,
    categoryId: string,
    roleId: string,
    regionId: string
  ): Promise<void> {
    const partner = await this.ensurePartner(dataSource, {
      slug: hotel.slug,
      categoryId,
      regionId,
      commercialName: hotel.commercialName,
      legalName: hotel.legalName,
      description: hotel.description,
      address: hotel.address,
      contactEmail: hotel.email,
      contactName: hotel.commercialName,
      logoId: hotel.logo,
    });

    await this.ensureOwner(dataSource, {
      partnerId: partner.id,
      roleId,
      email: hotel.email,
      name: `${hotel.commercialName} (responsable)`,
    });

    for (const cuarto of hotel.rooms) {
      const roomType = await this.ensureRoomType(dataSource, partner.id, cuarto);
      await this.seedInventory(dataSource, roomType);
    }
  }

  private async seedAgency(
    dataSource: DataSource,
    agencia: AgencySeed,
    categoryId: string,
    roleId: string,
    regionId: string
  ): Promise<void> {
    const partner = await this.ensurePartner(dataSource, {
      slug: agencia.slug,
      categoryId,
      regionId,
      commercialName: agencia.commercialName,
      legalName: agencia.legalName,
      description: agencia.description,
      address: agencia.address,
      contactEmail: agencia.email,
      contactName: agencia.commercialName,
      logoId: agencia.logo,
    });

    await this.ensureOwner(dataSource, {
      partnerId: partner.id,
      roleId,
      email: agencia.email,
      name: `${agencia.commercialName} (responsable)`,
    });

    await this.ensurePackage(dataSource, partner.id, regionId, agencia);
  }

  /** Logo del socio: una foto concreta de picsum, no aleatoria. */
  private logoDe(id: number): string {
    return `https://picsum.photos/id/${id}/400/400`;
  }

  private async ensurePartner(
    dataSource: DataSource,
    datos: {
      slug: string;
      categoryId: string;
      regionId: string;
      commercialName: string;
      legalName: string;
      description: string;
      address: string;
      contactEmail: string;
      contactName: string;
      logoId: number;
    }
  ): Promise<Partner> {
    const repo = dataSource.getRepository(Partner);
    const existente = await repo.findOneBy({ slug: datos.slug });
    if (existente) {
      // Los socios creados antes de este cambio no tienen logo: se completa.
      const logo = this.logoDe(datos.logoId);
      if (existente.logoUrl !== logo) {
        existente.logoUrl = logo;
        return repo.save(existente);
      }
      return existente;
    }

    return repo.save(
      repo.create({
        categoryId: datos.categoryId,
        regionId: datos.regionId,
        commercialName: datos.commercialName,
        legalName: datos.legalName,
        slug: datos.slug,
        logoUrl: this.logoDe(datos.logoId),
        description: datos.description,
        address: datos.address,
        contactName: datos.contactName,
        contactEmail: datos.contactEmail,
        contactPhone: "+529841234567",
        status: PartnerStatus.ACTIVE,
        approvedAt: new Date(),
      })
    );
  }

  private async ensureOwner(
    dataSource: DataSource,
    datos: { partnerId: string; roleId: string; email: string; name: string }
  ): Promise<void> {
    const userRepo = dataSource.getRepository(User);
    const linkRepo = dataSource.getRepository(PartnerUser);

    let user = await userRepo.findOneBy({ email: datos.email });
    if (!user) {
      user = await userRepo.save(
        userRepo.create({
          roleId: datos.roleId,
          name: datos.name,
          email: datos.email,
          phone: null,
          passwordHash: await PasswordService.hash(PlayaYucatanSeeder.PASSWORD),
          status: UserStatus.ACTIVE,
          mustChangePassword: false,
        })
      );
    }

    const link = await linkRepo.findOneBy({ partnerId: datos.partnerId, userId: user.id });
    if (!link) {
      await linkRepo.save(
        linkRepo.create({
          partnerId: datos.partnerId,
          userId: user.id,
          role: PartnerUserRole.OWNER,
          isActive: true,
        })
      );
    }
  }

  /** Foto propia si la trae; si no, una de las cuatro, estable por nombre. */
  private fotoDeHabitacion(cuarto: RoomSeed): string {
    if (cuarto.fotoUrl) {
      return cuarto.fotoUrl;
    }

    const fotos = PlayaYucatanSeeder.FOTOS_HABITACION;
    const suma = [...cuarto.name].reduce((total, letra) => total + letra.charCodeAt(0), 0);
    return fotos[suma % fotos.length] ?? fotos[0] ?? "";
  }

  private async ensureRoomType(
    dataSource: DataSource,
    partnerId: string,
    cuarto: RoomSeed
  ): Promise<RoomType> {
    const repo = dataSource.getRepository(RoomType);
    const imagen = this.fotoDeHabitacion(cuarto);
    const existente = await repo.findOneBy({ partnerId, name: cuarto.name });

    if (existente) {
      if (existente.images[0] !== imagen) {
        existente.images = [imagen];
        return repo.save(existente);
      }
      return existente;
    }

    return repo.save(
      repo.create({
        partnerId,
        name: cuarto.name,
        description: cuarto.description,
        maxAdults: cuarto.maxAdults,
        maxChildren: cuarto.maxChildren,
        totalUnits: cuarto.totalUnits,
        basePrice: cuarto.basePrice,
        amenities: cuarto.amenities,
        images: [imagen],
        isActive: true,
      })
    );
  }

  /** Tarifa propia para los proximos 90 dias, para que el bot pueda cotizar. */
  private async seedInventory(dataSource: DataSource, roomType: RoomType): Promise<void> {
    const repo = dataSource.getRepository(RoomInventory);
    const filas = Array.from({ length: 90 }, (_, indice) => ({
      roomTypeId: roomType.id,
      date: new Date(Date.now() + (indice + 1) * 86_400_000).toISOString().slice(0, 10),
      units: roomType.totalUnits,
      price: roomType.basePrice,
      isClosed: indice % 30 === 29,
    }));

    await repo.upsert(filas, ["roomTypeId", "date"]);
  }

  private async ensurePackage(
    dataSource: DataSource,
    partnerId: string,
    regionId: string,
    agencia: AgencySeed
  ): Promise<void> {
    const packageRepo = dataSource.getRepository(Package);
    const imagen = `https://picsum.photos/id/${agencia.portada}/1200/800`;
    const existente = await packageRepo.findOneBy({ slug: agencia.packageSlug });
    if (existente) {
      if (existente.images[0] !== imagen) {
        existente.images = [imagen];
        await packageRepo.save(existente);
      }
      return;
    }

    const fecha = (dias: number): string =>
      new Date(Date.now() + dias * 86_400_000).toISOString().slice(0, 10);

    const paquete = await packageRepo.save(
      packageRepo.create({
        partnerId,
        destinationRegionId: regionId,
        name: agencia.packageName,
        slug: agencia.packageSlug,
        summary: agencia.summary,
        description: `${agencia.summary} Operado por ${agencia.commercialName}.`,
        nights: agencia.nights,
        minTravelers: 1,
        maxTravelers: 12,
        childMinAge: 4,
        childMaxAge: 11,
        meetingPoint: "Lobby del hotel",
        requirements: "Identificación oficial vigente.",
        cancellationPolicy:
          "Cancelación gratuita hasta 7 días antes. Menos de 48 horas no reembolsable.",
        taxesIncluded: true,
        images: [imagen],
        status: PackageStatus.PUBLISHED,
      })
    );

    await dataSource.getRepository(PackageItem).save(
      dataSource.getRepository(PackageItem).create([
        {
          packageId: paquete.id,
          type: PackageItemType.LODGING,
          description: `${agencia.nights} noches de hospedaje`,
          isIncluded: true,
          sortOrder: 1,
        },
        {
          packageId: paquete.id,
          type: PackageItemType.MEALS,
          description: "Desayunos diarios y una comida regional",
          isIncluded: true,
          sortOrder: 2,
        },
        {
          packageId: paquete.id,
          type: PackageItemType.TRANSPORT,
          description: "Traslados locales en van con aire acondicionado",
          isIncluded: true,
          sortOrder: 3,
        },
        {
          packageId: paquete.id,
          type: PackageItemType.OTHER,
          description: "Vuelos, propinas y gastos personales",
          isIncluded: false,
          sortOrder: 4,
        },
      ])
    );

    const dias = Array.from({ length: agencia.nights + 1 }, (_, indice) => ({
      packageId: paquete.id,
      dayNumber: indice + 1,
      title: indice === 0 ? "Llegada" : indice === agencia.nights ? "Regreso" : `Día ${indice + 1}`,
      description:
        indice === 0
          ? "Recepción, traslado y check-in. Tarde libre."
          : indice === agencia.nights
            ? "Desayuno, check-out y traslado de regreso."
            : "Actividades guiadas incluidas según itinerario.",
    }));

    await dataSource.getRepository(PackageItineraryDay).save(
      dataSource.getRepository(PackageItineraryDay).create(dias)
    );

    await dataSource.getRepository(PackageDeparture).save(
      dataSource.getRepository(PackageDeparture).create([
        {
          packageId: paquete.id,
          departureDate: fecha(15),
          totalSeats: 20,
          soldSeats: 0,
          adultPrice: agencia.adultPrice,
          childPrice: agencia.childPrice,
          status: DepartureStatus.OPEN,
        },
        {
          packageId: paquete.id,
          departureDate: fecha(30),
          totalSeats: 16,
          soldSeats: 0,
          adultPrice: agencia.adultPrice,
          childPrice: agencia.childPrice,
          status: DepartureStatus.OPEN,
        },
      ])
    );
  }
}
