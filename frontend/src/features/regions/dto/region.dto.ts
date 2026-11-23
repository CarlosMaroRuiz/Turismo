/**
 * DTOs de regiones.
 *
 * Espejo de `api/src/features/region/responses/{region,state}.response.ts`.
 * Los nombres son los del cable: no se renombra nada para no perder el rastro.
 */

/** Un estado de la republica. `GET /regions/states` */
export interface State {
  id: string
  code: string
  name: string
  slug: string
  aliases: string[]
  isActive: boolean
}

/** Tipo de region: municipio (sin padre) o zona (dentro de un municipio). */
export type RegionType = 'municipality' | 'zone'

export type RegionStatus = 'active' | 'inactive'

/** El listado acepta `all` para traer inactivas tambien. */
export type RegionStatusFilter = RegionStatus | 'all'

/** Una region. `GET /regions` y `GET /regions/:id` */
export interface Region {
  id: string
  stateId: string
  stateName: string | null
  parentId: string | null
  parentName: string | null
  type: RegionType
  name: string
  slug: string
  aliases: string[]
  lat: number | null
  lng: number | null
  status: RegionStatus
}

/** Filtros del listado. `status` omite las inactivas por defecto. */
export interface RegionFilters {
  stateId?: string
  type?: RegionType
  parentId?: string
  status?: RegionStatusFilter
  search?: string
  page?: number
  limit?: number
}

/** `POST /regions` */
export interface CreateRegionPayload {
  stateId: string
  parentId?: string | null
  type: RegionType
  name: string
  slug?: string
  aliases?: string[]
  lat?: number | null
  lng?: number | null
  status?: RegionStatus
}

/** `PATCH /regions/:id` */
export interface UpdateRegionPayload {
  name?: string
  slug?: string
  aliases?: string[]
  lat?: number | null
  lng?: number | null
  status?: RegionStatus
}

/** Etiquetas para selects, sin repetir los literales en cada pantalla. */
export const REGION_TYPE_LABELS: Record<RegionType, string> = {
  municipality: 'Municipio',
  zone: 'Zona turistica',
}

export const REGION_STATUS_LABELS: Record<RegionStatus, string> = {
  active: 'Activa',
  inactive: 'Inactiva',
}
