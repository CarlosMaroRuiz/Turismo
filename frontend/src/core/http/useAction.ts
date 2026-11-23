import { useCallback, useEffect, useRef, useState } from 'react'

import type { AsyncAction } from '@common/types/async'

import { asApiError } from './errors'
import type { ApiError } from './errors'

/**
 * Acción de escritura del contrato (login, alta, aprobar, suspender…).
 *
 * No se dispara sola: se ejecuta al enviar un formulario o pulsar un botón.
 * `execute` **rechaza** con `ApiError` además de guardarlo en `error`, para
 * que el llamador pueda encadenar navegación después del éxito.
 *
 * ```ts
 * const { execute, isLoading, error } = useAction((id: string) => approvePartner(id))
 * ```
 */
export function useAction<TInput, TOutput>(
  action: (input: TInput) => Promise<TOutput>,
): AsyncAction<TInput, TOutput> {
  const actionRef = useRef(action)

  useEffect(() => {
    actionRef.current = action
  }, [action])

  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState<ApiError | null>(null)

  const mountedRef = useRef(true)

  useEffect(() => {
    mountedRef.current = true
    return () => {
      mountedRef.current = false
    }
  }, [])

  const execute = useCallback(async (input: TInput): Promise<TOutput> => {
    setIsLoading(true)
    setError(null)

    try {
      const result = await actionRef.current(input)
      if (mountedRef.current) {
        setIsLoading(false)
      }
      return result
    } catch (thrown) {
      const apiError = asApiError(thrown)
      if (mountedRef.current) {
        setError(apiError)
        setIsLoading(false)
      }
      throw apiError
    }
  }, [])

  const reset = useCallback((): void => {
    setError(null)
    setIsLoading(false)
  }, [])

  return { execute, isLoading, error, reset }
}
