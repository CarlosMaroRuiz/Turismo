import { useId, useState, type FormEvent, type ReactNode } from 'react'
import { EMAIL_MAX } from '@lib/validation'

interface LoginFormProps {
  /** Título principal (ej. "INICIAR SESIÓN"). */
  titulo?: string
  /** Subtítulo descriptivo. */
  subtitulo?: string
  /** Texto del botón principal. */
  cta?: string
  /** Bloquea el botón mientras se envía. */
  isLoading?: boolean
  /** Mensaje de error del servidor o aviso de rol. */
  error?: string | null
  /** Se llama al enviar. */
  onSubmit?: (datos: { email: string; password: string }) => void
  /** Contenido extra al pie (enlaces a otros accesos). */
  notaFinal?: ReactNode
}

function IconoUsuario() {
  return (
    <svg
      viewBox="0 0 24 24"
      width="16"
      height="16"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2" />
      <circle cx="12" cy="7" r="4" />
    </svg>
  )
}

function IconoCandado() {
  return (
    <svg
      viewBox="0 0 24 24"
      width="16"
      height="16"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <rect x="3" y="11" width="18" height="11" rx="2" ry="2" />
      <path d="M7 11V7a5 5 0 0 1 10 0v4" />
    </svg>
  )
}

function IconoOjo({ tachado }: { tachado: boolean }) {
  return (
    <svg
      viewBox="0 0 24 24"
      width="17"
      height="17"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <path d="M2.5 12s3.6-6 9.5-6 9.5 6 9.5 6-3.6 6-9.5 6-9.5-6Z" />
      <circle cx="12" cy="12" r="2.6" />
      {tachado && <path d="m4 20 16-16" />}
    </svg>
  )
}

export function LoginForm({
  titulo = 'INICIAR SESIÓN',
  subtitulo,
  cta = 'INICIAR SESIÓN',
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
  const [verPassword, setVerPassword] = useState(false)

  const handleSubmit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    onSubmit?.({ email, password })
  }

  return (
    <div className="flex flex-col">
      {/* Título en español con tipografía bold del sistema */}
      <header className="mb-6">
        <h1 className="text-2xl sm:text-3xl font-black uppercase tracking-wider text-texto-oscuro">
          {titulo}
        </h1>
        {subtitulo && (
          <p className="mt-1.5 text-xs sm:text-sm font-medium text-texto-oscuro/65">
            {subtitulo}
          </p>
        )}
      </header>

      <form onSubmit={handleSubmit} className="flex flex-col gap-4">
        {/* Campo Correo electrónico */}
        <div className="flex flex-col gap-1.5">
          <label
            htmlFor={emailId}
            className="text-xs font-bold tracking-wider text-texto-oscuro/85 uppercase"
          >
            Correo electrónico
          </label>
          <div className="relative flex h-12 w-full items-center rounded-full border border-marca/15 bg-marca/5 px-3.5 shadow-xs transition-all duration-200 focus-within:border-marca focus-within:bg-white focus-within:ring-2 focus-within:ring-marca/20">
            <div className="flex size-7.5 shrink-0 items-center justify-center rounded-full bg-white text-marca shadow-xs transition-transform duration-200">
              <IconoUsuario />
            </div>
            <input
              id={emailId}
              name="email"
              type="email"
              autoComplete="email"
              required
              maxLength={EMAIL_MAX}
              placeholder="e-mail"
              value={email}
              onChange={(event) => setEmail(event.target.value)}
              className="w-full bg-transparent px-3 text-sm font-semibold text-texto-oscuro placeholder:text-texto-oscuro/40 placeholder:font-normal focus:outline-none"
            />
          </div>
        </div>

        {/* Campo Contraseña */}
        <div className="flex flex-col gap-1.5">
          <label
            htmlFor={passwordId}
            className="text-xs font-bold tracking-wider text-texto-oscuro/85 uppercase"
          >
            Contraseña
          </label>
          <div className="relative flex h-12 w-full items-center rounded-full border border-marca/15 bg-marca/5 px-3.5 shadow-xs transition-all duration-200 focus-within:border-marca focus-within:bg-white focus-within:ring-2 focus-within:ring-marca/20">
            <div className="flex size-7.5 shrink-0 items-center justify-center rounded-full bg-white text-marca shadow-xs transition-transform duration-200">
              <IconoCandado />
            </div>
            <input
              id={passwordId}
              name="password"
              type={verPassword ? 'text' : 'password'}
              autoComplete="current-password"
              required
              placeholder="password"
              value={password}
              onChange={(event) => setPassword(event.target.value)}
              className="w-full bg-transparent px-3 text-sm font-semibold text-texto-oscuro placeholder:text-texto-oscuro/40 placeholder:font-normal focus:outline-none"
            />
            <button
              type="button"
              onClick={() => setVerPassword((v) => !v)}
              aria-label={verPassword ? 'Ocultar contraseña' : 'Mostrar contraseña'}
              className="p-1.5 text-texto-oscuro/40 hover:text-marca transition-colors cursor-pointer"
            >
              <IconoOjo tachado={!verPassword} />
            </button>
          </div>
        </div>

        {/* Términos de servicio en español */}
        <div className="flex flex-wrap items-center gap-1.5 pt-1 text-xs sm:text-sm">
          <label
            htmlFor={recordarId}
            className="flex cursor-pointer items-center gap-2 font-medium text-texto-oscuro/75"
          >
            <input
              id={recordarId}
              name="recordar"
              type="checkbox"
              defaultChecked
              className="size-4 cursor-pointer rounded border-borde accent-marca"
            />
            <span>Acepto todos los términos en</span>
          </label>
          <a
            href="#terminos"
            className="font-bold text-marca underline hover:opacity-80"
          >
            términos de servicio.
          </a>
        </div>

        {/* Mensaje de error con sacudida suave táctil */}
        {error !== null && (
          <p
            role="alert"
            className="anim-error rounded-xl bg-red-50 border border-red-200 px-3.5 py-2.5 text-xs font-semibold text-red-600"
          >
            {error}
          </p>
        )}

        {/* Botón principal con micro-interacción suave al hover y clic */}
        <button
          type="submit"
          disabled={isLoading}
          className="mt-2 self-start rounded-full bg-marca px-9 sm:px-11 py-3 text-xs sm:text-sm font-black uppercase tracking-wider text-fondo-claro shadow-md shadow-marca/25 transition-all duration-200 hover:-translate-y-0.5 hover:bg-marca/90 hover:shadow-lg hover:shadow-marca/35 active:translate-y-0 active:scale-95 disabled:pointer-events-none disabled:opacity-50 cursor-pointer"
        >
          {isLoading ? 'Entrando...' : cta}
        </button>
      </form>

      {/* Enlaces de pie */}
      {notaFinal && (
        <div className="mt-6 border-t border-borde/60 pt-4 text-xs text-texto-oscuro/60">
          {notaFinal}
        </div>
      )}
    </div>
  )
}
