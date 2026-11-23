/**
 * Capacidades del portal del socio segun la categoria del negocio.
 *
 * La categoria es un dato editable: el administrador puede crear una nueva
 * (por ejemplo "transportista"), asi que el mapa tiene que tolerar codigos
 * desconocidos sin romper el portal.
 */
export type Capability = 'profile' | 'team' | 'packages' | 'rooms' | 'experiences'

const CAPABILITIES_BY_CATEGORY: Record<string, Capability[]> = {
  hotel: ['profile', 'team', 'rooms'],
  agency: ['profile', 'team', 'packages'],
  attraction: ['profile', 'team', 'experiences'],
}

/** Lo minimo que todo socio puede ver, sea cual sea su categoria. */
export const DEFAULT_CAPABILITIES: Capability[] = ['profile', 'team']

export function capabilitiesFor(categoryCode: string | null | undefined): Capability[] {
  if (categoryCode === null || categoryCode === undefined) {
    return DEFAULT_CAPABILITIES
  }
  return CAPABILITIES_BY_CATEGORY[categoryCode] ?? DEFAULT_CAPABILITIES
}

export const CAPABILITY_LABELS: Record<Capability, string> = {
  profile: 'Mi negocio',
  team: 'Equipo',
  packages: 'Paquetes',
  rooms: 'Habitaciones',
  experiences: 'Experiencias',
}

/** URL de cada seccion del portal. */
export const CAPABILITY_PATHS: Record<Capability, string> = {
  profile: '/panel/ficha',
  team: '/panel/equipo',
  packages: '/panel/paquetes',
  rooms: '/panel/habitaciones',
  experiences: '/panel/experiencias',
}
