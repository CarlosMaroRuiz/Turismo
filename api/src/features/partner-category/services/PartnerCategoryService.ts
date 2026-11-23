import { AppDataSource } from "../../../core/bd/index.js";
import { PartnerCategory } from "../../../core/bd/entities/PartnerCategory.js";
import { ConflictError, NotFoundError } from "../../../core/errors/index.js";
import type {
  CreatePartnerCategoryDto,
  UpdatePartnerCategoryDto,
} from "../dto/index.js";
import {
  type PartnerCategoryResponse,
  toPartnerCategoryResponse,
} from "../responses/index.js";

export class PartnerCategoryService {
  private readonly categoryRepo = AppDataSource.getRepository(PartnerCategory);

  public async listCategories(
    onlyActive = true
  ): Promise<PartnerCategoryResponse[]> {
    const categories = await this.categoryRepo.find({
      where: onlyActive ? { isActive: true } : {},
      order: { name: "ASC" },
    });

    return categories.map(toPartnerCategoryResponse);
  }

  public async getCategoryById(id: string): Promise<PartnerCategoryResponse> {
    const category = await this.categoryRepo.findOne({ where: { id } });

    if (!category) {
      throw new NotFoundError("Categoría de socio no encontrada");
    }

    return toPartnerCategoryResponse(category);
  }

  public async updateCategory(
    id: string,
    dto: UpdatePartnerCategoryDto
  ): Promise<PartnerCategoryResponse> {
    const category = await this.categoryRepo.findOne({ where: { id } });

    if (!category) {
      throw new NotFoundError("Categoría de socio no encontrada");
    }

    if (dto.name !== undefined) {
      category.name = dto.name;
    }

    if (dto.isActive !== undefined) {
      category.isActive = dto.isActive;
    }

    await this.categoryRepo.save(category);
    return toPartnerCategoryResponse(category);
  }

  public async createCategory(
    dto: CreatePartnerCategoryDto
  ): Promise<PartnerCategoryResponse> {
    const existing = await this.categoryRepo.findOne({
      where: { code: dto.code },
    });

    if (existing) {
      throw new ConflictError(
        `Ya existe una categoría con el código "${dto.code}"`,
        "CATEGORY_CODE_TAKEN"
      );
    }

    const category = this.categoryRepo.create({
      code: dto.code,
      name: dto.name,
      isActive: true,
    });

    const saved = await this.categoryRepo.save(category);
    return toPartnerCategoryResponse(saved);
  }

  /** Baja lógica: nunca se borra una categoría con socios asociados. */
  public async deactivateCategory(id: string): Promise<PartnerCategoryResponse> {
    const category = await this.categoryRepo.findOne({ where: { id } });

    if (!category) {
      throw new NotFoundError(
        "Categoría de socio no encontrada",
        "CATEGORY_NOT_FOUND"
      );
    }

    category.isActive = false;
    await this.categoryRepo.save(category);

    return toPartnerCategoryResponse(category);
  }

  public async toggleStatus(id: string): Promise<PartnerCategoryResponse> {
    const category = await this.categoryRepo.findOne({ where: { id } });

    if (!category) {
      throw new NotFoundError("Categoría de socio no encontrada");
    }

    category.isActive = !category.isActive;
    await this.categoryRepo.save(category);

    return toPartnerCategoryResponse(category);
  }
}