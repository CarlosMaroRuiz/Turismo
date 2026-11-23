import { z } from "zod";

export const updatePartnerCategorySchema = z
  .object({
    name: z
      .string()
      .trim()
      .min(2, "El nombre debe tener al menos 2 caracteres")
      .max(100, "El nombre no puede exceder 100 caracteres")
      .optional(),
    isActive: z.boolean().optional(),
  })
  .refine((data) => data.name !== undefined || data.isActive !== undefined, {
    message: "Debe proporcionar al menos 'name' o 'isActive' para actualizar",
  });

export type UpdatePartnerCategoryDto = z.infer<
  typeof updatePartnerCategorySchema
>;