import type { ReactNode } from 'react'

import kayakBg from '@assets/kayak-bg.jpg'
import loginBg from '@assets/login-bg.jpg'

interface AuthLayoutProps {
  /** Etiqueta pequeña sobre el formulario (ej. "Portal Socios", "Administración"). */
  eyebrow?: string
  /** Titular grande sobre la foto (ej. "TURISMO"). */
  title?: string
  /** Frase de apoyo bajo el titular (ej. "HOTELES · TOURS · EXPERIENCIAS"). */
  subtitle?: string
  /** URL de la imagen de fondo. Si no se pasa, usa la foto de agua turquesa con kayak. */
  image?: string
  imageAlt?: string
  /** El formulario. */
  children: ReactNode
}

/**
 * Layout estilo tarjeta flotante con borde rasgado y fotografía nítida:
 * - Fondo estático, cristalino y sereno (sin animaciones).
 * - Tarjeta central flotante con bordes redondeados y sombra suave.
 * - Lado izquierdo: formulario blanco con borde rasgado (torn paper) y colores de marca.
 * - Lado derecho: fotografía aérea con "TURISMO" y subtítulo de forma limpia y estática.
 */
export function AuthLayout({
  eyebrow,
  title = 'TURISMO',
  subtitle = 'HOTELES · TOURS · EXPERIENCIAS',
  image,
  imageAlt = 'Mar turquesa con kayak',
  children,
}: AuthLayoutProps) {
  const bgImage = image ?? kayakBg ?? loginBg

  return (
    <div className="relative flex min-h-screen w-full items-center justify-center p-3 sm:p-6 lg:p-10 overflow-x-hidden bg-oscuro-base">
      {/* Fondo completo de la pantalla: agua cristalina fija, clara y serena */}
      <div
        className="fixed inset-0 bg-cover bg-center bg-no-repeat filter brightness-95"
        style={{ backgroundImage: `url(${bgImage})` }}
      />

      {/* Overlay sutil para realzar la tarjeta flotante */}
      <div className="fixed inset-0 bg-oscuro-base/25 backdrop-blur-[1.5px] pointer-events-none" />

      {/* Tarjeta flotante central */}
      <div className="relative z-10 flex w-full max-w-4xl lg:max-w-5xl min-h-[540px] flex-col-reverse md:flex-row rounded-3xl overflow-hidden shadow-[0_25px_60px_-15px_rgba(0,0,0,0.5)] border border-white/20">
        {/* Panel formulario blanco con borde rasgado */}
        <div className="relative z-20 flex w-full md:w-[48%] lg:w-[46%] shrink-0 flex-col justify-center bg-white px-8 py-10 sm:px-12 sm:py-14">
          {/* Borde rasgado (Torn Paper Edge) vertical para pantallas medianas y grandes */}
          <div className="hidden md:block absolute top-0 bottom-0 -right-7 lg:-right-9 w-7 lg:w-9 h-full pointer-events-none z-30 overflow-visible">
            <svg
              viewBox="0 0 50 1000"
              preserveAspectRatio="none"
              className="w-full h-full drop-shadow-[5px_0_6px_rgba(0,0,0,0.18)]"
            >
              <path
                d="M 0,0 
                   L 0,1000 
                   L 14,1000
                   L 22,978 L 16,962 L 28,945 L 20,930 L 32,912 L 24,895 L 38,875 L 26,858 L 42,838 L 30,820 
                   L 46,802 L 34,785 L 48,765 L 36,748 L 44,730 L 32,712 L 46,692 L 35,675 L 49,655 L 38,638 
                   L 45,620 L 32,602 L 48,582 L 35,565 L 47,545 L 34,528 L 46,508 L 32,490 L 44,472 L 30,455 
                   L 46,435 L 34,418 L 48,398 L 36,380 L 45,362 L 32,345 L 46,325 L 35,308 L 49,288 L 36,270 
                   L 44,252 L 30,235 L 46,215 L 34,198 L 47,178 L 35,160 L 45,142 L 30,125 L 42,105 L 28,88 
                   L 38,68 L 24,50 L 34,32 L 20,15 L 14,0 
                   Z"
                fill="#ffffff"
              />
            </svg>
          </div>

          {/* Borde rasgado horizontal para móviles (borde superior del formulario) */}
          <div className="md:hidden absolute -top-6 left-0 right-0 h-6 w-full pointer-events-none z-30 overflow-visible">
            <svg
              viewBox="0 0 1000 50"
              preserveAspectRatio="none"
              className="w-full h-full drop-shadow-[0_-5px_6px_rgba(0,0,0,0.18)]"
            >
              <path
                d="M 0,50 L 1000,50 L 1000,36 L 978,28 L 962,34 L 945,22 L 930,30 L 912,18 L 895,26 L 875,12 L 858,24 L 838,8 L 820,20 L 802,4 L 785,16 L 765,2 L 748,14 L 730,6 L 712,18 L 692,4 L 675,15 L 655,1 L 638,12 L 620,5 L 602,18 L 582,2 L 565,15 L 545,3 L 528,16 L 508,4 L 490,18 L 472,6 L 455,20 L 435,4 L 418,16 L 398,2 L 380,14 L 362,5 L 345,18 L 325,4 L 308,15 L 288,1 L 270,14 L 252,6 L 235,20 L 215,4 L 198,16 L 178,3 L 160,15 L 142,5 L 125,20 L 105,8 L 88,22 L 68,12 L 50,26 L 32,16 L 15,30 L 0,36 Z"
                fill="#ffffff"
              />
            </svg>
          </div>

          {eyebrow && (
            <span className="inline-block text-xs font-bold uppercase tracking-[0.22em] text-marca mb-1">
              {eyebrow}
            </span>
          )}

          <div className="w-full">{children}</div>
        </div>

        {/* Panel con fotografía aérea y tipografía estática nítida */}
        <div className="relative flex flex-1 flex-col justify-end p-6 sm:p-8 lg:p-12 overflow-hidden min-h-[220px] sm:min-h-[280px] md:min-h-[500px]">
          <img
            src={bgImage}
            alt={imageAlt}
            className="absolute inset-0 size-full object-cover object-center"
            loading="eager"
            decoding="async"
          />
          <div className="absolute inset-0 bg-gradient-to-t from-black/55 via-black/20 to-transparent pointer-events-none" />

          {/* Tipografía en español estática, nítida y elegante */}
          <div className="relative z-10 text-right select-none pointer-events-none">
            <h2 className="text-3xl sm:text-4xl lg:text-5xl font-black uppercase tracking-wider text-fondo-claro drop-shadow-[0_4px_14px_rgba(0,0,0,0.85)] font-sans">
              {title}
            </h2>
            {subtitle && (
              <p className="mt-2 text-xs sm:text-sm lg:text-base font-extrabold uppercase tracking-[0.22em] text-fondo-claro/95 drop-shadow-[0_2px_8px_rgba(0,0,0,0.7)]">
                {subtitle}
              </p>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}
