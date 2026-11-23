import { z } from "zod";

export const loginSchema = z.object({
  email: z
    .string({ message: "El correo electrónico es requerido" })
    .trim()
    .toLowerCase()
    .email("El formato del correo electrónico no es válido"),
  password: z
    .string({ message: "La contraseña es requerida" })
    .min(1, "La contraseña es requerida"),
});

export type LoginDto = z.infer<typeof loginSchema>;