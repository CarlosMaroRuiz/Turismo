import { z } from "zod";
import { BaseRoutes } from "../../../core/routes/BaseRoutes.js";
import { AuthMiddleware } from "../../../core/middlewares/AuthMiddleware/index.js";
import { RoleCode } from "../../../core/bd/entities/Role.js";
import { paginationSchema } from "../../../core/http/pagination.js";
import { registerRoutes } from "../../../core/http/openapi/index.js";
import {
  createDepartureSchema,
  createPackageSchema,
  packageStatusSchema,
  updateDepartureSchema,
  updatePackageSchema,
} from "../dto/index.js";
import { PackageController } from "../controller/PackageController.js";
import { packageAvailabilityQuerySchema } from "../dto/availability.dto.js";

const listPackagesQuerySchema = paginationSchema.extend({
  regionId: z.string().uuid().optional(),
  partnerId: z.string().uuid().optional(),
  search: z.string().trim().max(100).optional(),
});

export class PackageRoutes extends BaseRoutes<PackageController> {
  constructor() {
    super(PackageController);
  }

  protected initRoutes(): void {
    // Catálogo público: solo paquetes publicados de socios activos
    this.router.get("/", this.controller.list);
    this.router.get("/availability", this.controller.availability);

    // Gestión del socio (cualquier estado). Debe ir antes de /:id
    this.router.get(
      "/mine",
      AuthMiddleware.authenticate,
      AuthMiddleware.authorizeRoles(RoleCode.SUPER_USER, RoleCode.PARTNER),
      this.controller.listMine
    );

    // Detalle público; con token, el dueño o el admin ven borradores
    this.router.get(
      "/:id",
      AuthMiddleware.optional,
      this.controller.getById
    );

    // Escritura: solo la agencia dueña (o el admin)
    this.router.post(
      "/",
      AuthMiddleware.authenticate,
      AuthMiddleware.authorizeRoles(RoleCode.SUPER_USER, RoleCode.PARTNER),
      this.controller.create
    );

    this.router.patch(
      "/:id",
      AuthMiddleware.authenticate,
      AuthMiddleware.authorizeRoles(RoleCode.SUPER_USER, RoleCode.PARTNER),
      this.controller.update
    );

    this.router.patch(
      "/:id/status",
      AuthMiddleware.authenticate,
      AuthMiddleware.authorizeRoles(RoleCode.SUPER_USER, RoleCode.PARTNER),
      this.controller.changeStatus
    );

    this.router.post(
      "/:id/departures",
      AuthMiddleware.authenticate,
      AuthMiddleware.authorizeRoles(RoleCode.SUPER_USER, RoleCode.PARTNER),
      this.controller.addDeparture
    );

    this.router.patch(
      "/:id/departures/:departureId",
      AuthMiddleware.authenticate,
      AuthMiddleware.authorizeRoles(RoleCode.SUPER_USER, RoleCode.PARTNER),
      this.controller.updateDeparture
    );

    registerRoutes("Paquetes", [
      {
        method: "get",
        path: "/api/v1/packages/availability",
        summary: "Salidas con cupo para el grupo en la fecha solicitada y fechas cercanas",
        auth: "none",
        query: packageAvailabilityQuerySchema,
      },
      {
        method: "get",
        path: "/api/v1/packages",
        summary:
          "Catálogo público de paquetes publicados, con filtros y precio mínimo",
        auth: "none",
        query: listPackagesQuerySchema,
      },
      {
        method: "get",
        path: "/api/v1/packages/mine",
        summary:
          "Paquetes del socio autenticado en cualquier estado (el admin ve todos)",
        auth: "user",
        roles: [RoleCode.SUPER_USER, RoleCode.PARTNER],
        query: paginationSchema,
      },
      {
        method: "get",
        path: "/api/v1/packages/:id",
        summary:
          "Detalle con ítems, itinerario, salidas y promociones; el dueño ve borradores",
        auth: "none",
      },
      {
        method: "post",
        path: "/api/v1/packages",
        summary: "Crea un paquete en borrador (solo agencias)",
        auth: "user",
        roles: [RoleCode.SUPER_USER, RoleCode.PARTNER],
        body: createPackageSchema,
        successStatus: 201,
      },
      {
        method: "patch",
        path: "/api/v1/packages/:id",
        summary:
          "Actualiza el paquete; items, itinerary y promotions reemplazan los existentes",
        auth: "user",
        roles: [RoleCode.SUPER_USER, RoleCode.PARTNER],
        body: updatePackageSchema,
      },
      {
        method: "patch",
        path: "/api/v1/packages/:id/status",
        summary:
          "Cambia el estado; publicar exige ítem incluido, itinerario y salida abierta con cupo",
        auth: "user",
        roles: [RoleCode.SUPER_USER, RoleCode.PARTNER],
        body: packageStatusSchema,
      },
      {
        method: "post",
        path: "/api/v1/packages/:id/departures",
        summary: "Agrega una fecha de salida con cupo y precios",
        auth: "user",
        roles: [RoleCode.SUPER_USER, RoleCode.PARTNER],
        body: createDepartureSchema,
        successStatus: 201,
      },
      {
        method: "patch",
        path: "/api/v1/packages/:id/departures/:departureId",
        summary: "Actualiza cupo, precios o estado de una salida",
        auth: "user",
        roles: [RoleCode.SUPER_USER, RoleCode.PARTNER],
        body: updateDepartureSchema,
      },
    ]);
  }
}
