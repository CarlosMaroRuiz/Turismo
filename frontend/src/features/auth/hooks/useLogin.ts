import { useCallback, useState } from 'react'
import { useNavigate } from 'react-router'

import { sessionStore, useAction } from '@core/http'
import type { ApiError } from '@core/http'
import { PATHS } from '@core/routes/types/paths'

import { loginAndStore } from '../api'
import type { LoginCredentials } from '../dto/auth.dto'

interface UseLoginResult {
  /** Inicia sesion y navega. Rechaza con `ApiError` si falla. */
  entrar: (credenciales: LoginCredentials) => Promise<void>
  isLoading: boolean
  error: ApiError | null
  /** Aviso propio cuando la cuenta existe pero no es de este acceso. */
  aviso: string | null
  reset: () => void
}

/**
 * Login del panel de administracion.
 *
 * El endpoint es el mismo para los dos perfiles, asi que despues de entrar
 * hay que verificar el rol: si un socio intenta por `/login/admin`, se
 * rechaza y se limpia la sesion que la API acaba de emitir.
 */
export function useLogin(): UseLoginResult {
  const navigate = useNavigate()
  const { execute, isLoading, error, reset } = useAction(loginAndStore)
  const [aviso, setAviso] = useState<string | null>(null)

  const entrar = useCallback(
    async (credenciales: LoginCredentials): Promise<void> => {
      setAviso(null)

      const user = await execute(credenciales)

      if (user.role !== 'super_user') {
        sessionStore.clear()
        setAviso('Esa cuenta no es de administrador. Usa el acceso de socios.')
        return
      }

      navigate(PATHS.admin, { replace: true })
    },
    [execute, navigate],
  )

  return { entrar, isLoading, error, aviso, reset }
}
