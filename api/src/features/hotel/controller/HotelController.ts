import type { Request, Response } from "express";
import { ApiResponse } from "../../../core/http/ApiResponse.js";
import {
  paginationSchema,
  toPaginationMeta,
} from "../../../core/http/pagination.js";
import { BadRequestError } from "../../../core/errors/index.js";
import {
  availabilityQuerySchema,
  createRoomTypeSchema,
  inventoryQuerySchema,
  inventoryRangeSchema,
  roomTypeListQuerySchema,
  updateRoomTypeSchema,
} from "../dto/index.js";
import { HotelService } from "../services/HotelService.js";

export class HotelController {
  private readonly hotelService = new HotelService();

  private getParam(req: Request, paramName: string): string {
    const value = req.params[paramName];
    if (!value || typeof value !== "string") {
      throw new BadRequestError(
        `El parámetro '${paramName}' es requerido`,
        "PARAM_REQUIRED"
      );
    }
    return value;
  }

  public listRoomTypes = async (req: Request, res: Response): Promise<void> => {
    const query = roomTypeListQuerySchema.parse(req.query);
    const { items, total } = await this.hotelService.listPublic(
      {
        partnerId: query.partnerId,
        regionId: query.regionId,
        guests: query.guests,
      },
      query
    );

    ApiResponse.paginated(
      res,
      items,
      toPaginationMeta(total, query.page, query.limit),
      "Habitaciones obtenidas correctamente"
    );
  };

  public listMine = async (req: Request, res: Response): Promise<void> => {
    const pagination = paginationSchema.parse(req.query);
    const { items, total } = await this.hotelService.listMine(
      req.user!,
      pagination
    );

    ApiResponse.paginated(
      res,
      items,
      toPaginationMeta(total, pagination.page, pagination.limit),
      "Habitaciones del hotel obtenidas correctamente"
    );
  };

  public create = async (req: Request, res: Response): Promise<void> => {
    const dto = createRoomTypeSchema.parse(req.body ?? {});
    const data = await this.hotelService.create(req.user!, dto);

    ApiResponse.created(res, data, "Tipo de habitación creado correctamente");
  };

  public update = async (req: Request, res: Response): Promise<void> => {
    const id = this.getParam(req, "id");
    const dto = updateRoomTypeSchema.parse(req.body ?? {});
    const data = await this.hotelService.update(id, req.user!, dto);

    ApiResponse.ok(res, data, "Tipo de habitación actualizado correctamente");
  };

  public upsertInventory = async (
    req: Request,
    res: Response
  ): Promise<void> => {
    const id = this.getParam(req, "id");
    const dto = inventoryRangeSchema.parse(req.body ?? {});
    const data = await this.hotelService.upsertInventory(id, req.user!, dto);

    ApiResponse.ok(
      res,
      data,
      `Inventario actualizado (${data.created} nuevas, ${data.updated} existentes)`
    );
  };

  public listInventory = async (req: Request, res: Response): Promise<void> => {
    const id = this.getParam(req, "id");
    const query = inventoryQuerySchema.parse(req.query);
    const data = await this.hotelService.listInventory(
      id,
      req.user!,
      query.from,
      query.to
    );

    ApiResponse.ok(res, data, "Inventario obtenido correctamente");
  };

  public availability = async (req: Request, res: Response): Promise<void> => {
    const query = availabilityQuerySchema.parse(req.query);
    const { items, total } = await this.hotelService.searchAvailability(query);

    ApiResponse.paginated(
      res,
      items,
      toPaginationMeta(total, query.page, query.limit),
      "Disponibilidad obtenida correctamente"
    );
  };
}
