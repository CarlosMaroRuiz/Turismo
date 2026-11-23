import type { ApiErrorResponse } from './types'

/**
 * Códigos que el contrato documenta y que el frontend trata distinto.
 * Es solo una sugerencia: la API siempre puede devolver un código nuevo,
 * así que la comparación real es contra `string`.
 */
export type KnownErrorCode =
  | 'VALIDATION_ERROR'
  | 'INVALID_CREDENTIALS'
  | 'ACCOUNT_INACTIVE'
  | 'PARTNER_INACTIVE'
  | 'PARTNER_ACCESS_REVOKED'
  | 'PASSWORD_CHANGE_REQUIRED'
  | 'INVALID_CURRENT_PASSWORD'
  | 'PASSWORD_REUSED'
  | 'ROUTE_NOT_FOUND'
  | 'INTERNAL_ERROR'
  | 'QUOTE_EXPIRED'
  | 'SESSION_EXPIRED'
  | 'NO_SESSION'
  | 'NETWORK_ERROR'
  | 'INVALID_RESPONSE'

export interface ApiErrorOptions {
  /** Errores por campo del 422, listos para pintar junto a cada input. */
  errors?: Record<string, string[]>
  /** `X-Request-Id` de la respuesta: sirve para rastrear el fallo en los logs. */
  requestId?: string
}

/**
 * Error normalizado del contrato.
 *
 * Conserva `code` para decidir sin comparar textos, `errors` para los
 * formularios y `requestId` para reportar un fallo concreto.
 */
export class ApiError extends Error {
  readonly status: number
  readonly code: string
  readonly errors: Record<string, string[]> | undefined
  readonly requestId: string | undefined

  constructor(
    status: number,
    code: string,
    message: string,
    options: ApiErrorOptions = {},
  ) {
    super(message)
    this.name = 'ApiError'
    this.status = status
    this.code = code
    this.errors = options.errors
    this.requestId = options.requestId
  }

  /** Construye el error desde el sobre `{ ok: false }` de la API. */
  static fromResponse(
    status: number,
    payload: ApiErrorResponse,
    requestId?: string,
  ): ApiError {
    return new ApiError(status, payload.code, payload.message, {
      errors: payload.errors,
      requestId,
    })
  }

  is(code: KnownErrorCode | string): boolean {
    return this.code === code
  }

  /** ¿Trae detalle por campo para pintar en el formulario? */
  get isValidation(): boolean {
    return this.errors !== undefined
  }

  /** 5xx: el mensaje del servidor no es apto para el usuario. */
  get isServerError(): boolean {
    return this.status >= 500
  }

  /** 401: sesión ausente o vencida. */
  get isUnauthorized(): boolean {
    return this.status === 401
  }

  /** Primer mensaje de error de un campo del formulario. */
  fieldError(field: string): string | undefined {
    return this.errors?.[field]?.[0]
  }
}

export function isApiError(error: unknown): error is ApiError {
  return error instanceof ApiError
}

/** Garantiza un `ApiError` a partir de cualquier cosa lanzada. */
export function asApiError(error: unknown): ApiError {
  if (error instanceof ApiError) {
    return error
  }
  if (error instanceof Error) {
    return new ApiError(0, 'UNKNOWN_ERROR', error.message)
  }
  return new ApiError(0, 'UNKNOWN_ERROR', 'Ocurrió un error inesperado')
}

/**
 * Mensaje listo para mostrar en pantalla.
 *
 * Para 5xx devuelve un texto propio a propósito: en desarrollo la API
 * manda el mensaje técnico real y en producción un genérico, así que
 * mostrarlo tal cual haría que la misma pantalla dijera cosas distintas
 * según el entorno (y podría filtrar detalles internos).
 */
export function toMessage(error: unknown): string {
  if (isApiError(error)) {
    return error.isServerError ? 'Ocurrió un error inesperado. Intenta de nuevo.' : error.message
  }
  if (error instanceof Error) {
    return error.message
  }
  return 'Ocurrió un error inesperado'
}
