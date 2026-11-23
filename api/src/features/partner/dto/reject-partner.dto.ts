import { z } from "zod";

export const rejectPartnerSchema = z.object({
  reason: z
    .string()
    .trim()
    .min(10, "Indica un motivo de rechazo de al menos 10 caracteres")
    .max(255),
});

export type RejectPartnerDto = z.infer<typeof rejectPartnerSchema>;