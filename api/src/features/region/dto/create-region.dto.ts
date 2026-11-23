import { z } from "zod";
import {
  RegionStatus,
  RegionType,
} from "../../../core/bd/entities/Region.entity.js";

export const createRegionSchema = z
  .object({
    stateId: z.string().uuid("El stateId debe ser un UUID válido"),
    parentId: z
      .string()
      .uuid("El parentId debe ser un UUID válido")
      .nullable()
      .optional(),
    type: z.nativeEnum(RegionType, {
      error: "El tipo debe ser 'municipality' o 'zone'",
    }),
    name: z
      .string()
      .trim()
      .min(2, "El nombre debe tener al menos 2 caracteres")
      .max(150, "El nombre no puede exceder 150 caracteres"),
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
    aliases: z.array(z.string().trim().min(1)).default([]),
    lat: z.number().min(-90).max(90).nullable().optional(),
    lng: z.number().min(-180).max(180).nullable().optional(),
    status: z.nativeEnum(RegionStatus).default(RegionStatus.ACTIVE),
  })
  .superRefine((data, ctx) => {
    if (data.type === RegionType.MUNICIPALITY && data.parentId) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["parentId"],
        message: "Un municipio (municipality) no puede tener parentId",
      });
    }
    if (data.type === RegionType.ZONE && !data.parentId) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["parentId"],
        message: "Una zona (zone) requiere el parentId de un municipio",
      });
    }
  });

export type CreateRegionDto = z.infer<typeof createRegionSchema>;