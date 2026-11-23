import { z } from "zod";
import { paginationSchema } from "../../../core/http/pagination.js";
import { isoDateSchema } from "./create-package.dto.js";

export const packageAvailabilityQuerySchema = paginationSchema.extend({
  regionId: z.string().uuid(),
  date: isoDateSchema,
  people: z.coerce.number().int().min(1).max(40).default(1),
  flexDays: z.coerce.number().int().min(0).max(7).default(0),
});

export type PackageAvailabilityQuery = z.infer<typeof packageAvailabilityQuerySchema>;
