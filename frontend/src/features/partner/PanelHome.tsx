import { Navigate } from 'react-router'

import { SkeletonPage } from '@common/SkeletonPage'
import { CAPABILITY_PATHS, capabilitiesFor } from '@core/auth/capabilities'
import type { Capability } from '@core/auth/capabilities'
import { sessionStore } from '@core/http'
import { PATHS } from '@core/routes/types/paths'
import { usePartnerCategories } from '@features/partner-categories'
import { usePartner } from '@features/partners'

/**
 * Orden de preferencia para la primera pantalla del portal.
 *
 * El hotel entra directo a su inventario de habitaciones y la agencia a sus
 * paquetes: es lo que van a usar todo el día. Quien no tiene catálogo propio
 * (atractivo, transporte) cae en la ficha.
 */
const PREFERIDAS: Capability[] = ['rooms', 'packages']

/**
 * Punto de entrada del panel del socio.
 *
 * Se resuelve con la categoría del negocio, que la API entrega junto con la
 * ficha y el catálogo de categorías. Mientras llegan esos datos se ve el
 * esqueleto, para no parpadear en la ficha y saltar después.
 */
export default function PanelHome() {
  const sesion = sessionStore.get()
  const socio = usePartner(sesion?.user.partner?.id)
  const categorias = usePartnerCategories(true)

  if (socio.isLoading || categorias.isLoading) {
    return <SkeletonPage />
  }

  const categoria = categorias.data?.find((item) => item.id === socio.data?.categoryId)
  const disponibles = capabilitiesFor(categoria?.code)
  const destino = PREFERIDAS.find((item) => disponibles.includes(item)) ?? 'profile'

  return <Navigate to={CAPABILITY_PATHS[destino] ?? PATHS.panelProfile} replace />
}
