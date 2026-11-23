/**
 * Une clases de Tailwind descartando valores falsos.
 *
 * Nota: no resuelve conflictos entre clases (p. ej. `px-3` vs `px-6`).
 * Si más adelante necesitas que un `className` externo pueda sobrescribir
 * una clase del botón, se cambia esta función por `tailwind-merge`.
 */
type ClassValue = string | false | null | undefined

export function cn(...classes: ClassValue[]): string {
  return classes.filter(Boolean).join(' ')
}
