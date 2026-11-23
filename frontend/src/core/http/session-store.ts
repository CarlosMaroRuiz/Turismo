import type { Session } from './types'

/**
 * Único lugar donde vive la sesión.
 *
 * Hoy es en memoria: el access token nunca toca `localStorage`, así que un
 * XSS no puede leerlo. El costo es que al recargar la página se pierde y hay
 * que volver a iniciar sesión.
 *
 * Cuando se decida cómo persistir el refresh token (cookie httpOnly, que
 * exige `credentials: true` en el CORS de la API, o almacenamiento en el
 * cliente asumiendo el riesgo) se cambia **solo este archivo**.
 */
let current: Session | null = null

export const sessionStore = {
  get: (): Session | null => current,
  getAccessToken: (): string | null => current?.accessToken ?? null,
  getRefreshToken: (): string | null => current?.refreshToken ?? null,
  set: (session: Session): void => {
    current = session
  },
  clear: (): void => {
    current = null
  },
  isAuthenticated: (): boolean => current !== null,
}
