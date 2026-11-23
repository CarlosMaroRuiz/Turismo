import type { Request, Response } from "express";
import { ApiResponse } from "../../../core/http/ApiResponse.js";
import { BadRequestError } from "../../../core/errors/index.js";
import {
  createPartnerCategorySchema,
  updatePartnerCategorySchema,
} from "../dto/index.js";
import { PartnerCategoryService } from "../services/PartnerCategoryService.js";

export class PartnerCategoryController {
  private readonly categoryService = new PartnerCategoryService();

  public list = async (req: Request, res: Response): Promise<void> => {
    const includeInactive = req.query.includeInactive === "true";
    const data = await this.categoryService.listCategories(!includeInactive);

    ApiResponse.ok(res, data, "Categorías obtenidas correctamente");
  };

  public getById = async (req: Request, res: Response): Promise<void> => {
    const id = req.params.id;
    if (!id || typeof id !== "string") {
      throw new BadRequestError(
        "El ID de la categoría es requerido",
        "CATEGORY_ID_REQUIRED"
      );
    }

    const data = await this.categoryService.getCategoryById(id);
    ApiResponse.ok(res, data, "Categoría obtenida correctamente");
  };

  public create = async (req: Request, res: Response): Promise<void> => {
    const dto = createPartnerCategorySchema.parse(req.body ?? {});
    const data = await this.categoryService.createCategory(dto);

    ApiResponse.created(res, data, "Categoría creada correctamente");
  };

  public update = async (req: Request, res: Response): Promise<void> => {
    const id = req.params.id;
    if (!id || typeof id !== "string") {
      throw new BadRequestError(
        "El ID de la categoría es requerido",
        "CATEGORY_ID_REQUIRED"
      );
    }

    const dto = updatePartnerCategorySchema.parse(req.body ?? {});
    const data = await this.categoryService.updateCategory(id, dto);

    ApiResponse.ok(res, data, "Categoría actualizada correctamente");
  };

  public toggleStatus = async (req: Request, res: Response): Promise<void> => {
    const id = req.params.id;
    if (!id || typeof id !== "string") {
      throw new BadRequestError(
        "El ID de la categoría es requerido",
        "CATEGORY_ID_REQUIRED"
      );
    }

    const data = await this.categoryService.toggleStatus(id);
    ApiResponse.ok(res, data, "Estado de la categoría actualizado");
  };

  public remove = async (req: Request, res: Response): Promise<void> => {
    const id = req.params.id;
    if (!id || typeof id !== "string") {
      throw new BadRequestError(
        "El ID de la categoría es requerido",
        "CATEGORY_ID_REQUIRED"
      );
    }

    const data = await this.categoryService.deactivateCategory(id);
    ApiResponse.ok(res, data, "Categoría desactivada correctamente");
  };
}
