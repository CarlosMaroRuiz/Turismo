import { api } from '@core/http'
import type { Paginated } from '@core/http'

import type {
  InventoryDay,
  InventoryRangePayload,
  InventoryResult,
  RoomType,
  RoomTypePayload,
} from './dto/room.dto'

/** Rutas del recurso de habitaciones (ver `HotelRoutes` de la API). */
const ROOM_PATHS = {
  list: '/hotels/room-types',
  mine: '/hotels/room-types/mine',
  item: (id: string) => `/hotels/room-types/${id}`,
  inventory: (id: string) => `/hotels/room-types/${id}/inventory`,
}

/** Solo las habitaciones del hotel autenticado. */
export function getMyRoomTypes(): Promise<Paginated<RoomType>> {
  return api.getPaginated<RoomType>(ROOM_PATHS.mine, { params: { page: 1, limit: 100 } })
}

export function createRoomType(payload: RoomTypePayload): Promise<RoomType> {
  return api.post<RoomType>(ROOM_PATHS.list, payload)
}

export function updateRoomType(id: string, payload: RoomTypePayload): Promise<RoomType> {
  return api.patch<RoomType>(ROOM_PATHS.item(id), payload)
}

/** Aplica unidades, tarifa y cierre a todas las fechas del rango. */
export function upsertInventory(
  id: string,
  payload: InventoryRangePayload,
): Promise<InventoryResult> {
  return api.put<InventoryResult>(ROOM_PATHS.inventory(id), payload)
}

export function getInventory(id: string, from: string, to: string): Promise<InventoryDay[]> {
  return api.get<InventoryDay[]>(ROOM_PATHS.inventory(id), { params: { from, to } })
}
