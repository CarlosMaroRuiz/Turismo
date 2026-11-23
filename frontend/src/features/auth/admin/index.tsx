import { Link } from 'react-router'

import { toMessage } from '@core/http'
import { PATHS } from '@core/routes/types/paths'

import { AuthLayout } from '../components/AuthLayout'
import { LoginForm } from '../components/LoginForm'
import { useLogin } from '../hooks/useLogin'

export default function AdminLoginPage() {
  const { entrar, isLoading, error, aviso, reset } = useLogin()

  const mensajeError = aviso ?? (error !== null ? toMessage(error) : null)

  return (
    <AuthLayout
      eyebrow="Administración"
      title="PANEL DE CONTROL"
      subtitle="SUPERVISIÓN Y GESTIÓN"
    >
      <LoginForm
        titulo="ACCESO ADMINISTRADOR"
        subtitulo="Panel exclusivo para administradores de la plataforma."
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
          <div className="text-xs text-texto-oscuro/65">
            ¿Eres un socio?{' '}
            <Link to={PATHS.login} className="font-bold text-marca hover:underline">
              Entra por aquí
            </Link>
          </div>
        }
      />
    </AuthLayout>
  )
}
