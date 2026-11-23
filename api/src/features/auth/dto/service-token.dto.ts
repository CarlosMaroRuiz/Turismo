import { z } from "zod";

export const serviceTokenSchema = z.object({
  clientId: z
    .string({ message: "El clientId es requerido" })
    .trim()
    .min(3, "El clientId es inválido")
    .max(60),
  secret: z
    .string({ message: "El secreto es requerido" })
    .min(8, "El secreto es inválido")
    .max(200),
});

export type ServiceTokenDto = z.infer<typeof serviceTokenSchema>;
