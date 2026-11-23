import type { ButtonHTMLAttributes } from 'react'

/**
 * Contrato del botón: aquí viven los tipos, no la implementación.
 * Al añadir un valor a cualquiera de estas uniones, TypeScript obliga
 * a agregar su clase correspondiente en `styles.ts` (ver el `Record`).
 */

/** Variantes de color disponibles. */
export type ButtonVariant = 'primary' | 'secondary'

/** Tamaños disponibles. */
export type ButtonSize = 'sm' | 'md' | 'xl'

export interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  /** Color del botón. Por defecto `primary`. */
  variant?: ButtonVariant
  /** Tamaño del botón. Por defecto `md`. */
  size?: ButtonSize
  /** Ocupa todo el ancho del contenedor. */
  fullWidth?: boolean
}
