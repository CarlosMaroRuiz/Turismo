/**
 * Fuente unica de verdad de las URLs de la aplicacion.
 *
 * `PATHS` guarda solo URLs navegables. Los patrones con parametro (por
 * ejemplo el detalle de un socio) se construyen con las funciones de abajo,
 * para no confundir una ruta de React Router con una URL real.
 */
export const PATHS = {
  /** Acceso de socios (hoteles, agencias y atractivos). */
  login: '/login',
  /** Acceso del equipo interno. */
  loginAdmin: '/login/admin',
  /** Activacion de la cuenta de un socio desde el enlace del correo. */
  activateAccount: '/activate-account',
  /** Panel del administrador. */
  admin: '/admin',
  adminPartners: '/admin/socios',
  adminPartnerCreate: '/admin/socios/nuevo',
  adminCategories: '/admin/categorias',
  adminRegions: '/admin/regiones',
} as const

/** Nombres validos de ruta. */
export type KeyRoutes = keyof typeof PATHS

/** URL del detalle de un socio. */
export function partnerDetailPath(id: string): string {
  return `${PATHS.adminPartners}/${id}`
}
