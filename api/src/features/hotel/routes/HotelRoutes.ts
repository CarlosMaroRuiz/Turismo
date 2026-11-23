import { BaseRoutes } from "../../../core/routes/BaseRoutes.js";
import { AuthMiddleware } from "../../../core/middlewares/AuthMiddleware/index.js";
import { RoleCode } from "../../../core/bd/entities/Role.js";
import { paginationSchema } from "../../../core/http/pagination.js";
import { registerRoutes } from "../../../core/http/openapi/index.js";
import {
  availabilityQuerySchema,
  createRoomTypeSchema,
  inventoryQuerySchema,
  inventoryRangeSchema,
  roomTypeListQuerySchema,
  updateRoomTypeSchema,
} from "../dto/index.js";
import { HotelController } from "../controller/HotelController.js";

export class HotelRoutes extends BaseRoutes<HotelController> {
  constructor() {
    super(HotelController);
  }

  protected initRoutes(): void {
    // Catálogo público de habitaciones
    this.router.get("/room-types", this.controller.listRoomTypes);

    // Gestión del hotel (debe ir antes de las rutas con :id)
    this.router.get(
      "/room-types/mine",
      AuthMiddleware.authenticate,
      AuthMiddleware.authorizeRoles(RoleCode.SUPER_USER, RoleCode.PARTNER),
      this.controller.listMine
    );

    this.router.post(
      "/room-types",
      AuthMiddleware.authenticate,
      AuthMiddleware.authorizeRoles(RoleCode.SUPER_USER, RoleCode.PARTNER),
      this.controller.create
    );

    this.router.patch(
      "/room-types/:id",
      AuthMiddleware.authenticate,
      AuthMiddleware.authorizeRoles(RoleCode.SUPER_USER, RoleCode.PARTNER),
      this.controller.update
    );

    this.router.put(
      "/room-types/:id/inventory",
      AuthMiddleware.authenticate,
      AuthMiddleware.authorizeRoles(RoleCode.SUPER_USER, RoleCode.PARTNER),
      this.controller.upsertInventory
    );

    this.router.get(
      "/room-types/:id/inventory",
      AuthMiddleware.authenticate,
      AuthMiddleware.authorizeRoles(RoleCode.SUPER_USER, RoleCode.PARTNER),
      this.controller.listInventory
    );

    // Disponibilidad por fechas y huéspedes (insumo del cotizador y del agente)
    this.router.get("/availability", this.controller.availability);

    registerRoutes("Hoteles", [
      {
        method: "get",
        path: "/api/v1/hotels/room-types",
        summary:
          "Catálogo de habitaciones activas de hoteles activos, con filtros por destino y huéspedes",
        auth: "none",
        query: roomTypeListQuerySchema,
      },
      {
        method: "get",
        path: "/api/v1/hotels/room-types/mine",
        summary: "Habitaciones del hotel autenticado (el admin ve todas)",
        auth: "user",
        roles: [RoleCode.SUPER_USER, RoleCode.PARTNER],
        query: paginationSchema,
      },
      {
        method: "post",
        path: "/api/v1/hotels/room-types",
        summary: "Crea un tipo de habitación (solo hoteles)",
        auth: "user",
        roles: [RoleCode.SUPER_USER, RoleCode.PARTNER],
        body: createRoomTypeSchema,
        successStatus: 201,
      },
      {
        method: "patch",
        path: "/api/v1/hotels/room-types/:id",
        summary: "Actualiza capacidad, precio base, amenidades o estado",
        auth: "user",
        roles: [RoleCode.SUPER_USER, RoleCode.PARTNER],
        body: updateRoomTypeSchema,
      },
      {
        method: "put",
        path: "/api/v1/hotels/room-types/:id/inventory",
        summary:
          "Carga o actualiza el inventario de un rango de fechas (unidades, tarifa, cierre rápido)",
        auth: "user",
        roles: [RoleCode.SUPER_USER, RoleCode.PARTNER],
        body: inventoryRangeSchema,
      },
      {
        method: "get",
        path: "/api/v1/hotels/room-types/:id/inventory",
        summary: "Inventario del tipo de habitación en un rango de fechas",
        auth: "user",
        roles: [RoleCode.SUPER_USER, RoleCode.PARTNER],
        query: inventoryQuerySchema,
      },
      {
        method: "get",
        path: "/api/v1/hotels/availability",
        summary:
          "Disponibilidad por noches: capacidad, cierres, tarifa por fecha y total de la estancia",
        auth: "none",
        query: availabilityQuerySchema,
      },
    ]);
  }
}
