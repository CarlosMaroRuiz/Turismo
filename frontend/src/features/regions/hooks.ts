import type { AsyncResource } from '@common/types/async'
import { useFetch, usePaginated } from '@core/http'
import type { Paginated } from '@core/http'

import { REGION_PATHS } from './api'
import type { Region, RegionFilters, State } from './dto/region.dto'

/**
 * Hooks de lectura de `regions`.
 *
 * Devuelven el contrato `AsyncResource` de la vista y exponen el DTO de la
 * feature, no el sobre del transporte. Las rutas salen de `REGION_PATHS`.
 */

/** Estados de la republica. Solo activos salvo que se pidan todos. */
export function useStates(includeInactive = false): AsyncResource<State[]> {
  return useFetch<State[]>(REGION_PATHS.states, {
    params: includeInactive ? { includeInactive: true } : undefined,
  })
}

/** Listado paginado de municipios y zonas. */
export function useRegions(
  filters: RegionFilters = {},
  enabled = true,
): AsyncResource<Paginated<Region>> {
  return usePaginated<Region>(REGION_PATHS.list, { params: { ...filters }, enabled })
}

/** Detalle de una region. Con `id` sin valor no dispara la peticion. */
export function useRegion(id: string | undefined): AsyncResource<Region> {
  return useFetch<Region>(REGION_PATHS.detail(id ?? ''), { enabled: id !== undefined })
}
