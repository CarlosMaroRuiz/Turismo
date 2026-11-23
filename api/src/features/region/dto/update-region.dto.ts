import { z } from "zod";
import { RegionStatus } from "../../../core/bd/entities/Region.entity.js";

export const updateRegionSchema = z.object({
  name: z.string().trim().min(2).max(150).optional(),
  slug: z
    .string()
    .trim()
    .min(2)
    .max(180)
    .regex(
      /^[a-z0-9]+(?:-[a-z0-9]+)*$/,
      "El slug debe estar en formato kebab-case"
    )
    .optional(),
  aliases: z.array(z.string().trim().min(1)).optional(),
  lat: z.number().min(-90).max(90).nullable().optional(),
  lng: z.number().min(-180).max(180).nullable().optional(),
  status: z.nativeEnum(RegionStatus).optional(),
});

export type UpdateRegionDto = z.infer<typeof updateRegionSchema>;