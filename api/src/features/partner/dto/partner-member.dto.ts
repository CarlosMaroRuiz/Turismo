import { z } from "zod";
import { PartnerUserRole } from "../../../core/bd/entities/PartnerUser.js";

export const addPartnerMemberSchema = z.object({
  name: z
    .string()
    .trim()
    .min(2, "El nombre debe tener al menos 2 caracteres")
    .max(150),
  email: z.string().trim().email("Correo electrónico inválido").max(150),
  phone: z.string().trim().min(7).max(30).optional(),
  role: z.nativeEnum(PartnerUserRole).default(PartnerUserRole.STAFF),
});

export const updatePartnerMemberSchema = z
  .object({
    role: z.nativeEnum(PartnerUserRole).optional(),
    isActive: z.boolean().optional(),
  })
  .refine((data) => data.role !== undefined || data.isActive !== undefined, {
    message: "Debe proporcionar 'role' o 'isActive'",
  });

export type AddPartnerMemberDto = z.infer<typeof addPartnerMemberSchema>;
export type UpdatePartnerMemberDto = z.infer<typeof updatePartnerMemberSchema>;