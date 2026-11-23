/**
 * Capa HTTP del frontend.
 *
 * Punto único para hablar con la API de Turismo: axios con `/api/v1`,
 * Bearer automático, renovación del token ante 401, sobre
 * `{ ok, message, data }` desenvuelto y errores normalizados en `ApiError`.
 *
 * ```ts
 * import { api, ApiError } from '@core/http'
 * const socio = await api.get<Partner>('/partners/1')
 * const lista = await api.getPaginated<Partner>('/partners', { params: { page: 2 } })
 * ```
 */

export { API_URL } from '../config/env'

export { api, axiosClient, onSessionExpired, request } from './client'

export { ApiError, asApiError, isApiError, toMessage } from './errors'
export type { ApiErrorOptions, KnownErrorCode } from './errors'

export { sessionStore } from './session-store'

export { useFetch } from './useFetch'
export type { UseFetchOptions } from './useFetch'

export { usePaginated } from './usePaginated'

export { useAction } from './useAction'

export type {
  ApiEnvelope,
  ApiErrorResponse,
  ApiSuccessResponse,
  AuthenticatedUser,
  Paginated,
  PaginationMeta,
  PaginationParams,
  PartnerSummary,
  Session,
} from './types'
