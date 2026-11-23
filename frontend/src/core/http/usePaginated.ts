import type { AsyncResource } from '@common/types/async'

import { api } from './client'
import type { Paginated } from './types'
import { useAsyncResource } from './useAsyncResource'
import type { UseFetchOptions } from './useFetch'

function cleanParams(params?: Record<string, unknown>): Record<string, unknown> | undefined {
  if (params === undefined) {
    return undefined
  }

  const entries = Object.entries(params).filter(
    ([, value]) => value !== undefined && value !== null,
  )

  return entries.length === 0 ? undefined : Object.fromEntries(entries)
}

function paramsKey(params?: Record<string, unknown>): string {
  if (params === undefined) {
    return ''
  }

  return Object.keys(params)
    .sort()
    .map((name) => `${name}=${JSON.stringify(params[name])}`)
    .join('&')
}

/**
 * Lectura de un listado paginado: devuelve los elementos **y** `meta`.
 *
 * Si la API responde un listado sin `meta`, el transporte lanza
 * `INVALID_RESPONSE`: es preferible un error explícito a una tabla sin
 * paginación que nadie entiende.
 *
 * ```ts
 * const socios = usePaginated<Partner>('/partners', { params: { page: 2, limit: 20 } })
 * socios.data?.items · socios.data?.meta.totalPages
 * ```
 */
export function usePaginated<T>(
  path: string,
  options: UseFetchOptions = {},
): AsyncResource<Paginated<T>> {
  const { params, enabled = true, skipAuth = false } = options
  const clean = cleanParams(params)

  const loader = (signal?: AbortSignal): Promise<Paginated<T>> =>
    api.getPaginated<T>(path, {
      ...(clean !== undefined && { params: clean }),
      ...(signal !== undefined && { signal }),
      ...(skipAuth && { skipAuth: true }),
    })

  return useAsyncResource<Paginated<T>>(loader, `${path}|${paramsKey(clean)}`, enabled)
}
