import { api } from '@core/http'
import type { Paginated } from '@core/http'

import type {
  CreateRegionPayload,
  Region,
  RegionFilters,
  State,
  UpdateRegionPayload,
} from './dto/region.dto'

/**
 * Rutas del recurso, en un solo lugar: las usan tanto las funciones `api`
 * como los hooks, para que el path no se escriba dos veces.
 */
export const REGION_PATHS = {
  states: '/regions/states',
  list: '/regions',
  detail: (id: string): string => `/regions/${id}`,
  toggleStatus: (id: string): string => `/regions/${id}/toggle-status`,
} as const

/**
 * Endpoints de `Regiones` del contrato.
 *
 * `states` y el listado son publicos; la escritura exige `super_user`.
 * El listado de estados devuelve el arreglo completo (sin `meta`); el de
 * regiones si es paginado.
 */

export function getStates(includeInactive = false): Promise<State[]> {
  return api.get<State[]>(REGION_PATHS.states, {
    ...(includeInactive && { params: { includeInactive: true } }),
  })
}

export function getRegions(filters: RegionFilters = {}): Promise<Paginated<Region>> {
  return api.getPaginated<Region>(REGION_PATHS.list, { params: { ...filters } })
}

export function getRegion(id: string): Promise<Region> {
  return api.get<Region>(REGION_PATHS.detail(id))
}

export function createRegion(payload: CreateRegionPayload): Promise<Region> {
  return api.post<Region>(REGION_PATHS.list, payload)
}

export function updateRegion(id: string, payload: UpdateRegionPayload): Promise<Region> {
  return api.patch<Region>(REGION_PATHS.detail(id), payload)
}

/** Alterna activa/inactiva y devuelve la region actualizada. */
export function toggleRegionStatus(id: string): Promise<Region> {
  return api.patch<Region>(REGION_PATHS.toggleStatus(id))
}
