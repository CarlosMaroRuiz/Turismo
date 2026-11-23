import { z } from "zod";

export const createPartnerCategorySchema = z.object({
  code: z
    .string({ message: "El código es requerido" })
    .trim()
    .toLowerCase()
    .min(2, "El código debe tener al menos 2 caracteres")
    .max(30, "El código no puede exceder 30 caracteres")
    .regex(
      /^[a-z0-9]+(?:-[a-z0-9]+)*$/,
      "El código debe estar en kebab-case (por ejemplo 'tour-operator')"
    ),
  name: z
    .string({ message: "El nombre es requerido" })
    .trim()
    .min(2, "El nombre debe tener al menos 2 caracteres")
    .max(100, "El nombre no puede exceder 100 caracteres"),
});

export type CreatePartnerCategoryDto = z.infer<
  typeof createPartnerCategorySchema
>;
