import type { ButtonShape, ButtonSize, ButtonVariant } from './type'

/**
 * Clases de Tailwind del botón. Ninguna clase de color se escribe aquí
 * como hexadecimal: todo sale de los tokens de `src/index.css`.
 */

/** Clases compartidas por toda variante y tamaño. */
export const buttonBase = [
  'inline-flex items-center justify-center gap-2',
  'font-semibold',
  'transition-colors duration-150',
  'cursor-pointer select-none',
  // Anillo de foco visible solo al navegar con teclado
  'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-acento focus-visible:ring-offset-2 focus-visible:ring-offset-fondo-claro',
  'disabled:pointer-events-none disabled:opacity-50',
].join(' ')

/**
 * La forma vive fuera de `buttonBase` para que exista una sola clase de
 * redondeo en el elemento y no dependa del orden del CSS generado.
 */
export const buttonShapes: Record<ButtonShape, string> = {
  rounded: 'rounded-lg',
  pill: 'rounded-full',
}

/**
 * El `Record` hace que el mapa sea exhaustivo: si agregas una variante
 * nueva en `type.ts`, esto no compila hasta que le pongas sus clases.
 */
export const buttonVariants: Record<ButtonVariant, string> = {
  // Fondo acento #C9005B, letra fondo-claro #F8F7F3
  primary: 'bg-acento text-fondo-claro hover:bg-acento-hover active:bg-acento-activo',

  // Contorno verde de marca #006853: solo dos colores en todo el sistema
  secondary: 'bg-transparent text-marca border border-marca hover:bg-marca/10 active:bg-marca/20',
}

export const buttonSizes: Record<ButtonSize, string> = {
  sm: 'h-9 px-3 text-sm',
  md: 'h-11 px-4 text-base',
  xl: 'h-14 px-8 text-lg',
}
