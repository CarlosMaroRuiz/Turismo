import { z } from "zod";

export const registerPartnerSchema = z.object({
  categoryId: z.string().uuid("El ID de categoría debe ser un UUID válido"),
  regionId: z.string().uuid("El ID de región debe ser un UUID válido"),

  commercialName: z
    .string()
    .trim()
    .min(2, "El nombre comercial debe tener al menos 2 caracteres")
    .max(150),
  legalName: z
    .string()
    .trim()
    .min(2, "La razón social debe tener al menos 2 caracteres")
    .max(200),
  description: z.string().trim().max(2000).optional(),
  address: z
    .string()
    .trim()
    .min(5, "La dirección debe tener al menos 5 caracteres")
    .max(255),
  lat: z.number().min(-90).max(90).optional(),
  lng: z.number().min(-180).max(180).optional(),

  contactName: z
    .string()
    .trim()
    .min(2, "El nombre de contacto es obligatorio")
    .max(150),
  contactEmail: z
    .string()
    .trim()
    .toLowerCase()
    .email("Correo de contacto inválido")
    .max(150),
  contactPhone: z.string().trim().min(7).max(30),

  ownerName: z
    .string()
    .trim()
    .min(2, "El nombre del responsable es obligatorio")
    .max(150),
  ownerEmail: z
    .string()
    .trim()
    .toLowerCase()
    .email("Correo del responsable inválido")
    .max(150),
  ownerPhone: z.string().trim().min(7).max(30).optional(),
});

export type RegisterPartnerDto = z.infer<typeof registerPartnerSchema>;

/**
 * Alta desde el panel de administración (CU-02): mismos datos que el formulario
 * público, más la opción de aprobar y enviar la invitación en el mismo paso.
 */
export const createPartnerSchema = registerPartnerSchema.extend({
  invite: z.boolean().default(false),
});

export type CreatePartnerDto = z.infer<typeof createPartnerSchema>;