import { z } from "zod";
import { PackageItemType } from "../../../core/bd/entities/PackageItem.js";
import { DiscountType } from "../../../core/bd/entities/PackagePromotion.js";

/** Fechas sin hora, tal como las entrega y acepta MySQL (tipo `date`). */
export const isoDateSchema = z
  .string({ message: "La fecha es requerida" })
  .regex(/^\d{4}-\d{2}-\d{2}$/, "La fecha debe tener formato YYYY-MM-DD");

export const packageItemSchema = z.object({
  type: z.nativeEnum(PackageItemType),
  description: z.string().trim().min(3).max(255),
  isIncluded: z.boolean().default(true),
  sortOrder: z.number().int().min(0).max(999).default(0),
});

export const itineraryDaySchema = z.object({
  dayNumber: z.number().int().min(1).max(90),
  title: z.string().trim().min(3).max(150),
  description: z.string().trim().min(5),
});

export const promotionSchema = z
  .object({
    name: z.string().trim().min(3).max(120),
    discountType: z.nativeEnum(DiscountType),
    discountValue: z.number().positive().max(1_000_000),
    validFrom: isoDateSchema,
    validTo: isoDateSchema,
    minTravelers: z.number().int().min(1).max(100).nullable().optional(),
    daysOfWeek: z.array(z.number().int().min(0).max(6)).max(7).nullable().optional(),
  })
  .refine((data) => data.validFrom <= data.validTo, {
    message: "validFrom debe ser anterior o igual a validTo",
    path: ["validTo"],
  })
  .refine(
    (data) =>
      data.discountType !== DiscountType.PERCENTAGE || data.discountValue <= 100,
    { message: "Un descuento porcentual no puede superar 100", path: ["discountValue"] }
  );

export const createPackageSchema = z
  .object({
    destinationRegionId: z
      .string()
      .uuid("El destinationRegionId debe ser un UUID válido"),
    name: z.string().trim().min(3).max(150),
    summary: z.string().trim().min(10).max(300),
    description: z.string().trim().min(20),
    nights: z.number().int().min(0).max(60),
    minTravelers: z.number().int().min(1).max(100).default(1),
    maxTravelers: z.number().int().min(1).max(1000).nullable().optional(),
    childMinAge: z.number().int().min(0).max(17).nullable().optional(),
    childMaxAge: z.number().int().min(0).max(17).nullable().optional(),
    meetingPoint: z.string().trim().max(255).nullable().optional(),
    requirements: z.string().trim().nullable().optional(),
    cancellationPolicy: z.string().trim().min(10),
    taxesIncluded: z.boolean().default(true),
    items: z.array(packageItemSchema).max(50).default([]),
    itinerary: z.array(itineraryDaySchema).max(90).default([]),
    promotions: z.array(promotionSchema).max(20).default([]),
  })
  .superRefine((data, ctx) => {
    if (
      data.maxTravelers !== null &&
      data.maxTravelers !== undefined &&
      data.maxTravelers < data.minTravelers
    ) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["maxTravelers"],
        message: "maxTravelers no puede ser menor que minTravelers",
      });
    }

    if (
      data.childMinAge !== null &&
      data.childMinAge !== undefined &&
      data.childMaxAge !== null &&
      data.childMaxAge !== undefined &&
      data.childMinAge >= data.childMaxAge
    ) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["childMaxAge"],
        message: "childMaxAge debe ser mayor que childMinAge",
      });
    }

    const days = data.itinerary.map((day) => day.dayNumber);
    if (new Set(days).size !== days.length) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["itinerary"],
        message: "Los números de día del itinerario no pueden repetirse",
      });
    }
  });

export const updatePackageSchema = z
  .object({
    destinationRegionId: z.string().uuid().optional(),
    name: z.string().trim().min(3).max(150).optional(),
    summary: z.string().trim().min(10).max(300).optional(),
    description: z.string().trim().min(20).optional(),
    nights: z.number().int().min(0).max(60).optional(),
    minTravelers: z.number().int().min(1).max(100).optional(),
    maxTravelers: z.number().int().min(1).max(1000).nullable().optional(),
    childMinAge: z.number().int().min(0).max(17).nullable().optional(),
    childMaxAge: z.number().int().min(0).max(17).nullable().optional(),
    meetingPoint: z.string().trim().max(255).nullable().optional(),
    requirements: z.string().trim().nullable().optional(),
    cancellationPolicy: z.string().trim().min(10).optional(),
    taxesIncluded: z.boolean().optional(),
    items: z.array(packageItemSchema).max(50).optional(),
    itinerary: z.array(itineraryDaySchema).max(90).optional(),
    promotions: z.array(promotionSchema).max(20).optional(),
  })
  .refine((data) => Object.values(data).some((value) => value !== undefined), {
    message: "Debe enviar al menos un campo para actualizar",
  });

export type CreatePackageDto = z.infer<typeof createPackageSchema>;
export type UpdatePackageDto = z.infer<typeof updatePackageSchema>;
