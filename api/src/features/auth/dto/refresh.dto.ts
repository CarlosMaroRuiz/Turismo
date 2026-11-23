import { z } from "zod";

export const refreshSchema = z.object({
  refreshToken: z
    .string({ message: "El refresh token es requerido" })
    .trim()
    .min(10, "El refresh token es inválido"),
});

export type RefreshDto = z.infer<typeof refreshSchema>;
