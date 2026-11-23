import { z } from "zod";
import { paginationSchema } from "../../../core/http/pagination.js";
import { isoDateSchema } from "../../package/dto/create-package.dto.js";
import { SlotStatus } from "../../../core/bd/entities/ExperienceSlot.js";

export const timeSchema = z
  .string({ message: "La hora es requerida" })
  .regex(/^([01]\d|2[0-3]):[0-5]\d$/, "La hora debe tener formato HH:MM");

export const createExperienceSchema = z.object({
  regionId: z.string().uuid("El regionId debe ser un UUID válido"),
  name: z.string().trim().min(3).max(150),
  description: z.string().trim().min(20),
  durationMinutes: z.number().int().min(15).max(1440),
  minAge: z.number().int().min(0).max(99).nullable().optional(),
  priceAdult: z.number().positive().max(1_000_000),
  priceChild: z.number().positive().max(1_000_000).nullable().optional(),
  requirements: z.string().trim().max(2000).nullable().optional(),
  images: z.array(z.string().url("Cada imagen debe ser una URL válida")).max(20).default([]),
  isActive: z.boolean().default(true),
});

export const updateExperienceSchema = z
  .object({
    regionId: z.string().uuid().optional(),
    name: z.string().trim().min(3).max(150).optional(),
    description: z.string().trim().min(20).optional(),
    durationMinutes: z.number().int().min(15).max(1440).optional(),
    minAge: z.number().int().min(0).max(99).nullable().optional(),
    priceAdult: z.number().positive().max(1_000_000).optional(),
    priceChild: z.number().positive().max(1_000_000).nullable().optional(),
    requirements: z.string().trim().max(2000).nullable().optional(),
    images: z.array(z.string().url("Cada imagen debe ser una URL válida")).max(20).optional(),
    isActive: z.boolean().optional(),
  })
  .refine((data) => Object.values(data).some((value) => value !== undefined), {
    message: "Debe enviar al menos un campo para actualizar",
  });

export const createSlotSchema = z.object({
  date: isoDateSchema,
  startTime: timeSchema,
  capacity: z.number().int().min(1).max(500),
});

export const updateSlotSchema = z
  .object({
    capacity: z.number().int().min(1).max(500).optional(),
    status: z.nativeEnum(SlotStatus).optional(),
  })
  .refine((data) => Object.values(data).some((value) => value !== undefined), {
    message: "Debe enviar al menos un campo para actualizar",
  });

export const experienceListQuerySchema = paginationSchema.extend({
  partnerId: z.string().uuid().optional(),
  regionId: z.string().uuid().optional(),
  search: z.string().trim().max(100).optional(),
});

export const experienceAvailabilityQuerySchema = paginationSchema.extend({
  date: isoDateSchema.optional(),
  regionId: z.string().uuid().optional(),
  partnerId: z.string().uuid().optional(),
  people: z.coerce.number().int().min(1).max(50).default(1),
});

export type CreateExperienceDto = z.infer<typeof createExperienceSchema>;
export type UpdateExperienceDto = z.infer<typeof updateExperienceSchema>;
export type CreateSlotDto = z.infer<typeof createSlotSchema>;
export type UpdateSlotDto = z.infer<typeof updateSlotSchema>;
export type ExperienceAvailabilityQuery = z.infer<
  typeof experienceAvailabilityQuerySchema
>;
