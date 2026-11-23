import { useState, type FormEvent } from 'react'
import { Navigate, useNavigate } from 'react-router'

import { Button } from '@common/Buttons'
import { FormField } from '@common/components/FormField'
import { inputClass } from '@common/components/FormField/styles'
import { sessionStore, toMessage, useAction } from '@core/http'
import { PATHS } from '@core/routes/types/paths'

import { AuthLayout } from '../components/AuthLayout'
import { changePassword } from '../api'

const MINIMO = 8

/**
 * Cambio obligatorio de contrasena.
 *
 * La API responde 403 `PASSWORD_CHANGE_REQUIRED` a cualquier operacion hasta
 * que la cuenta cambie la clave. Al guardar devuelve una sesion nueva (con
 * `mustChangePassword` en false), que se reemplaza en memoria.
 */
export default function ChangePasswordPage() {
  const navigate = useNavigate()
  const session = sessionStore.get()
  const { execute, isLoading, error, reset } = useAction(
    (datos: { actual: string; nueva: string }) => changePassword(datos.actual, datos.nueva),
  )

  const [actual, setActual] = useState('')
  const [nueva, setNueva] = useState('')
  const [repetida, setRepetida] = useState('')
  const [aviso, setAviso] = useState<string | null>(null)

  if (session === null) {
    return <Navigate to={PATHS.login} replace />
  }

  const enviar = (event: FormEvent<HTMLFormElement>): void => {
    event.preventDefault()

    if (nueva.length < MINIMO) {
      setAviso(`La contrasena nueva debe tener al menos ${MINIMO} caracteres.`)
      return
    }

    if (nueva !== repetida) {
      setAviso('Las dos contrasenas nuevas no coinciden.')
      return
    }

    if (nueva === actual) {
      setAviso('La contrasena nueva debe ser distinta de la actual.')
      return
    }

    setAviso(null)

    void execute({ actual, nueva })
      .then((sesion) => {
        sessionStore.set(sesion)
        navigate(sesion.user.role === 'super_user' ? PATHS.admin : PATHS.panel, { replace: true })
      })
      .catch(() => {
        // El error queda en `error` y se muestra en el formulario.
      })
  }

  const mensaje = aviso ?? (error !== null ? toMessage(error) : null)

  return (
    <AuthLayout
      eyebrow="Seguridad"
      title="Un paso mas antes de continuar."
      subtitle="La plataforma te pide cambiar la contrasena inicial por una tuya."
    >
      <header className="mb-7">
        <h1 className="text-2xl font-bold text-texto-oscuro">Cambia tu contrasena</h1>
        <p className="mt-1.5 text-sm text-texto-oscuro/55">
          Debes cambiar tu contrasena antes de continuar. La nueva debe tener al menos{' '}
          {MINIMO} caracteres.
        </p>
      </header>

      <form onSubmit={enviar} className="flex flex-col gap-4">
        <FormField htmlFor="claveActual" label="Contrasena actual" required hint={session.user.email}>
          <input
            id="claveActual"
            type="password"
            autoComplete="current-password"
            className={inputClass}
            required
            value={actual}
            onChange={(event) => {
              reset()
              setActual(event.target.value)
            }}
          />
        </FormField>

        <FormField htmlFor="claveNueva" label="Contrasena nueva" required>
          <input
            id="claveNueva"
            type="password"
            autoComplete="new-password"
            className={inputClass}
            required
            minLength={MINIMO}
            value={nueva}
            onChange={(event) => {
              reset()
              setNueva(event.target.value)
            }}
          />
        </FormField>

        <FormField htmlFor="claveRepetida" label="Repite la contrasena nueva" required>
          <input
            id="claveRepetida"
            type="password"
            autoComplete="new-password"
            className={inputClass}
            required
            minLength={MINIMO}
            value={repetida}
            onChange={(event) => {
              reset()
              setRepetida(event.target.value)
            }}
          />
        </FormField>

        {mensaje !== null && (
          <p role="alert" className="rounded-lg bg-acento/10 px-3 py-2 text-sm text-acento">
            {mensaje}
          </p>
        )}

        <Button type="submit" size="md" shape="pill" fullWidth disabled={isLoading}>
          {isLoading ? 'Guardando...' : 'Guardar y continuar'}
        </Button>
      </form>
    </AuthLayout>
  )
}
