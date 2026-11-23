import { useCallback, useEffect, useRef, useState } from 'react'
import axios from 'axios'

import type { AsyncResource } from '@common/types/async'
import { asApiError } from './errors'

interface ResourceState<T> {
  data: T | undefined
  isLoading: boolean
  isRefreshing: boolean
  error: ReturnType<typeof asApiError> | null
}

/**
 * Motor común de `useFetch` y `usePaginated`.
 *
 * `key` es la identidad de la petición: cuando cambia, se vuelve a pedir.
 * El `loader` se lee de un ref, así el hook puede recibir una función nueva
 * en cada render sin disparar peticiones ni exigir `useCallback` en la feature.
 */
export function useAsyncResource<T>(
  loader: (signal?: AbortSignal) => Promise<T>,
  key: string,
  enabled: boolean,
): AsyncResource<T> {
  const loaderRef = useRef(loader)

  // Se actualiza en cada render, antes del efecto de carga.
  useEffect(() => {
    loaderRef.current = loader
  }, [loader])

  const [state, setState] = useState<ResourceState<T>>({
    data: undefined,
    isLoading: enabled,
    isRefreshing: false,
    error: null,
  })

  const mountedRef = useRef(true)
  const requestIdRef = useRef(0)

  useEffect(() => {
    mountedRef.current = true
    return () => {
      mountedRef.current = false
    }
  }, [])

  const run = useCallback(async (signal?: AbortSignal): Promise<void> => {
    const requestId = ++requestIdRef.current

    setState((previous) => ({
      data: previous.data,
      error: null,
      isLoading: previous.data === undefined,
      isRefreshing: previous.data !== undefined,
    }))

    try {
      const result = await loaderRef.current(signal)

      // Respuesta vieja (llegó tarde) o componente desmontado: se descarta.
      if (!mountedRef.current || requestId !== requestIdRef.current) {
        return
      }

      setState({ data: result, isLoading: false, isRefreshing: false, error: null })
    } catch (error) {
      // Cancelar no es un fallo: el efecto se está limpiando.
      if (axios.isCancel(error)) {
        return
      }
      if (!mountedRef.current || requestId !== requestIdRef.current) {
        return
      }

      setState((previous) => ({
        data: previous.data,
        isLoading: false,
        isRefreshing: false,
        error: asApiError(error),
      }))
    }
  }, [])

  useEffect(() => {
    if (!enabled) {
      return
    }

    const controller = new AbortController()
    void run(controller.signal)

    return () => {
      controller.abort()
    }
  }, [key, enabled, run])

  const refetch = useCallback((): Promise<void> => run(), [run])

  return { ...state, refetch }
}
