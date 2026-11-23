import { z } from "zod";
import { paginationSchema } from "../../../core/http/pagination.js";
import { isoDateSchema } from "../../package/dto/create-package.dto.js";

export const createRoomTypeSchema = z.object({
  name: z.string().trim().min(2).max(120),
  description: z.string().trim().max(2000).nullable().optional(),
  maxAdults: z.number().int().min(1).max(10).default(2),
  maxChildren: z.number().int().min(0).max(10).default(0),
  totalUnits: z.number().int().min(1).max(500).default(1),
  basePrice: z.number().positive().max(1_000_000),
  amenities: z.array(z.string().trim().min(1).max(60)).max(30).default([]),
  images: z.array(z.string().url("Cada imagen debe ser una URL válida")).max(20).default([]),
  isActive: z.boolean().default(true),
});

export const updateRoomTypeSchema = z
  .object({
    name: z.string().trim().min(2).max(120).optional(),
    description: z.string().trim().max(2000).nullable().optional(),
    maxAdults: z.number().int().min(1).max(10).optional(),
    maxChildren: z.number().int().min(0).max(10).optional(),
    totalUnits: z.number().int().min(1).max(500).optional(),
    basePrice: z.number().positive().max(1_000_000).optional(),
    amenities: z.array(z.string().trim().min(1).max(60)).max(30).optional(),
    images: z.array(z.string().url("Cada imagen debe ser una URL válida")).max(20).optional(),
    isActive: z.boolean().optional(),
  })
  .refine((data) => Object.values(data).some((value) => value !== undefined), {
    message: "Debe enviar al menos un campo para actualizar",
  });

/** Carga masiva de inventario para un rango de fechas (ambas inclusive). */
export const inventoryRangeSchema = z
  .object({
    from: isoDateSchema,
    to: isoDateSchema,
    units: z.number().int().min(0).max(500).optional(),
    price: z.number().positive().max(1_000_000).optional(),
    isClosed: z.boolean().optional(),
  })
  .refine((data) => data.from <= data.to, {
    message: "from debe ser anterior o igual a to",
    path: ["to"],
  })
  .refine(
    (data) =>
      data.units !== undefined ||
      data.price !== undefined ||
      data.isClosed !== undefined,
    { message: "Indica al menos units, price o isClosed" }
  );

export const inventoryQuerySchema = z
  .object({
    from: isoDateSchema,
    to: isoDateSchema,
  })
  .refine((data) => data.from <= data.to, {
    message: "from debe ser anterior o igual a to",
    path: ["to"],
  });

export const roomTypeListQuerySchema = paginationSchema.extend({
  partnerId: z.string().uuid().optional(),
  regionId: z.string().uuid().optional(),
  guests: z.coerce.number().int().min(1).max(20).optional(),
});

export const availabilityQuerySchema = paginationSchema.extend({
  checkIn: isoDateSchema,
  checkOut: isoDateSchema,
  regionId: z.string().uuid().optional(),
  partnerId: z.string().uuid().optional(),
  adults: z.coerce.number().int().min(1).max(10).default(1),
  children: z.coerce.number().int().min(0).max(10).default(0),
});

export type CreateRoomTypeDto = z.infer<typeof createRoomTypeSchema>;
export type UpdateRoomTypeDto = z.infer<typeof updateRoomTypeSchema>;
export type InventoryRangeDto = z.infer<typeof inventoryRangeSchema>;
export type RoomTypeListQuery = z.infer<typeof roomTypeListQuerySchema>;
export type AvailabilityQuery = z.infer<typeof availabilityQuerySchema>;
