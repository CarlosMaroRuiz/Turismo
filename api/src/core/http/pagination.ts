import { z } from "zod";
import type { PaginationMeta } from "./api-response.types.js";

/**
 * Contrato único de paginación para todos los listados del API.
 * `limit` tiene tope para que una consulta del agente no arrastre la tabla entera.
 */
export const paginationSchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(200).default(50),
});

export type PaginationQuery = z.infer<typeof paginationSchema>;

export function toPaginationMeta(
  total: number,
  page: number,
  limit: number
): PaginationMeta {
  return {
    page,
    limit,
    total,
    totalPages: limit > 0 ? Math.ceil(total / limit) : 0,
  };
}

export function toSkipTake({ page, limit }: PaginationQuery): {
  skip: number;
  take: number;
} {
  return { skip: (page - 1) * limit, take: limit };
}
