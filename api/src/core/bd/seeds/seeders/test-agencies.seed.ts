import bcrypt from "bcryptjs";
import { DataSource } from "typeorm";
import { Seed } from "../utils/seed.decorator.js";
import type { Seeder } from "../types/index.js";
import { METACONFIG } from "../../../metaconfig/index.js";

// Entidades (ajusta el sufijo .entity.js si alguna de tus entidades lo usa)
import { State } from "../../entities/State.entity.js";
import { Region, RegionStatus, RegionType } from "../../entities/Region.entity.js";
import { PartnerCategory } from "../../entities/PartnerCategory.js";
import { Partner, PartnerStatus } from "../../entities/Partner.js";
import { Role } from "../../entities/Role.js";
import { User, UserStatus } from "../../entities/User.js";
import { PartnerUser, PartnerUserRole } from "../../entities/PartnerUser.js";
import { Package, PackageStatus } from "../../entities/Package.js";
import { PackageItem, PackageItemType } from "../../entities/PackageItem.js";
import { PackageItineraryDay } from "../../entities/PackageItineraryDay.js";
import { PackageDeparture, DepartureStatus } from "../../entities/PackageDeparture.js";
import {
  PackagePromotion,
  DiscountType,
  PromotionStatus,
} from "../../entities/PackagePromotion.js";

@Seed({ name: "test-agencies", order: 6 })
export class TestAgenciesSeeder implements Seeder {
  async run(dataSource: DataSource): Promise<void> {
    if (METACONFIG.server.isProduction) {
      console.warn("[test-agencies] Omitido en producción (datos de prueba).");
      return;
    }

    // 1. Obtener dependencias previas (cargadas en orders 1, 3 y 4)
    const stateRepo = dataSource.getRepository(State);
    const categoryRepo = dataSource.getRepository(PartnerCategory);
    const roleRepo = dataSource.getRepository(Role);
    const regionRepo = dataSource.getRepository(Region);

    const agencyCategory = await categoryRepo.findOneBy({ code: "agency" });
    const partnerRole = await roleRepo.findOneBy({ code: "partner" });

    // Toma el primer municipio activo o crea Benito Juárez (Cancún) si aún no hay municipios
    let defaultRegion = await regionRepo.findOneBy({
      type: RegionType.MUNICIPALITY,
      status: RegionStatus.ACTIVE,
    });

    if (!defaultRegion) {
      const qroo = await stateRepo.findOneBy({ code: "23" }); // Quintana Roo
      if (!qroo) {
        console.warn(
          "[test-agencies] No existe el estado 23 (Quintana Roo). Se omite seeder."
        );
        return;
      }

      if (!qroo.isActive) {
        qroo.isActive = true;
        await stateRepo.save(qroo);
      }

      defaultRegion = regionRepo.create({
        stateId: qroo.id,
        parentId: null,
        type: RegionType.MUNICIPALITY,
        name: "Benito Juárez",
        slug: "benito-juarez",
        aliases: ["Cancun", "Cancún", "CUN"],
        lat: 21.161908,
        lng: -86.8515279,
        status: RegionStatus.ACTIVE,
      });
      defaultRegion = await regionRepo.save(defaultRegion);
    }

    if (!agencyCategory || !partnerRole || !defaultRegion) {
      console.warn(
        "[test-agencies] Faltan catálogos base (agency, partner o región activa). Se omite seeder."
      );
      return;
    }

    await dataSource.transaction(async (manager) => {
      const partnerRepo = manager.getRepository(Partner);
      const userRepo = manager.getRepository(User);
      const partnerUserRepo = manager.getRepository(PartnerUser);
      const packageRepo = manager.getRepository(Package);
      const itemRepo = manager.getRepository(PackageItem);
      const itineraryRepo = manager.getRepository(PackageItineraryDay);
      const departureRepo = manager.getRepository(PackageDeparture);
      const promoRepo = manager.getRepository(PackagePromotion);

      // ---------------------------------------------------------
      // 2. CREAR / OBTENER AGENCIA DE PRUEBA (Partner)
      // ---------------------------------------------------------
      const agencySlug = "caribe-maya-tours-test";
      let partner = await partnerRepo.findOneBy({ slug: agencySlug });

      if (!partner) {
        partner = partnerRepo.create({
          categoryId: agencyCategory.id,
          regionId: defaultRegion.id,
          commercialName: "Caribe Maya Tours (Test)",
          legalName: "Operadora Turística Caribe Maya S.A. de C.V.",
          slug: agencySlug,
          description:
            "Agencia receptiva especializada en circuitos culturales, cenotes y escapadas todo incluido.",
          address: "Av. Tulum 245, Supermanzana 4, Centro",
          lat: 21.161908,
          lng: -86.8515279,
          contactName: "Laura Méndez",
          contactEmail: "contacto@caribemayatest.com",
          contactPhone: "+529981234567",
          status: PartnerStatus.ACTIVE,
          approvedAt: new Date(),
        });
        partner = await partnerRepo.save(partner);
      }

      // ---------------------------------------------------------
      // 3. CREAR USUARIO ENCARGADO (User) Y VINCULAR (PartnerUser)
      // ---------------------------------------------------------
      const ownerEmail = "agencia.test@plataforma.com";
      let ownerUser = await userRepo.findOneBy({ email: ownerEmail });

      if (!ownerUser) {
        const passwordHash = await bcrypt.hash("Test1234!", 10);
        ownerUser = userRepo.create({
          roleId: partnerRole.id,
          name: "Laura Méndez (Owner Test)",
          email: ownerEmail,
          phone: "+529981234567",
          passwordHash,
          status: UserStatus.ACTIVE,
          mustChangePassword: false,
        });
        ownerUser = await userRepo.save(ownerUser);
      }

      const existingLink = await partnerUserRepo.findOneBy({
        partnerId: partner.id,
        userId: ownerUser.id,
      });

      if (!existingLink) {
        const link = partnerUserRepo.create({
          partnerId: partner.id,
          userId: ownerUser.id,
          role: PartnerUserRole.OWNER,
          isActive: true,
        });
        await partnerUserRepo.save(link);
      }

      // ---------------------------------------------------------
      // 4. CREAR PAQUETE TURÍSTICO COMPLETO (Package + Hijos)
      // ---------------------------------------------------------
      const pkgSlug = "escapada-caribena-cenotes-4d3n";
      const existingPkg = await packageRepo.findOneBy({ slug: pkgSlug });

      if (!existingPkg) {
        const newPkg = packageRepo.create({
          partnerId: partner.id,
          destinationRegionId: defaultRegion.id,
          name: "Escapada Caribeña y Ruta de Cenotes",
          slug: pkgSlug,
          summary:
            "4 días y 3 noches con hotel céntrico, tour a Chichén Itzá, cenote sagrado y traslados aeropuerto.",
          description:
            "Disfruta del Caribe mexicano combinando descanso en playa con cultura maya. Incluye recepción en aeropuerto, hospedaje con desayunos y excursión de día completo con guía certificado.",
          nights: 3,
          minTravelers: 1,
          maxTravelers: 12,
          childMinAge: 4,
          childMaxAge: 11,
          meetingPoint: "Lobby del hotel / Terminal de llegadas Aeropuerto",
          requirements:
            "Identificación oficial vigente. Uso de bloqueador biodegradable obligatorio en cenotes.",
          cancellationPolicy:
            "Cancelación gratuita hasta 7 días antes de la salida. Entre 6 y 3 días aplica penalización del 30%. Menos de 48 horas no reembolsable.",
          taxesIncluded: true,
          images: [
            "https://picsum.photos/seed/escapada-caribena/1200/800",
          ],
          status: PackageStatus.PUBLISHED,
        });
        const savedPkg = await packageRepo.save(newPkg);

        // 4.1 Ítems incluidos y no incluidos (PackageItem)
        const items = itemRepo.create([
          {
            packageId: savedPkg.id,
            type: PackageItemType.LODGING,
            description: "3 noches de hospedaje en hotel 4 estrellas categoría estándar",
            isIncluded: true,
            sortOrder: 1,
          },
          {
            packageId: savedPkg.id,
            type: PackageItemType.MEALS,
            description: "Desayunos tipo buffet diarios y 1 comida regional en tour",
            isIncluded: true,
            sortOrder: 2,
          },
          {
            packageId: savedPkg.id,
            type: PackageItemType.TRANSPORT,
            description: "Traslados redondos Aeropuerto - Hotel - Aeropuerto en van con A/C",
            isIncluded: true,
            sortOrder: 3,
          },
          {
            packageId: savedPkg.id,
            type: PackageItemType.ACTIVITY,
            description: "Entrada y recorrido guiado a zona arqueológica y cenote",
            isIncluded: true,
            sortOrder: 4,
          },
          {
            packageId: savedPkg.id,
            type: PackageItemType.OTHER,
            description: "Vuelos, propinas e impuesto de saneamiento ambiental local",
            isIncluded: false,
            sortOrder: 5,
          },
        ]);
        await itemRepo.save(items);

        // 4.2 Itinerario día por día (PackageItineraryDay)
        const itineraryDays = itineraryRepo.create([
          {
            packageId: savedPkg.id,
            dayNumber: 1,
            title: "Llegada y traslado al hotel",
            description:
              "Recepción en el aeropuerto con cartel personalizado, traslado al hotel, check-in y tarde libre para disfrutar la playa.",
          },
          {
            packageId: savedPkg.id,
            dayNumber: 2,
            title: "Expedición Maya y Cenote Sagrado",
            description:
              "Salida 07:30 AM hacia zona arqueológica con guía certificado, baño refrescante en cenote abierto y comida buffet tradicional.",
          },
          {
            packageId: savedPkg.id,
            dayNumber: 3,
            title: "Día libre o actividades opcionales",
            description:
              "Desayuno incluido. Día libre para compras en zona artesanal o contratación de tour opcional de snorkel.",
          },
          {
            packageId: savedPkg.id,
            dayNumber: 4,
            title: "Check-out y regreso",
            description:
              "Desayuno en el hotel, entrega de habitación a las 12:00 PM y traslado al aeropuerto 3 horas antes de su vuelo.",
          },
        ]);
        await itineraryRepo.save(itineraryDays);

        // 4.3 Salidas con precios y cupos (PackageDeparture - fechas YYYY-MM-DD)
        const formatDate = (daysFromNow: number): string => {
          const d = new Date();
          d.setDate(d.getDate() + daysFromNow);
          return d.toISOString().slice(0, 10);
        };

        const departures = departureRepo.create([
          {
            packageId: savedPkg.id,
            departureDate: formatDate(15),
            totalSeats: 20,
            soldSeats: 4,
            adultPrice: 6850.0,
            childPrice: 4200.0,
            status: DepartureStatus.OPEN,
          },
          {
            packageId: savedPkg.id,
            departureDate: formatDate(30),
            totalSeats: 20,
            soldSeats: 0,
            adultPrice: 7490.0,
            childPrice: 4650.0,
            status: DepartureStatus.OPEN,
          },
          {
            packageId: savedPkg.id,
            departureDate: formatDate(45),
            totalSeats: 15,
            soldSeats: 15,
            adultPrice: 7490.0,
            childPrice: 4650.0,
            status: DepartureStatus.CLOSED,
          },
        ]);
        await departureRepo.save(departures);

        // 4.4 Promoción activa (PackagePromotion)
        const promotion = promoRepo.create({
          packageId: savedPkg.id,
          name: "Descuento Reserva Anticipada (10%)",
          discountType: DiscountType.PERCENTAGE,
          discountValue: 10.0,
          validFrom: formatDate(0),
          validTo: formatDate(60),
          minTravelers: 2,
          daysOfWeek: [0, 1, 2, 3, 4, 5, 6],
          status: PromotionStatus.ACTIVE,
        });
        await promoRepo.save(promotion);
      }
    });
  }
}
