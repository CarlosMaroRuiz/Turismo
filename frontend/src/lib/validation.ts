/**
 * Restricciones de captura copiadas de los esquemas Zod de la API.
 *
 * Fuente, en `api/src/features/`:
 * - `partner/dto/register-partner.dto.ts`
 * - `partner-category/dto/create-partner-category.dto.ts`
 * - `region/dto/create-region.dto.ts`
 * - `auth/dto/login.dto.ts`
 *
 * Se replican aqui para que el navegador bloquee lo mismo que la API rechaza
 * y el usuario vea el limite antes de enviar, no despues del 422.
 */

/** Kebab-case: minusculas, numeros y guiones simples. `pattern` de HTML. */
export const SLUG_PATTERN = '^[a-z0-9]+(?:-[a-z0-9]+)*$'

/** Longitud maxima de cualquier correo en el contrato. */
export const EMAIL_MAX = 150

export interface LengthLimit {
  min?: number
  max: number
}

export const PARTNER_LIMITS = {
  commercialName: { min: 2, max: 150 },
  legalName: { min: 2, max: 200 },
  description: { max: 2000 },
  address: { min: 5, max: 255 },
  contactName: { min: 2, max: 150 },
  contactPhone: { min: 7, max: 30 },
  ownerName: { min: 2, max: 150 },
  ownerPhone: { min: 7, max: 30 },
} satisfies Record<string, LengthLimit>

export const CATEGORY_LIMITS = {
  code: { min: 2, max: 30 },
  name: { min: 2, max: 100 },
} satisfies Record<string, LengthLimit>

export const REGION_LIMITS = {
  name: { min: 2, max: 150 },
  slug: { min: 2, max: 180 },
} satisfies Record<string, LengthLimit>

/** Texto listo para un `hint`: "Entre 2 y 150 caracteres". */
export function rango(limit: LengthLimit): string {
  if (limit.min === undefined) {
    return `Hasta ${limit.max} caracteres`
  }
  return `Entre ${limit.min} y ${limit.max} caracteres`
}
