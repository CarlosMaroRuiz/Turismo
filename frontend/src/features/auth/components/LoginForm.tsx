import { useId, useState, type FormEvent, type ReactNode } from 'react'

import { Button } from '@common/Buttons'
import { EMAIL_MAX } from '@lib/validation'

interface LoginFormProps {
  titulo: string
  subtitulo: string
  /** Texto del boton principal. */
  cta: string
  /** Bloquea el boton mientras se envia. */
  isLoading?: boolean
  /** Mensaje de error del servidor o aviso de rol. */
  error?: string | null
  /** Se llama al enviar. Aqui va la llamada a la API. */
  onSubmit?: (datos: { email: string; password: string }) => void
  /** Contenido extra al pie (por ejemplo, el registro de agencias). */
  notaFinal?: ReactNode
}

const inputClass =
  'h-11 w-full rounded-lg border border-borde bg-fondo-claro px-3 text-texto-oscuro placeholder:text-texto-oscuro/40 transition-colors focus:border-acento focus:outline-none focus:ring-2 focus:ring-acento/20'

const labelClass = 'text-sm font-medium text-texto-oscuro'

/**
 * Formulario de acceso compartido por los dos perfiles.
 * Solo cambia el copy; los campos son los mismos.
 */
export function LoginForm({
  titulo,
  subtitulo,
  cta,
  isLoading = false,
  error = null,
  onSubmit,
  notaFinal,
}: LoginFormProps) {
  const emailId = useId()
  const passwordId = useId()
  const recordarId = useId()

  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')

  const handleSubmit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    onSubmit?.({ email, password })
  }

  return (
    <>
      <header className="mb-8">
        <h1 className="text-2xl font-bold text-texto-oscuro">{titulo}</h1>
        <p className="mt-2 text-sm text-texto-oscuro/60">{subtitulo}</p>
      </header>

      <form onSubmit={handleSubmit} className="flex flex-col gap-5">
        <div className="flex flex-col gap-1.5">
          <label htmlFor={emailId} className={labelClass}>
            Correo electronico
          </label>
          <input
            id={emailId}
            name="email"
            type="email"
            autoComplete="email"
            required
            maxLength={EMAIL_MAX}
            placeholder="tu@correo.com"
            value={email}
            onChange={(event) => setEmail(event.target.value)}
            className={inputClass}
          />
        </div>

        <div className="flex flex-col gap-1.5">
          <label htmlFor={passwordId} className={labelClass}>
            Contrasena
          </label>
          <input
            id={passwordId}
            name="password"
            type="password"
            autoComplete="current-password"
            required
            placeholder="********"
            value={password}
            onChange={(event) => setPassword(event.target.value)}
            className={inputClass}
          />
        </div>

        <div className="flex items-center justify-between">
          <label
            htmlFor={recordarId}
            className="flex cursor-pointer items-center gap-2 text-sm text-texto-oscuro/80"
          >
            <input
              id={recordarId}
              name="recordar"
              type="checkbox"
              className="size-4 cursor-pointer accent-acento"
            />
            Recordarme
          </label>

          <span className="cursor-pointer text-sm font-medium text-acento hover:underline">
            Olvidaste tu contrasena?
          </span>
        </div>

        {error !== null && (
          <p role="alert" className="rounded-lg bg-acento/10 px-3 py-2 text-sm text-acento">
            {error}
          </p>
        )}

        <Button type="submit" size="md" fullWidth disabled={isLoading}>
          {isLoading ? 'Entrando...' : cta}
        </Button>
      </form>

      {notaFinal && <div className="mt-6 text-center text-sm text-texto-oscuro/60">{notaFinal}</div>}
    </>
  )
}
