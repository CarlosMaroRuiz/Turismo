import { z } from "zod";
import { isoDateSchema } from "../../package/dto/create-package.dto.js";

const packageDepartureItem = z.object({
  type: z.literal("package_departure"),
  departureId: z.string().uuid("El departureId debe ser un UUID válido"),
  adults: z.number().int().min(1).max(20),
  children: z.number().int().min(0).max(20).default(0),
});

const roomStayItem = z.object({
  type: z.literal("room_stay"),
  roomTypeId: z.string().uuid("El roomTypeId debe ser un UUID válido"),
  checkIn: isoDateSchema,
  checkOut: isoDateSchema,
  adults: z.number().int().min(1).max(10),
  children: z.number().int().min(0).max(10).default(0),
});

const experienceSlotItem = z.object({
  type: z.literal("experience_slot"),
  slotId: z.string().uuid("El slotId debe ser un UUID válido"),
  adults: z.number().int().min(1).max(20),
  children: z.number().int().min(0).max(20).default(0),
});

export const createQuoteSchema = z.object({
  items: z
    .array(
      z.discriminatedUnion("type", [
        packageDepartureItem,
        roomStayItem,
        experienceSlotItem,
      ])
    )
    .min(1, "La cotización debe incluir al menos un servicio")
    .max(10, "La cotización admite como máximo 10 servicios"),
});

export type CreateQuoteDto = z.infer<typeof createQuoteSchema>;
export type QuoteSelection = CreateQuoteDto["items"][number];
