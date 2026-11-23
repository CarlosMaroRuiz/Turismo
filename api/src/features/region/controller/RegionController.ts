import type { Request, Response } from "express";
import { ApiResponse } from "../../../core/http/ApiResponse.js";
import {
  paginationSchema,
  toPaginationMeta,
} from "../../../core/http/pagination.js";
import { BadRequestError } from "../../../core/errors/index.js";
import {
  RegionStatus,
  RegionType,
} from "../../../core/bd/entities/Region.entity.js";
import { createRegionSchema, updateRegionSchema } from "../dto/index.js";
import { RegionService } from "../services/RegionService.js";

export class RegionController {
  private readonly regionService = new RegionService();

  public listStates = async (req: Request, res: Response): Promise<void> => {
    const includeInactive = req.query.includeInactive === "true";
    const data = await this.regionService.listStates(!includeInactive);

    ApiResponse.ok(res, data, "Estados obtenidos correctamente");
  };

  public list = async (req: Request, res: Response): Promise<void> => {
    const { stateId, type, parentId, status, search } = req.query;

    let parsedType: RegionType | undefined;
    if (typeof type === "string" && type.length > 0) {
      const validTypes = Object.values(RegionType) as string[];
      if (!validTypes.includes(type)) {
        throw new BadRequestError("Tipo de región inválido");
      }
      parsedType = type as RegionType;
    }

    let parsedStatus: RegionStatus | undefined = RegionStatus.ACTIVE;
    if (typeof status === "string" && status.length > 0) {
      if (status === "all") {
        parsedStatus = undefined;
      } else {
        const validStatuses = Object.values(RegionStatus) as string[];
        if (!validStatuses.includes(status)) {
          throw new BadRequestError("Estado de región inválido");
        }
        parsedStatus = status as RegionStatus;
      }
    }

    const pagination = paginationSchema.parse(req.query);

    const { items, total } = await this.regionService.listRegions(
      {
        stateId: typeof stateId === "string" && stateId ? stateId : undefined,
        type: parsedType,
        parentId: typeof parentId === "string" && parentId ? parentId : undefined,
        status: parsedStatus,
        search:
          typeof search === "string" && search.trim()
            ? search.trim()
            : undefined,
      },
      pagination
    );

    ApiResponse.paginated(
      res,
      items,
      toPaginationMeta(total, pagination.page, pagination.limit),
      "Regiones obtenidas correctamente"
    );
  };

  public getById = async (req: Request, res: Response): Promise<void> => {
    const id = req.params.id;
    if (!id || typeof id !== "string") {
      throw new BadRequestError("El ID de la región es requerido");
    }

    const data = await this.regionService.getRegionById(id);
    ApiResponse.ok(res, data, "Región obtenida correctamente");
  };

  public create = async (req: Request, res: Response): Promise<void> => {
    const dto = createRegionSchema.parse(req.body);
    const data = await this.regionService.createRegion(dto);

    ApiResponse.created(res, data, "Región creada correctamente");
  };

  public update = async (req: Request, res: Response): Promise<void> => {
    const id = req.params.id;
    if (!id || typeof id !== "string") {
      throw new BadRequestError("El ID de la región es requerido");
    }

    const dto = updateRegionSchema.parse(req.body);
    const data = await this.regionService.updateRegion(id, dto);

    ApiResponse.ok(res, data, "Región actualizada correctamente");
  };

  public toggleStatus = async (req: Request, res: Response): Promise<void> => {
    const id = req.params.id;
    if (!id || typeof id !== "string") {
      throw new BadRequestError("El ID de la región es requerido");
    }

    const data = await this.regionService.toggleStatus(id);
    ApiResponse.ok(res, data, "Estado de la región actualizado");
  };
}