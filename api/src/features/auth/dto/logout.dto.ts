import { z } from "zod";

export const logoutSchema = z.object({
  refreshToken: z.string().trim().min(10).optional(),
});

export type LogoutDto = z.infer<typeof logoutSchema>;
