import { useState, type FormEvent } from 'react'
import { Link, useSearchParams } from 'react-router'

import { Button } from '@common/Buttons'
import { FormField } from '@common/components/FormField'
import { inputClass } from '@common/components/FormField/styles'
import { toMessage, useAction } from '@core/http'
import { PATHS } from '@core/routes/types/paths'

import { activateAccount } from '../api'

const PASSWORD_MIN = 8

/**
 * Activacion de la cuenta de un socio.
 *
 * Llega desde el boton del correo de invitacion: la URL trae `?token=...`.
 * Define la contrasena y llama a `POST /auth/activate`. El token es de un
 * solo uso: reutilizarlo responde 400 ACTIVATION_TOKEN_USED.
 */
export default function ActivateAccountPage() {
  const [searchParams] = useSearchParams()
  const token = searchParams.get('token') ?? ''

  const activar = useAction(activateAccount)

  const [password, setPassword] = useState('')
  const [confirmacion, setConfirmacion] = useState('')
  const [aviso, setAviso] = useState<string | null>(null)
  const [listo, setListo] = useState(false)

  const enviar = (event: FormEvent<HTMLFormElement>): void => {
    event.preventDefault()
    setAviso(null)

    if (password !== confirmacion) {
      setAviso('Las contrasenas no coinciden.')
      return
    }

    void activar
      .execute({ token, password })
      .then(() => {
        setListo(true)
      })
      .catch(() => {
        // El error queda en `activar.error` y se muestra abajo.
      })
  }

  const mensajeError = aviso ?? (activar.error !== null ? toMessage(activar.error) : null)

  return (
    <main className="flex min-h-screen items-center justify-center bg-fondo-claro px-4 py-12">
      <div className="w-full max-w-md">
        <span className="text-2xl font-bold text-marca">Turismo</span>

        {token === '' ? (
          <>
            <h1 className="mt-6 text-2xl font-bold text-texto-oscuro">Enlace incompleto</h1>
            <p className="mt-2 text-sm text-texto-oscuro/60">
              Falta el token de activacion. Abre el enlace del correo tal como llego, sin recortarlo.
            </p>
            <p className="mt-6 text-sm">
              <Link to={PATHS.login} className="font-semibold text-acento hover:underline">
                Volver al acceso
              </Link>
            </p>
          </>
        ) : listo ? (
          <>
            <h1 className="mt-6 text-2xl font-bold text-texto-oscuro">Cuenta activada</h1>
            <p className="mt-2 text-sm text-texto-oscuro/60">
              Ya puedes iniciar sesion con tu correo y la contrasena que acabas de definir.
            </p>
            <Link
              to={PATHS.login}
              className="mt-6 inline-flex h-11 items-center justify-center rounded-lg bg-acento px-5 text-sm font-semibold text-fondo-claro transition-colors hover:bg-acento-hover"
            >
              Ir al acceso
            </Link>
          </>
        ) : (
          <>
            <h1 className="mt-6 text-2xl font-bold text-texto-oscuro">Activa tu cuenta</h1>
            <p className="mt-2 text-sm text-texto-oscuro/60">
              Define la contrasena con la que entraras al panel de tu negocio.
            </p>

            <form onSubmit={enviar} className="mt-8 flex flex-col gap-4">
              <FormField
                htmlFor="password"
                label="Contrasena"
                required
                hint={`Minimo ${PASSWORD_MIN} caracteres`}
                error={activar.error?.fieldError('password')}
              >
                <input
                  id="password"
                  type="password"
                  required
                  minLength={PASSWORD_MIN}
                  autoComplete="new-password"
                  value={password}
                  onChange={(event) => setPassword(event.target.value)}
                  className={inputClass}
                />
              </FormField>

              <FormField htmlFor="confirmacion" label="Repite la contrasena" required>
                <input
                  id="confirmacion"
                  type="password"
                  required
                  minLength={PASSWORD_MIN}
                  autoComplete="new-password"
                  value={confirmacion}
                  onChange={(event) => setConfirmacion(event.target.value)}
                  className={inputClass}
                />
              </FormField>

              {mensajeError !== null && (
                <p role="alert" className="rounded-lg bg-acento/10 px-3 py-2 text-sm text-acento">
                  {mensajeError}
                </p>
              )}

              <Button type="submit" size="md" fullWidth disabled={activar.isLoading}>
                {activar.isLoading ? 'Activando...' : 'Activar cuenta'}
              </Button>
            </form>

            <p className="mt-6 text-center text-sm text-texto-oscuro/60">
              El enlace caduca en 48 horas y solo sirve una vez.
            </p>
          </>
        )}
      </div>
    </main>
  )
}
