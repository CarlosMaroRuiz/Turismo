import { api, sessionStore } from '@core/http'
import type { AuthenticatedUser, Session } from '@core/http'

import type { LoginCredentials, UserProfile } from './dto/auth.dto'

/**
 * Endpoints de `Autenticación` del contrato.
 * Devuelven `data` ya desenvuelto por el transporte.
 */

/** POST /auth/login — anónimo: no debe mandar un token viejo. */
export function login(credentials: LoginCredentials): Promise<Session> {
  return api.post<Session>('/auth/login', credentials, { skipAuth: true })
}

/** POST /auth/refresh — rota el refresh token y emite un par nuevo. */
export function refresh(refreshToken: string): Promise<Session> {
  return api.post<Session>('/auth/refresh', { refreshToken }, { skipAuth: true })
}

/** POST /auth/logout — revoca el refresh token indicado (data `null`). */
export function logout(refreshToken: string): Promise<null> {
  return api.post<null>('/auth/logout', { refreshToken }, { skipAuth: true })
}

/**
 * POST /auth/activate — activa la cuenta desde el enlace del correo.
 * El token es de un solo uso y viaja en la URL del mensaje.
 */
export function activateAccount(payload: { token: string; password: string }): Promise<null> {
  return api.post<null>('/auth/activate', payload, { skipAuth: true })
}

/** GET /auth/me — perfil del usuario autenticado. */
export function me(): Promise<UserProfile> {
  return api.get<UserProfile>('/auth/me')
}

/** POST /auth/change-password — devuelve una sesión nueva. */
export function changePassword(
  currentPassword: string,
  newPassword: string,
): Promise<Session> {
  return api.post<Session>('/auth/change-password', {
    currentPassword,
    newPassword,
  })
}

/**
 * Atajo: inicia sesión y guarda la sesión en `sessionStore`.
 * A dónde navegar lo decide el llamador, según `user.role`.
 */
export async function loginAndStore(
  credentials: LoginCredentials,
): Promise<AuthenticatedUser> {
  const session = await login(credentials)
  sessionStore.set(session)
  return session.user
}
