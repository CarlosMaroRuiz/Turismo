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

/** Formas disponibles: rectángulo redondeado o pastilla. */
export type ButtonShape = 'rounded' | 'pill'

export interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  /** Color del botón. Por defecto `primary`. */
  variant?: ButtonVariant
  /** Tamaño del botón. Por defecto `md`. */
  size?: ButtonSize
  /** Forma: rectángulo redondeado (por defecto) o pastilla. */
  shape?: ButtonShape
  /** Ocupa todo el ancho del contenedor. */
  fullWidth?: boolean
}
