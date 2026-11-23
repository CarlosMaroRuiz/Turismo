import type { ReactNode } from 'react'

type BadgeTone = 'neutral' | 'success' | 'warning' | 'danger'

const toneClasses: Record<BadgeTone, string> = {
  neutral: 'border border-borde text-texto-oscuro/60',
  success: 'bg-marca/10 text-marca',
  warning: 'bg-acento/10 text-acento',
  danger: 'bg-acento text-fondo-claro',
}

interface BadgeProps {
  tone?: BadgeTone
  children: ReactNode
}

/** Etiqueta compacta para estados en tablas y fichas. */
export function Badge({ tone = 'neutral', children }: BadgeProps) {
  return (
    <span
      className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-semibold ${toneClasses[tone]}`}
    >
      {children}
    </span>
  )
}
