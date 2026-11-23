/**
 * Formato de datos para la interfaz, en un solo lugar.
 *
 * Las fechas llegan como string ISO (`2026-11-23T00:24:28.950Z`) porque asi
 * las serializa la API; nunca se convierten a `Date` en los DTO.
 */

const dateFormatter = new Intl.DateTimeFormat('es-MX', {
  day: '2-digit',
  month: 'short',
  year: 'numeric',
})

const dateTimeFormatter = new Intl.DateTimeFormat('es-MX', {
  day: '2-digit',
  month: 'short',
  year: 'numeric',
  hour: '2-digit',
  minute: '2-digit',
})

/** `23 nov 2026`. Devuelve un guion si no hay valor o no es una fecha valida. */
export function formatDate(value: string | null | undefined): string {
  if (value === null || value === undefined || value === '') {
    return '-'
  }

  const date = new Date(value)
  return Number.isNaN(date.getTime()) ? '-' : dateFormatter.format(date)
}

/** `23 nov 2026, 00:24`. */
export function formatDateTime(value: string | null | undefined): string {
  if (value === null || value === undefined || value === '') {
    return '-'
  }

  const date = new Date(value)
  return Number.isNaN(date.getTime()) ? '-' : dateTimeFormatter.format(date)
}

/** Precios en MXN. La API manda numeros, no strings. */
const moneyFormatter = new Intl.NumberFormat('es-MX', {
  style: 'currency',
  currency: 'MXN',
  maximumFractionDigits: 2,
})

export function formatMoney(value: number | null | undefined): string {
  if (value === null || value === undefined) {
    return '-'
  }
  return moneyFormatter.format(value)
}
