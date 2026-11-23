import { api } from '@core/http'

import type {
  CreatePartnerCategoryPayload,
  PartnerCategory,
  UpdatePartnerCategoryPayload,
} from './dto/partner-category.dto'

/** Rutas del recurso, compartidas por las funciones `api` y los hooks. */
export const PARTNER_CATEGORY_PATHS = {
  list: '/partner-categories',
  detail: (id: string): string => `/partner-categories/${id}`,
  toggleStatus: (id: string): string => `/partner-categories/${id}/toggle-status`,
} as const

/**
 * Endpoints de `Categorias de socio`.
 *
 * La lectura es publica y devuelve un arreglo plano, sin paginacion.
 * La escritura exige `super_user`.
 */

/** Solo activas salvo que se pidan todas (pantalla de administracion). */
export function getPartnerCategories(includeInactive = false): Promise<PartnerCategory[]> {
  return api.get<PartnerCategory[]>(PARTNER_CATEGORY_PATHS.list, {
    ...(includeInactive && { params: { includeInactive: true } }),
  })
}

export function getPartnerCategory(id: string): Promise<PartnerCategory> {
  return api.get<PartnerCategory>(PARTNER_CATEGORY_PATHS.detail(id))
}

export function createPartnerCategory(
  payload: CreatePartnerCategoryPayload,
): Promise<PartnerCategory> {
  return api.post<PartnerCategory>(PARTNER_CATEGORY_PATHS.list, payload)
}

export function updatePartnerCategory(
  id: string,
  payload: UpdatePartnerCategoryPayload,
): Promise<PartnerCategory> {
  return api.patch<PartnerCategory>(PARTNER_CATEGORY_PATHS.detail(id), payload)
}

/** Alterna activa/inactiva y devuelve la categoria actualizada. */
export function togglePartnerCategory(id: string): Promise<PartnerCategory> {
  return api.patch<PartnerCategory>(PARTNER_CATEGORY_PATHS.toggleStatus(id))
}

/**
 * Baja logica (`isActive = false`). No borra la fila: los socios que ya la
 * usan siguen apuntando a ella.
 */
export function deactivatePartnerCategory(id: string): Promise<PartnerCategory> {
  return api.delete<PartnerCategory>(PARTNER_CATEGORY_PATHS.detail(id))
}
