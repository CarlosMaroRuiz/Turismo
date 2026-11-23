import type { PartnerSummary } from '@core/http'

/** Credenciales del formulario de acceso. */
export interface LoginCredentials {
  email: string
  password: string
}

/**
 * `data` de GET /auth/me.
 * Espejo de `api/src/features/auth/responses/user-profile.response.ts`.
 */
export interface UserProfile {
  id: string
  name: string
  email: string
  phone: string | null
  status: string
  mustChangePassword: boolean
  /** La API lo declara `unknown`; normalmente es la entidad de rol. */
  role: unknown
  partner: PartnerSummary | null
}

/** La sesión es transversal, por eso vive en `@core/http`. */
export type { AuthenticatedUser, Session } from '@core/http'
