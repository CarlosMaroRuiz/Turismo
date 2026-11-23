import { z } from "zod";

export const updatePartnerSchema = z
  .object({
    // Solo el administrador puede recategorizar o mover de región un socio.
    categoryId: z
      .string()
      .uuid("El categoryId debe ser un UUID válido")
      .optional(),
    regionId: z.string().uuid("El regionId debe ser un UUID válido").optional(),
    slug: z
      .string()
      .trim()
      .min(2)
      .max(180)
      .regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/, "El slug debe estar en kebab-case")
      .optional(),
    commercialName: z.string().trim().min(2).max(150).optional(),
    legalName: z.string().trim().min(2).max(200).optional(),
    description: z.string().trim().max(2000).nullable().optional(),
    address: z.string().trim().min(5).max(255).optional(),
    lat: z.number().min(-90).max(90).nullable().optional(),
    lng: z.number().min(-180).max(180).nullable().optional(),
    contactName: z.string().trim().min(2).max(150).optional(),
    contactEmail: z.string().trim().email().max(150).optional(),
    contactPhone: z.string().trim().min(7).max(30).optional(),
    logoUrl: z
      .string()
      .url("El logoUrl debe ser una URL válida")
      .max(500)
      .nullable()
      .optional(),
  })
  .refine((data) => Object.values(data).some((v) => v !== undefined), {
    message: "Debe enviar al menos un campo para actualizar",
  });

export type UpdatePartnerDto = z.infer<typeof updatePartnerSchema>;