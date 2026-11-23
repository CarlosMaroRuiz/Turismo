import type { EntityManager } from "typeorm";
import { Booking } from "../../../core/bd/entities/Booking.js";

export const activeDepartureHold =
  "(booking.status = 'capturing' OR (booking.status = 'pending_payment' AND booking.expiresAt > CURRENT_TIMESTAMP(6)))";

export async function departureHolds(
  manager: EntityManager,
  departureIds: string[]
): Promise<Map<string, number>> {
  if (departureIds.length === 0) return new Map();

  const rows = await manager.getRepository(Booking).createQueryBuilder("booking")
    .select("booking.departureId", "departureId")
    .addSelect("SUM(booking.seats)", "seats")
    .where("booking.departureId IN (:...departureIds)", { departureIds })
    .andWhere(activeDepartureHold)
    .groupBy("booking.departureId")
    .getRawMany<{ departureId: string; seats: string }>();

  return new Map(rows.map((row) => [row.departureId, Number(row.seats)]));
}
