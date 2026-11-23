import type { AsyncResource } from '@common/types/async'

import { api } from './client'
import { useAsyncResource } from './useAsyncResource'

export interface UseFetchOptions {
  /** Query string; los valores `undefined` y `null` se omiten. */
  params?: Record<string, unknown>
  /** Si es `false`, no se dispara la petición (útil para dependencias). */
  enabled?: boolean
  /** No adjuntar el token (endpoints públicos con sesión abierta). */
  skipAuth?: boolean
}

/** Params sin nulos ni indefinidos, listos para axios y para la clave. */
function cleanParams(params?: Record<string, unknown>): Record<string, unknown> | undefined {
  if (params === undefined) {
    return undefined
  }

  const entries = Object.entries(params).filter(
    ([, value]) => value !== undefined && value !== null,
  )

  return entries.length === 0 ? undefined : Object.fromEntries(entries)
}

/**
 * Clave estable de la petición: el orden de las props no importa y los
 * nulos no cuentan. Evita el bucle de "el objeto cambia de identidad".
 */
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
 * Lectura de un recurso del contrato.
 *
 * ```ts
 * const socios = useFetch<Partner>('/partners/123')
 * const { data, isLoading, error, refetch } = socios
 * ```
 */
export function useFetch<T>(path: string, options: UseFetchOptions = {}): AsyncResource<T> {
  const { params, enabled = true, skipAuth = false } = options
  const clean = cleanParams(params)

  const loader = (signal?: AbortSignal): Promise<T> =>
    api.get<T>(path, {
      ...(clean !== undefined && { params: clean }),
      ...(signal !== undefined && { signal }),
      ...(skipAuth && { skipAuth: true }),
    })

  return useAsyncResource<T>(loader, `${path}|${paramsKey(clean)}`, enabled)
}
