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
 * Login del panel y del portal.
 *
 * El endpoint es el mismo para los dos perfiles, asi que despues de entrar hay
 * que verificar el rol: si una cuenta entra por el acceso equivocado se
 * rechaza y se limpia la sesion que la API acaba de emitir.
 */
export function useLogin(esperado: 'super_user' | 'partner' = 'super_user'): UseLoginResult {
  const navigate = useNavigate()
  const { execute, isLoading, error, reset } = useAction(loginAndStore)
  const [aviso, setAviso] = useState<string | null>(null)

  const entrar = useCallback(
    async (credenciales: LoginCredentials): Promise<void> => {
      setAviso(null)

      const user = await execute(credenciales)

      if (user.role !== esperado) {
        sessionStore.clear()
        setAviso(
          esperado === 'super_user'
            ? 'Esa cuenta no es de administrador. Usa el acceso de socios.'
            : 'Esa cuenta no es de socio. Usa el acceso de administrador.',
        )
        return
      }

      if (user.mustChangePassword) {
        navigate(PATHS.changePassword, { replace: true })
        return
      }

      navigate(esperado === 'super_user' ? PATHS.admin : PATHS.panel, { replace: true })
    },
    [esperado, execute, navigate],
  )

  return { entrar, isLoading, error, aviso, reset }
}
