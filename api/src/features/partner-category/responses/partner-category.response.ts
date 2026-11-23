import type { PartnerCategory } from "../../../core/bd/entities/PartnerCategory.js";

export interface PartnerCategoryResponse {
  id: string;
  code: string;
  name: string;
  isActive: boolean;
}

export function toPartnerCategoryResponse(
  category: PartnerCategory
): PartnerCategoryResponse {
  return {
    id: category.id,
    code: category.code,
    name: category.name,
    isActive: category.isActive,
  };
}