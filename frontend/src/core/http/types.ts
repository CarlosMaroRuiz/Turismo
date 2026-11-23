/**
 * Forma del contrato de la API (OpenAPI 3.1 de Turismo API).
 *
 * Los nombres son espejo de `api/src/core/http/api-response.types.ts`:
 * mismo nombre y mismos campos, para que un `grep` entre los dos repos
 * encuentre el equivalente de inmediato.
 */

/** `meta` de los listados paginados. */
export interface PaginationMeta {
  page: number
  limit: number
  total: number
  totalPages: number
}

/** Parámetros de paginación que aceptan los listados. */
export interface PaginationParams {
  page?: number
  limit?: number
}

/** Sobre de éxito: `{ ok: true, message, data, meta? }`. */
export interface ApiSuccessResponse<T = unknown> {
  ok: true
  message: string
  data: T
  /** Solo en listados paginados; si no aplica, la clave no existe. */
  meta?: PaginationMeta
}

/** Sobre de error: `{ ok: false, code, message, errors? }`. */
export interface ApiErrorResponse {
  ok: false
  /** Código estable legible por máquina, por ejemplo "VALIDATION_ERROR". */
  code: string
  message: string
  /** Errores por campo, solo cuando `code` es VALIDATION_ERROR. */
  errors?: Record<string, string[]>
}

export type ApiEnvelope<T> = ApiSuccessResponse<T> | ApiErrorResponse

/** Resultado de un listado: los elementos y su paginación. */
export interface Paginated<T> {
  items: T[]
  meta: PaginationMeta
}

/* ------------------------------------------------------------------ */
/* Sesión                                                             */
/*                                                                     */
/* Vive aquí, y no en `features/auth`, porque el interceptor de axios  */
/* la necesita para renovar el token: es estado transversal.           */
/* ------------------------------------------------------------------ */

/** Socio al que pertenece el usuario. En login viene sin `slug`. */
export interface PartnerSummary {
  id: string
  commercialName: string
  role?: string
  slug?: string
}

export interface AuthenticatedUser {
  id: string
  name: string
  email: string
  /** Código del rol global: 'super_user' | 'partner'. */
  role: string
  mustChangePassword: boolean
  partner: PartnerSummary | null
}

/** `data` de POST /auth/login, /auth/refresh y /auth/change-password. */
export interface Session {
  accessToken: string
  refreshToken: string
  /** TTL del access token, por ejemplo "15m". */
  expiresIn: string
  user: AuthenticatedUser
}
