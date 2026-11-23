import type { ReactNode } from 'react'

type Tone = 'marca' | 'acento'

interface AuthLayoutProps {
  /** Etiqueta pequeña sobre el titular ("Administración", "Socios"). */
  eyebrow: string
  /** Titular grande sobre la imagen. */
  title: string
  /** Frase de apoyo bajo el titular. */
  subtitle: string
  /** Color del panel cuando todavía no hay imagen. */
  tone?: Tone
  /** URL de la imagen de fondo. Si falta, se usa el color del tono. */
  image?: string
  imageAlt?: string
  /** El formulario. */
  children: ReactNode
}

const toneBackground: Record<Tone, string> = {
  marca: 'bg-marca',
  acento: 'bg-acento',
}

/**
 * Estructura de las pantallas de acceso: imagen a la izquierda,
 * formulario a la derecha. En móvil la imagen desaparece y el
 * formulario ocupa todo, que es lo que conviene en pantallas chicas.
 */
export function AuthLayout({
  eyebrow,
  title,
  subtitle,
  tone = 'marca',
  image,
  imageAlt = '',
  children,
}: AuthLayoutProps) {
  return (
    <div className="grid min-h-screen lg:grid-cols-2">
      <section className={`relative isolate hidden overflow-hidden lg:block ${toneBackground[tone]}`}>
        {image && (
          <img
            src={image}
            alt={imageAlt}
            className="absolute inset-0 -z-10 size-full object-cover"
            loading="lazy"
            decoding="async"
          />
        )}

        {/* Oscurece la parte baja para que el texto blanco siempre tenga contraste,
            sea cual sea la foto que se use. */}
        <div className="absolute inset-0 -z-10 bg-linear-to-t from-black/75 via-black/25 to-transparent" />

        <div className="flex h-full flex-col justify-between p-12 text-fondo-claro">
          <span className="text-2xl font-bold">Turismo</span>

          <div className="max-w-md">
            <p className="text-xs font-semibold uppercase tracking-[0.2em] text-fondo-claro/70">
              {eyebrow}
            </p>
            <h2 className="mt-3 text-4xl font-bold leading-tight">{title}</h2>
            <p className="mt-4 text-fondo-claro/80">{subtitle}</p>
          </div>

          <p className="text-sm text-fondo-claro/60">© 2026 Turismo</p>
        </div>
      </section>

      <section className="flex items-center justify-center bg-fondo-claro px-4 py-12">
        <div className="w-full max-w-sm">{children}</div>
      </section>
    </div>
  )
}
