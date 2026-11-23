import type { Request, Response } from "express";
import { ApiResponse } from "../../../core/http/ApiResponse.js";
import {
  paginationSchema,
  toPaginationMeta,
} from "../../../core/http/pagination.js";
import { BadRequestError } from "../../../core/errors/index.js";
import {
  createExperienceSchema,
  createSlotSchema,
  experienceAvailabilityQuerySchema,
  experienceListQuerySchema,
  updateExperienceSchema,
  updateSlotSchema,
} from "../dto/index.js";
import { ExperienceService } from "../services/ExperienceService.js";

export class ExperienceController {
  private readonly experienceService = new ExperienceService();

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

  public list = async (req: Request, res: Response): Promise<void> => {
    const query = experienceListQuerySchema.parse(req.query);
    const { items, total } = await this.experienceService.listPublic(
      {
        partnerId: query.partnerId,
        regionId: query.regionId,
        search: query.search,
      },
      query
    );

    ApiResponse.paginated(
      res,
      items,
      toPaginationMeta(total, query.page, query.limit),
      "Experiencias obtenidas correctamente"
    );
  };

  public listMine = async (req: Request, res: Response): Promise<void> => {
    const pagination = paginationSchema.parse(req.query);
    const { items, total } = await this.experienceService.listMine(
      req.user!,
      pagination
    );

    ApiResponse.paginated(
      res,
      items,
      toPaginationMeta(total, pagination.page, pagination.limit),
      "Experiencias del operador obtenidas correctamente"
    );
  };

  public availability = async (req: Request, res: Response): Promise<void> => {
    const query = experienceAvailabilityQuerySchema.parse(req.query);
    const { items, total } =
      await this.experienceService.searchAvailability(query);

    ApiResponse.paginated(
      res,
      items,
      toPaginationMeta(total, query.page, query.limit),
      "Turnos disponibles obtenidos correctamente"
    );
  };

  public getById = async (req: Request, res: Response): Promise<void> => {
    const id = this.getParam(req, "id");
    const data = await this.experienceService.getById(id, req.user);

    ApiResponse.ok(res, data, "Experiencia obtenida correctamente");
  };

  public create = async (req: Request, res: Response): Promise<void> => {
    const dto = createExperienceSchema.parse(req.body ?? {});
    const data = await this.experienceService.create(req.user!, dto);

    ApiResponse.created(res, data, "Experiencia creada correctamente");
  };

  public update = async (req: Request, res: Response): Promise<void> => {
    const id = this.getParam(req, "id");
    const dto = updateExperienceSchema.parse(req.body ?? {});
    const data = await this.experienceService.update(id, req.user!, dto);

    ApiResponse.ok(res, data, "Experiencia actualizada correctamente");
  };

  public addSlot = async (req: Request, res: Response): Promise<void> => {
    const id = this.getParam(req, "id");
    const dto = createSlotSchema.parse(req.body ?? {});
    const data = await this.experienceService.addSlot(id, req.user!, dto);

    ApiResponse.created(res, data, "Turno agregado correctamente");
  };

  public updateSlot = async (req: Request, res: Response): Promise<void> => {
    const id = this.getParam(req, "id");
    const slotId = this.getParam(req, "slotId");
    const dto = updateSlotSchema.parse(req.body ?? {});
    const data = await this.experienceService.updateSlot(
      id,
      slotId,
      req.user!,
      dto
    );

    ApiResponse.ok(res, data, "Turno actualizado correctamente");
  };
}
