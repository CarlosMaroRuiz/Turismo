import { Link } from 'react-router'

import { toMessage } from '@core/http'
import { PATHS } from '@core/routes/types/paths'

import { AuthLayout } from '../components/AuthLayout'
import { LoginForm } from '../components/LoginForm'
import { useLogin } from '../hooks/useLogin'

// Cuando tengas la imagen, colocala en src/assets/ y descomenta:
// import heroAdmin from '@assets/hero-admin.webp'

export default function AdminLoginPage() {
  const { entrar, isLoading, error, aviso, reset } = useLogin()

  const mensajeError = aviso ?? (error !== null ? toMessage(error) : null)

  return (
    <AuthLayout
      eyebrow="Administracion"
      title="Supervisa destinos, socios y comisiones."
      subtitle="Acceso exclusivo del equipo interno de Turismo."
      tone="marca"
      imageAlt=""
    >
      <LoginForm
        titulo="Acceso administrador"
        subtitulo="Usa tu cuenta corporativa."
        cta="Entrar al panel"
        isLoading={isLoading}
        error={mensajeError}
        onSubmit={(datos) => {
          reset()
          void entrar(datos).catch(() => {
            // El error ya queda en el hook y se muestra arriba.
          })
        }}
        notaFinal={
          <>
            Eres un socio?{' '}
            <Link to={PATHS.login} className="font-semibold text-acento hover:underline">
              Entra por aqui
            </Link>
          </>
        }
      />
    </AuthLayout>
  )
}
