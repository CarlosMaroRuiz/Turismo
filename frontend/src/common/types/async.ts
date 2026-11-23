import type { ApiError } from '@core/http/errors'

/**
 * Contrato de la vista para datos remotos.
 *
 * Es un contrato puro de UI: no sabe de axios, de hooks concretos ni de
 * URLs. Solo importa `ApiError` como tipo (se borra en compilación), para
 * que la vista pueda decidir por `code` sin perder información.
 */

/** Estado común de cualquier carga remota. */
export interface AsyncStatus {
  /** Primera carga: no hay nada que mostrar todavía. */
  isLoading: boolean
  /** Ya hay datos y se están revalidando (no vaciar la pantalla). */
  isRefreshing: boolean
  error: ApiError | null
  /** Vuelve a pedir los datos; resuelve cuando termina. */
  refetch: () => Promise<void>
}

/** Resultado de una lectura: el estado anterior más el dato. */
export interface AsyncResource<T> extends AsyncStatus {
  /**
   * `undefined` mientras no hay dato; el DTO puede ser legítimamente `null`
   * (por ejemplo un socio inexistente), así que las dos cosas no se mezclan.
   */
  data: T | undefined
}

/** Resultado de una escritura (login, alta, aprobar…). */
export interface AsyncAction<TInput, TOutput> {
  /** Ejecuta la acción; la promesa rechaza con `ApiError` si falla. */
  execute: (input: TInput) => Promise<TOutput>
  isLoading: boolean
  error: ApiError | null
  /** Limpia el error (por ejemplo al cerrar un modal). */
  reset: () => void
}

/**
 * Para validar que un hook de feature cumple el contrato sin enumerar
 * todos sus campos propios:
 *
 * ```ts
 * return { …campos } satisfies AsyncStatusShape
 * ```
 */
export type AsyncStatusShape = AsyncStatus & Record<string, unknown>
