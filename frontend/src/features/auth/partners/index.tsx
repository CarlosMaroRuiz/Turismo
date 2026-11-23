import { Link } from 'react-router'

import { toMessage } from '@core/http'
import { PATHS } from '@core/routes/types/paths'

import { AuthLayout } from '../components/AuthLayout'
import { LoginForm } from '../components/LoginForm'
import { useLogin } from '../hooks/useLogin'

export default function PartnerLoginPage() {
  const { entrar, isLoading, error, aviso, reset } = useLogin('partner')

  const mensajeError = aviso ?? (error !== null ? toMessage(error) : null)

  return (
    <AuthLayout
      eyebrow="Portal Socios"
      title="TURISMO"
      subtitle="HOTELES · TOURS · EXPERIENCIAS"
    >
      <LoginForm
        titulo="INICIAR SESIÓN"
        subtitulo="Acceso para hoteles, agencias y operadores."
        cta="ENTRAR"
        isLoading={isLoading}
        error={mensajeError}
        onSubmit={(datos) => {
          reset()
          void entrar(datos).catch(() => {
            // El error ya queda en el hook y se muestra arriba.
          })
        }}
        notaFinal={
          <div className="flex flex-col gap-1.5 text-xs text-texto-oscuro/65">
            <p>
              ¿Aún no tienes cuenta?{' '}
              <span className="cursor-pointer font-bold text-marca hover:underline">
                Registra tu agencia
              </span>
            </p>
            <p>
              ¿Equipo interno?{' '}
              <Link
                to={PATHS.loginAdmin}
                className="font-semibold text-acento hover:underline"
              >
                Acceso administrador
              </Link>
            </p>
          </div>
        }
      />
    </AuthLayout>
  )
}
