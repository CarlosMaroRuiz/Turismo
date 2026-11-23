import axios, {
  type AxiosError,
  type AxiosInstance,
  type AxiosRequestConfig,
  type AxiosResponse,
} from 'axios'

import { API_URL } from '../config/env'
import { ApiError } from './errors'
import { sessionStore } from './session-store'
import type { ApiErrorResponse, ApiSuccessResponse, Paginated, Session } from './types'

declare module 'axios' {
  interface AxiosRequestConfig {
    /** No adjuntar el token aunque haya sesión (login, refresh, logout). */
    skipAuth?: boolean
    /** Interno: la petición ya se reintentó tras renovar el token. */
    retried?: boolean
  }
}

const TIMEOUT_MS = 15_000

/** Instancia con interceptores. La usa `api` y nadie más. */
export const axiosClient: AxiosInstance = axios.create({
  baseURL: API_URL,
  timeout: TIMEOUT_MS,
  headers: { Accept: 'application/json' },
})

/**
 * Instancia sin interceptores, solo para renovar el token.
 * Si la renovación usara `axiosClient`, un 401 del refresh volvería a
 * entrar al interceptor y se intentaría refrescar otra vez, en bucle.
 */
const refreshClient: AxiosInstance = axios.create({
  baseURL: API_URL,
  timeout: TIMEOUT_MS,
  headers: { Accept: 'application/json' },
})

/* ------------------------------------------------------------------ */
/* Guardas del sobre                                                   */
/* ------------------------------------------------------------------ */

function isSuccessResponse<T>(payload: unknown): payload is ApiSuccessResponse<T> {
  if (typeof payload !== 'object' || payload === null) {
    return false
  }
  const candidate = payload as { ok?: unknown; data?: unknown }
  return candidate.ok === true && 'data' in candidate
}

function isErrorResponse(payload: unknown): payload is ApiErrorResponse {
  if (typeof payload !== 'object' || payload === null) {
    return false
  }
  const candidate = payload as { ok?: unknown; code?: unknown }
  return candidate.ok === false && typeof candidate.code === 'string'
}

function readRequestId(headers: unknown): string | undefined {
  if (typeof headers !== 'object' || headers === null) {
    return undefined
  }
  const bag = headers as Record<string, unknown>
  const value = bag['x-request-id']
  return typeof value === 'string' ? value : undefined
}

function toApiError(error: unknown): ApiError {
  if (error instanceof ApiError) {
    return error
  }

  const axiosError = error as AxiosError<unknown>
  const response = axiosError.response
  const status = response?.status ?? 0
  const requestId = readRequestId(response?.headers)

  if (isErrorResponse(response?.data)) {
    return ApiError.fromResponse(status, response.data, requestId)
  }

  if (status === 0) {
    return new ApiError(
      0,
      'NETWORK_ERROR',
      `No se pudo conectar con la API en ${API_URL}. Revisa que el servidor este levantado.`,
    )
  }

  return new ApiError(
    status,
    'INVALID_RESPONSE',
    `La respuesta de ${API_URL} no sigue el contrato (HTTP ${status}). Revisa que la base de la API apunte al servidor correcto.`,
    { requestId },
  )
}

/* ------------------------------------------------------------------ */
/* Renovación del token: una sola a la vez                             */
/* ------------------------------------------------------------------ */

let refreshInFlight: Promise<string> | null = null

async function requestNewAccessToken(): Promise<string> {
  const refreshToken = sessionStore.getRefreshToken()
  if (refreshToken === null) {
    throw new ApiError(401, 'NO_SESSION', 'No hay sesión activa')
  }

  const response = await refreshClient.post<unknown>('/auth/refresh', { refreshToken })
  const payload = response.data

  if (!isSuccessResponse<Session>(payload)) {
    throw new ApiError(401, 'SESSION_EXPIRED', 'No se pudo renovar la sesión')
  }

  sessionStore.set(payload.data)
  return payload.data.accessToken
}

/**
 * Si cinco peticiones reciben 401 a la vez, se renueva una sola vez y
 * todas esperan la misma promesa. Sin esto, el refresh token rota en la
 * primera y las demás fallan, dejando al usuario fuera sin motivo.
 */
function refreshOnce(): Promise<string> {
  if (refreshInFlight === null) {
    refreshInFlight = requestNewAccessToken().finally(() => {
      refreshInFlight = null
    })
  }
  return refreshInFlight
}

let sessionExpiredHandler: (() => void) | null = null

/**
 * Qué hacer cuando la sesión no se puede renovar.
 * El transporte no conoce el router: quien monte la app registra aquí
 * la redirección a `/login`.
 */
export function onSessionExpired(handler: (() => void) | null): void {
  sessionExpiredHandler = handler
}

let passwordChangeHandler: (() => void) | null = null

/**
 * Qué hacer cuando la API responde 403 `PASSWORD_CHANGE_REQUIRED`.
 *
 * Es el caso de una cuenta con `mustChangePassword`: la sesión vale, pero la
 * API no deja operar hasta cambiar la contraseña. No se limpia la sesión,
 * solo se lleva al usuario a la pantalla de cambio.
 */
export function onPasswordChangeRequired(handler: (() => void) | null): void {
  passwordChangeHandler = handler
}

function isAuthPath(url: string | undefined): boolean {
  if (url === undefined) {
    return false
  }
  return url.includes('/auth/refresh') || url.includes('/auth/login')
}

/* ------------------------------------------------------------------ */
/* Interceptores                                                       */
/* ------------------------------------------------------------------ */

axiosClient.interceptors.request.use((config) => {
  if (config.skipAuth !== true) {
    const token = sessionStore.getAccessToken()
    if (token !== null) {
      config.headers.set('Authorization', `Bearer ${token}`)
    }
  }
  return config
})

axiosClient.interceptors.response.use(
  (response) => response,
  async (error: unknown) => {
    // Cancelar una petición no es un fallo de red.
    if (axios.isCancel(error)) {
      return Promise.reject(error)
    }

    const axiosError = error as AxiosError<unknown>
    const config = axiosError.config
    const status = axiosError.response?.status ?? 0

    const shouldRetry =
      status === 401 &&
      config !== undefined &&
      config.skipAuth !== true &&
      config.retried !== true &&
      !isAuthPath(config.url)

    if (shouldRetry && config !== undefined) {
      try {
        await refreshOnce()
        config.retried = true
        return await axiosClient.request(config)
      } catch {
        sessionStore.clear()
        sessionExpiredHandler?.()
        return Promise.reject(
          new ApiError(401, 'SESSION_EXPIRED', 'Tu sesión expiró. Vuelve a iniciar sesión.'),
        )
      }
    }

    const apiError = toApiError(error)

    if (apiError.status === 403 && apiError.code === 'PASSWORD_CHANGE_REQUIRED') {
      passwordChangeHandler?.()
    }

    return Promise.reject(apiError)
  },
)

/* ------------------------------------------------------------------ */
/* API pública                                                         */
/* ------------------------------------------------------------------ */

function parseEnvelope<T>(response: AxiosResponse<unknown>): ApiSuccessResponse<T> {
  const payload = response.data

  if (isSuccessResponse<T>(payload)) {
    return payload
  }

  if (isErrorResponse(payload)) {
    // Un 2xx con `ok: false` no debería existir, pero el contrato manda.
    throw ApiError.fromResponse(
      response.status,
      payload,
      readRequestId(response.headers),
    )
  }

  throw new ApiError(
    response.status,
    'INVALID_RESPONSE',
    'La respuesta del servidor no sigue el contrato',
    { requestId: readRequestId(response.headers) },
  )
}

/** Petición de bajo nivel: devuelve el sobre completo (con `meta` si existe). */
export async function request<T>(
  config: AxiosRequestConfig,
): Promise<ApiSuccessResponse<T>> {
  const response = await axiosClient.request<unknown>(config)
  return parseEnvelope<T>(response)
}

/**
 * Métodos tipados del contrato.
 *
 * Cada uno devuelve `data`; `getPaginated` además exige `meta`, porque un
 * listado sin paginación es un contrato roto y no debe pasar en silencio.
 */
export const api = {
  async get<T>(url: string, config: AxiosRequestConfig = {}): Promise<T> {
    const envelope = await request<T>({ ...config, method: 'GET', url })
    return envelope.data
  },

  async getPaginated<T>(
    url: string,
    config: AxiosRequestConfig = {},
  ): Promise<Paginated<T>> {
    const envelope = await request<T[]>({ ...config, method: 'GET', url })

    if (envelope.meta === undefined) {
      // `ApiResponse.paginated()` siempre lo manda; si falta, algo se rompió.
      throw new ApiError(200, 'INVALID_RESPONSE', 'El listado no trae meta de paginación')
    }

    return { items: envelope.data, meta: envelope.meta }
  },

  async post<T>(
    url: string,
    body?: unknown,
    config: AxiosRequestConfig = {},
  ): Promise<T> {
    const envelope = await request<T>({ ...config, method: 'POST', url, data: body })
    return envelope.data
  },

  async patch<T>(
    url: string,
    body?: unknown,
    config: AxiosRequestConfig = {},
  ): Promise<T> {
    const envelope = await request<T>({ ...config, method: 'PATCH', url, data: body })
    return envelope.data
  },

  async put<T>(
    url: string,
    body?: unknown,
    config: AxiosRequestConfig = {},
  ): Promise<T> {
    const envelope = await request<T>({ ...config, method: 'PUT', url, data: body })
    return envelope.data
  },

  async delete<T>(url: string, config: AxiosRequestConfig = {}): Promise<T> {
    const envelope = await request<T>({ ...config, method: 'DELETE', url })
    return envelope.data
  },
}
