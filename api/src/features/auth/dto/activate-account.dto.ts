import { z } from "zod";

export const activateAccountSchema = z.object({
  token: z
    .string({ message: "El token de activación es requerido" })
    .trim()
    .min(1, "El token de activación es requerido"),
  password: z
    .string({ message: "La contraseña es requerida" })
    .min(8, "La contraseña debe tener al menos 8 caracteres"),
});

export type ActivateAccountDto = z.infer<typeof activateAccountSchema>;