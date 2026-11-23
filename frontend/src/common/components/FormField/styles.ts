/**
 * Estilos compartidos de campos de formulario.
 *
 * Viven aparte del componente `FormField` para que el archivo `.tsx` solo
 * exporte el componente (regla de Fast Refresh).
 */

const base =
  'w-full rounded-lg border bg-white px-3 text-texto-oscuro placeholder:text-texto-oscuro/40 transition-colors focus:outline-none focus:ring-2 focus:ring-acento/20'

export const inputClass = `${base} h-11 border-borde focus:border-acento`
export const selectClass = `${base} h-11 border-borde focus:border-acento`
export const textareaClass = `${base} min-h-24 border-borde py-2 focus:border-acento`
export const labelClass = 'text-sm font-medium text-texto-oscuro'
export const hintClass = 'text-xs text-texto-oscuro/50'
export const errorClass = 'text-xs font-medium text-acento'
