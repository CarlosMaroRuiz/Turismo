import type { AsyncResource } from '@common/types/async'
import { useFetch } from '@core/http'

import { PARTNER_CATEGORY_PATHS } from './api'
import type { PartnerCategory } from './dto/partner-category.dto'

/**
 * Hooks de lectura de `partner-categories`.
 *
 * El listado alimenta el select del formulario de socios; la pantalla de
 * administracion pide `includeInactive` para gestionarlas todas.
 */
export function usePartnerCategories(includeInactive = false): AsyncResource<PartnerCategory[]> {
  return useFetch<PartnerCategory[]>(PARTNER_CATEGORY_PATHS.list, {
    params: includeInactive ? { includeInactive: true } : undefined,
  })
}

export function usePartnerCategory(id: string | undefined): AsyncResource<PartnerCategory> {
  return useFetch<PartnerCategory>(PARTNER_CATEGORY_PATHS.detail(id ?? ''), {
    enabled: id !== undefined,
  })
}
