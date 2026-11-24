import { DataSource } from "typeorm";
import { Seed } from "../utils/seed.decorator.js";
import type { Seeder } from "../types/index.js";
import { METACONFIG } from "../../../metaconfig/index.js";
import { PasswordService } from "../../../security/PasswordService.js";
import { Partner, PartnerStatus } from "../../entities/Partner.js";
import { PartnerCategory } from "../../entities/PartnerCategory.js";
import { Region, RegionStatus, RegionType } from "../../entities/Region.entity.js";
import { State } from "../../entities/State.entity.js";
import { Role, RoleCode } from "../../entities/Role.js";
import { User, UserStatus } from "../../entities/User.js";
import { PartnerUser, PartnerUserRole } from "../../entities/PartnerUser.js";
import { RoomType } from "../../entities/RoomType.js";
import { RoomInventory } from "../../entities/RoomInventory.js";
import { Experience } from "../../entities/Experience.js";
import { ExperienceSlot, SlotStatus } from "../../entities/ExperienceSlot.js";

/**
 * Datos de demostración para el frontend: un hotel y un operador de atractivos
 * activos, con credenciales conocidas, habitaciones con inventario y una
 * experiencia con turnos. Nunca corre en producción.
 */
@Seed({ name: "demo-providers", order: 8 })
export class DemoProvidersSeeder implements Seeder {
  private static readonly HOTEL_EMAIL = "hotel.demo@plataforma.com";
  private static readonly HOTEL_PASSWORD = "Hotel1234!";
  private static readonly ATTRACTION_EMAIL = "atractivo.demo@plataforma.com";
  private static readonly ATTRACTION_PASSWORD = "Atractivo1234!";

  private static dateFromToday(days: number): string {
    return new Date(Date.now() + days * 86_400_000).toISOString().slice(0, 10);
  }

  async run(dataSource: DataSource): Promise<void> {
    if (METACONFIG.server.isProduction) {
      console.warn("[demo-providers] Omitido en producción.");
      return;
    }

    const region = await this.ensureRegion(dataSource);
    if (!region) {
      console.warn("[demo-providers] Sin región activa. Se omite.");
      return;
    }

    const categoryRepo = dataSource.getRepository(PartnerCategory);
    const roleRepo = dataSource.getRepository(Role);

    const [hotelCategory, attractionCategory, partnerRole] = await Promise.all([
      categoryRepo.findOneBy({ code: "hotel" }),
      categoryRepo.findOneBy({ code: "attraction" }),
      roleRepo.findOneBy({ code: RoleCode.PARTNER }),
    ]);

    if (!hotelCategory || !attractionCategory || !partnerRole) {
      console.warn(
        "[demo-providers] Faltan categorías o el rol partner. Se omite."
      );
      return;
    }

    const hotel = await this.ensurePartner(dataSource, {
      slug: "hotel-demo-playa",
      commercialName: "Hotel Demo Playa",
      legalName: "Hotel Demo Playa S.A. de C.V.",
      categoryId: hotelCategory.id,
      regionId: region.id,
      description:
        "Hotel de demostración con habitaciones frente al mar, desayuno incluido y spa.",
      address: "Blvd. Kukulcán Km 12, Zona Hotelera",
      logoUrl: "https://picsum.photos/seed/hotel-demo-logo/400/400",
    });

    await this.ensureOwner(dataSource, {
      partnerId: hotel.id,
      roleId: partnerRole.id,
      email: DemoProvidersSeeder.HOTEL_EMAIL,
      password: DemoProvidersSeeder.HOTEL_PASSWORD,
      name: "Owner Hotel Demo",
    });

    const doubleRoom = await this.ensureRoomType(dataSource, hotel.id, {
      name: "Doble estándar",
      description: "Habitación con dos camas queen, balcón y desayuno buffet.",
      maxAdults: 2,
      maxChildren: 1,
      totalUnits: 5,
      basePrice: 1500,
      amenities: ["wifi", "desayuno", "aire acondicionado", "alberca"],
      images: [
        "https://images.unsplash.com/photo-1618773928121-c32242e63f39?q=80&w=1170&auto=format&fit=crop&ixlib=rb-4.1.0&ixid=NHwxMjA3fDA%3D",
        "https://images.unsplash.com/photo-1611892440504-42a792e24d32?q=80&w=1170&auto=format&fit=crop&ixlib=rb-4.1.0&ixid=NHwxMjA3fDA%3D",
      ],
    });

    const suiteRoom = await this.ensureRoomType(dataSource, hotel.id, {
      name: "Suite familiar",
      description: "Suite con sala, dos habitaciones y vista al mar.",
      maxAdults: 4,
      maxChildren: 2,
      totalUnits: 3,
      basePrice: 2400,
      amenities: ["wifi", "desayuno", "cocina", "vista al mar"],
      images: ["https://images.unsplash.com/photo-1631049307264-da0ec9d70304?q=80&w=1170&auto=format&fit=crop&ixlib=rb-4.1.0&ixid=NHwxMjA3fDA%3D"],
    });

    await this.seedInventory(dataSource, doubleRoom, 1500, 4);
    await this.seedInventory(dataSource, suiteRoom, 2400, 2);

    const attraction = await this.ensurePartner(dataSource, {
      slug: "atractivos-demo",
      commercialName: "Atractivos Demo",
      legalName: "Atractivos Demo S.A. de C.V.",
      categoryId: attractionCategory.id,
      regionId: region.id,
      description:
        "Operador de demostración con tours culturales, cenotes y experiencias gastronómicas.",
      address: "Av. Tulum 210, Centro",
      logoUrl: "https://picsum.photos/seed/atractivo-demo-logo/400/400",
    });

    await this.ensureOwner(dataSource, {
      partnerId: attraction.id,
      roleId: partnerRole.id,
      email: DemoProvidersSeeder.ATTRACTION_EMAIL,
      password: DemoProvidersSeeder.ATTRACTION_PASSWORD,
      name: "Owner Atractivos Demo",
    });

    const experience = await this.ensureExperience(
      dataSource,
      attraction.id,
      region.id
    );

    await this.seedSlots(dataSource, experience.id);
  }

  private async ensureRegion(dataSource: DataSource): Promise<Region | null> {
    const regionRepo = dataSource.getRepository(Region);
    const existing = await regionRepo.findOneBy({
      type: RegionType.MUNICIPALITY,
      status: RegionStatus.ACTIVE,
    });

    if (existing) {
      return existing;
    }

    const state = await dataSource
      .getRepository(State)
      .findOneBy({ code: "23" });

    if (!state) {
      return null;
    }

    const created = regionRepo.create({
      stateId: state.id,
      parentId: null,
      type: RegionType.MUNICIPALITY,
      name: "Benito Juárez",
      slug: "benito-juarez",
      aliases: ["Cancun", "Cancún", "CUN"],
      lat: 21.161908,
      lng: -86.8515279,
      status: RegionStatus.ACTIVE,
    });

    return regionRepo.save(created);
  }

  private async ensurePartner(
    dataSource: DataSource,
    data: {
      slug: string;
      commercialName: string;
      legalName: string;
      categoryId: string;
      regionId: string;
      description: string;
      address: string;
      logoUrl: string;
    }
  ): Promise<Partner> {
    const repo = dataSource.getRepository(Partner);
    const existing = await repo.findOneBy({ slug: data.slug });

    if (existing) {
      return existing;
    }

    return repo.save(
      repo.create({
        categoryId: data.categoryId,
        regionId: data.regionId,
        commercialName: data.commercialName,
        legalName: data.legalName,
        slug: data.slug,
        logoUrl: data.logoUrl,
        description: data.description,
        address: data.address,
        lat: 21.161908,
        lng: -86.8515279,
        contactName: "Contacto Demo",
        contactEmail: `contacto@${data.slug}.demo`,
        contactPhone: "+529981234567",
        status: PartnerStatus.ACTIVE,
        statusReason: null,
        approvedAt: new Date(),
      })
    );
  }

  private async ensureOwner(
    dataSource: DataSource,
    data: {
      partnerId: string;
      roleId: string;
      email: string;
      password: string;
      name: string;
    }
  ): Promise<void> {
    const userRepo = dataSource.getRepository(User);
    const linkRepo = dataSource.getRepository(PartnerUser);

    let user = await userRepo.findOneBy({ email: data.email });

    if (!user) {
      user = await userRepo.save(
        userRepo.create({
          roleId: data.roleId,
          name: data.name,
          email: data.email,
          phone: null,
          passwordHash: await PasswordService.hash(data.password),
          status: UserStatus.ACTIVE,
          mustChangePassword: false,
        })
      );
    }

    const link = await linkRepo.findOneBy({
      partnerId: data.partnerId,
      userId: user.id,
    });

    if (!link) {
      await linkRepo.save(
        linkRepo.create({
          partnerId: data.partnerId,
          userId: user.id,
          role: PartnerUserRole.OWNER,
          isActive: true,
        })
      );
    }
  }

  private async ensureRoomType(
    dataSource: DataSource,
    partnerId: string,
    data: {
      name: string;
      description: string;
      maxAdults: number;
      maxChildren: number;
      totalUnits: number;
      basePrice: number;
      amenities: string[];
      images: string[];
    }
  ): Promise<RoomType> {
    const repo = dataSource.getRepository(RoomType);
    const existing = await repo.findOneBy({ partnerId, name: data.name });

    if (existing) {
      // Las fotos del demo se actualizan si el catalogo cambio.
      if (data.images[0] !== undefined && existing.images[0] !== data.images[0]) {
        existing.images = data.images;
        return repo.save(existing);
      }
      return existing;
    }

    return repo.save(
      repo.create({
        partnerId,
        name: data.name,
        description: data.description,
        maxAdults: data.maxAdults,
        maxChildren: data.maxChildren,
        totalUnits: data.totalUnits,
        basePrice: data.basePrice,
        amenities: data.amenities,
        images: data.images,
        isActive: true,
      })
    );
  }

  private async seedInventory(
    dataSource: DataSource,
    roomType: RoomType,
    price: number,
    units: number
  ): Promise<void> {
    const repo = dataSource.getRepository(RoomInventory);
    const rows = Array.from({ length: 60 }, (_, index) => ({
      roomTypeId: roomType.id,
      date: DemoProvidersSeeder.dateFromToday(index + 1),
      units,
      price,
      isClosed: false,
    }));

    await repo.upsert(rows, ["roomTypeId", "date"]);
  }

  private async ensureExperience(
    dataSource: DataSource,
    partnerId: string,
    regionId: string
  ): Promise<Experience> {
    const repo = dataSource.getRepository(Experience);
    const existing = await repo.findOneBy({ slug: "ruta-del-cacao-demo" });

    if (existing) {
      return existing;
    }

    return repo.save(
      repo.create({
        partnerId,
        regionId,
        name: "Ruta del Cacao",
        slug: "ruta-del-cacao-demo",
        description:
          "Recorrido guiado por una hacienda cacaotera: historia, proceso artesanal y degustación final.",
        durationMinutes: 180,
        minAge: 6,
        priceAdult: 850,
        priceChild: 450,
        requirements: "Calzado cómodo y bloqueador biodegradable.",
        images: [
          "https://picsum.photos/seed/cacao-1/1200/800",
          "https://picsum.photos/seed/cacao-2/1200/800",
        ],
        isActive: true,
      })
    );
  }

  private async seedSlots(
    dataSource: DataSource,
    experienceId: string
  ): Promise<void> {
    const repo = dataSource.getRepository(ExperienceSlot);
    const rows: Array<{
      experienceId: string;
      date: string;
      startTime: string;
      capacity: number;
      status: SlotStatus;
    }> = [];

    for (let day = 1; day <= 14; day += 1) {
      for (const startTime of ["09:00", "13:00"]) {
        rows.push({
          experienceId,
          date: DemoProvidersSeeder.dateFromToday(day),
          startTime,
          capacity: 8,
          status: SlotStatus.OPEN,
        });
      }
    }

    await repo.upsert(rows, ["experienceId", "date", "startTime"]);
  }
}
