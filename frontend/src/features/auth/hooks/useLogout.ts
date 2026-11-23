import { useCallback } from 'react'
import { useNavigate } from 'react-router'

import { sessionStore } from '@core/http'
import { PATHS } from '@core/routes/types/paths'

import { logout } from '../api'

/**
 * Cierra la sesion.
 *
 * Revoca el refresh token en la API y limpia el estado local. Si la
 * revocacion falla (token ya vencido, red caida) se limpia igual: el
 * usuario debe poder salir siempre.
 */
export function useLogout(): () => Promise<void> {
  const navigate = useNavigate()

  return useCallback(async (): Promise<void> => {
    const refreshToken = sessionStore.getRefreshToken()

    try {
      if (refreshToken !== null) {
        await logout(refreshToken)
      }
    } catch {
      // Se ignora a proposito: la sesion local se cierra de todas formas.
    }

    sessionStore.clear()
    navigate(PATHS.login, { replace: true })
  }, [navigate])
}
