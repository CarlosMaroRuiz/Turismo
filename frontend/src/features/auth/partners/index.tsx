import { Link } from 'react-router'

import { PATHS } from '@core/routes/types/paths'

import { AuthLayout } from '../components/AuthLayout'
import { LoginForm } from '../components/LoginForm'

import heroPartner from '@assets/hero-partner.webp'

export default function PartnerLoginPage() {
  return (
    <AuthLayout
      eyebrow="Socios"
      title="Tu hotel o agencia, conectado con más viajeros."
      subtitle="Publica paquetes, responde cotizaciones y gestiona tu disponibilidad."
      tone="acento"
      image={heroPartner}
      imageAlt="Botes de madera amarrados en un muelle sobre un lago turquesa rodeado de montañas"
    >
      <LoginForm
        titulo="Acceso para socios"
        subtitulo="Hoteles, agencias y prestadores de servicios."
        cta="Entrar a mi panel"
        onSubmit={(datos) => {
          // TODO: POST /auth/login con los datos y guardar el token
          console.log('login socio', datos)
        }}
        notaFinal={
          <>
            ¿Aún no tienes cuenta?{' '}
            <span className="cursor-pointer font-semibold text-acento hover:underline">
              Registra tu agencia
            </span>
          </>
        }
      />

      <p className="mt-8 text-center text-sm text-texto-oscuro/50">
        ¿Eres del equipo interno?{' '}
        <Link to={PATHS.loginAdmin} className="font-medium text-texto-oscuro/70 hover:underline">
          Acceso administrador
        </Link>
      </p>
    </AuthLayout>
  )
}
