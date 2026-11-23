import type { Request, Response } from "express";
import { ApiResponse } from "../../../core/http/ApiResponse.js";
import {
  paginationSchema,
  toPaginationMeta,
} from "../../../core/http/pagination.js";
import { BadRequestError } from "../../../core/errors/index.js";
import {
  createDepartureSchema,
  createPackageSchema,
  packageStatusSchema,
  updateDepartureSchema,
  updatePackageSchema,
} from "../dto/index.js";
import { PackageService } from "../services/PackageService.js";

export class PackageController {
  private readonly packageService = new PackageService();

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
    const { regionId, partnerId, search } = req.query;
    const pagination = paginationSchema.parse(req.query);

    const { items, total } = await this.packageService.listPublic(
      {
        regionId: typeof regionId === "string" && regionId ? regionId : undefined,
        partnerId:
          typeof partnerId === "string" && partnerId ? partnerId : undefined,
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
      "Paquetes obtenidos correctamente"
    );
  };

  public listMine = async (req: Request, res: Response): Promise<void> => {
    const pagination = paginationSchema.parse(req.query);
    const { items, total } = await this.packageService.listMine(
      req.user!,
      pagination
    );

    ApiResponse.paginated(
      res,
      items,
      toPaginationMeta(total, pagination.page, pagination.limit),
      "Paquetes del socio obtenidos correctamente"
    );
  };

  public getById = async (req: Request, res: Response): Promise<void> => {
    const id = this.getParam(req, "id");
    const data = await this.packageService.getById(id, req.user);

    ApiResponse.ok(res, data, "Paquete obtenido correctamente");
  };

  public create = async (req: Request, res: Response): Promise<void> => {
    const dto = createPackageSchema.parse(req.body ?? {});
    const data = await this.packageService.create(req.user!, dto);

    ApiResponse.created(
      res,
      data,
      "Paquete creado en borrador. Publícalo cuando esté completo."
    );
  };

  public update = async (req: Request, res: Response): Promise<void> => {
    const id = this.getParam(req, "id");
    const dto = updatePackageSchema.parse(req.body ?? {});
    const data = await this.packageService.update(id, req.user!, dto);

    ApiResponse.ok(res, data, "Paquete actualizado correctamente");
  };

  public changeStatus = async (req: Request, res: Response): Promise<void> => {
    const id = this.getParam(req, "id");
    const dto = packageStatusSchema.parse(req.body ?? {});
    const data = await this.packageService.changeStatus(id, req.user!, dto.status);

    ApiResponse.ok(res, data, `Estado del paquete: ${data.status}`);
  };

  public addDeparture = async (req: Request, res: Response): Promise<void> => {
    const id = this.getParam(req, "id");
    const dto = createDepartureSchema.parse(req.body ?? {});
    const data = await this.packageService.addDeparture(id, req.user!, dto);

    ApiResponse.created(res, data, "Salida agregada correctamente");
  };

  public updateDeparture = async (
    req: Request,
    res: Response
  ): Promise<void> => {
    const id = this.getParam(req, "id");
    const departureId = this.getParam(req, "departureId");
    const dto = updateDepartureSchema.parse(req.body ?? {});
    const data = await this.packageService.updateDeparture(
      id,
      departureId,
      req.user!,
      dto
    );

    ApiResponse.ok(res, data, "Salida actualizada correctamente");
  };
}
