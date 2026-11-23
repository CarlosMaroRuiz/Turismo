import { z } from "zod";
import { PackageStatus } from "../../../core/bd/entities/Package.js";
import { DepartureStatus } from "../../../core/bd/entities/PackageDeparture.js";
import { isoDateSchema } from "./create-package.dto.js";

export const createDepartureSchema = z.object({
  departureDate: isoDateSchema,
  totalSeats: z.number().int().min(1).max(1000),
  adultPrice: z.number().positive().max(1_000_000),
  childPrice: z.number().positive().max(1_000_000).nullable().optional(),
  status: z.nativeEnum(DepartureStatus).default(DepartureStatus.OPEN),
});

export const updateDepartureSchema = z
  .object({
    totalSeats: z.number().int().min(1).max(1000).optional(),
    adultPrice: z.number().positive().max(1_000_000).optional(),
    childPrice: z.number().positive().max(1_000_000).nullable().optional(),
    status: z.nativeEnum(DepartureStatus).optional(),
  })
  .refine((data) => Object.values(data).some((value) => value !== undefined), {
    message: "Debe enviar al menos un campo para actualizar",
  });

export const packageStatusSchema = z.object({
  status: z.nativeEnum(PackageStatus),
});

export type CreateDepartureDto = z.infer<typeof createDepartureSchema>;
export type UpdateDepartureDto = z.infer<typeof updateDepartureSchema>;
export type PackageStatusDto = z.infer<typeof packageStatusSchema>;
