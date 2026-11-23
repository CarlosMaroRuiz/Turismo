import { z } from "zod";

export const suspendPartnerSchema = z.object({
  reason: z
    .string()
    .trim()
    .min(10, "El motivo de suspensión debe tener al menos 10 caracteres")
    .max(255, "El motivo no puede exceder 255 caracteres"),
});

export type SuspendPartnerDto = z.infer<typeof suspendPartnerSchema>;