import { z } from "zod";

export const changePasswordSchema = z
  .object({
    currentPassword: z
      .string({ message: "La contraseña actual es requerida" })
      .min(1, "La contraseña actual es requerida"),
    newPassword: z
      .string({ message: "La contraseña nueva es requerida" })
      .min(8, "La contraseña nueva debe tener al menos 8 caracteres")
      .max(72, "La contraseña nueva no puede exceder 72 caracteres"),
  })
  .refine((data) => data.currentPassword !== data.newPassword, {
    message: "La contraseña nueva debe ser distinta a la actual",
    path: ["newPassword"],
  });

export type ChangePasswordDto = z.infer<typeof changePasswordSchema>;
