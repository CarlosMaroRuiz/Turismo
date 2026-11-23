import type { AsyncResource } from '@common/types/async'
import { useFetch, usePaginated } from '@core/http'
import type { Paginated } from '@core/http'

import { PARTNER_PATHS } from './api'
import type { Partner, PartnerFilters, PartnerMember } from './dto/partner.dto'

/**
 * Hooks de lectura de `partners`.
 *
 * Para las acciones de estado (`approve`, `suspend`…) se usan las funciones
 * de `api.ts` dentro de un `useAction`: no son lecturas y no deben dispararse
 * al montar.
 */

/** Listado paginado. El admin es el unico que lo puede pedir. */
export function usePartners(filters: PartnerFilters = {}): AsyncResource<Paginated<Partner>> {
  return usePaginated<Partner>(PARTNER_PATHS.list, { params: { ...filters } })
}

/** Ficha del socio. El admin ve cualquiera; el socio, solo la propia. */
export function usePartner(id: string | undefined): AsyncResource<Partner> {
  return useFetch<Partner>(PARTNER_PATHS.detail(id ?? ''), { enabled: id !== undefined })
}

/** Equipo del socio. Arreglo completo, sin paginacion. */
export function usePartnerMembers(id: string | undefined): AsyncResource<PartnerMember[]> {
  return useFetch<PartnerMember[]>(PARTNER_PATHS.members(id ?? ''), {
    enabled: id !== undefined,
  })
}
