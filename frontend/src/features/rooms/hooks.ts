import type { AsyncResource } from '@common/types/async'
import { useFetch, usePaginated } from '@core/http'
import type { Paginated } from '@core/http'

import type { InventoryDay, RoomType } from './dto/room.dto'

/** Habitaciones del hotel autenticado. */
export function useMyRoomTypes(): AsyncResource<Paginated<RoomType>> {
  return usePaginated<RoomType>('/hotels/room-types/mine', {
    params: { page: 1, limit: 100 },
  })
}

/**
 * Inventario del rango pedido.
 *
 * Se desactiva mientras falte el hotel o las fechas no formen un rango valido,
 * para no pedir `/inventory` con una fecha vacia.
 */
export function useInventory(
  roomTypeId: string | undefined,
  from: string,
  to: string,
): AsyncResource<InventoryDay[]> {
  return useFetch<InventoryDay[]>(
    roomTypeId === undefined ? '' : `/hotels/room-types/${roomTypeId}/inventory`,
    {
      params: { from, to },
      enabled: roomTypeId !== undefined && from !== '' && to !== '' && from <= to,
    },
  )
}
