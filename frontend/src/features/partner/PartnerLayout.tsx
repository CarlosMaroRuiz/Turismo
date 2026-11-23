import { NavLink, Navigate, Outlet } from 'react-router'

import { Button } from '@common/Buttons'
import { SkeletonPage } from '@common/SkeletonPage'
import {
  CAPABILITY_LABELS,
  CAPABILITY_PATHS,
  capabilitiesFor,
} from '@core/auth/capabilities'
import type { Capability } from '@core/auth/capabilities'
import { sessionStore } from '@core/http'
import { PATHS } from '@core/routes/types/paths'
import { useLogout } from '@features/auth/hooks/useLogout'
import { usePartnerCategories } from '@features/partner-categories'
import { usePartner } from '@features/partners'
import { cn } from '@lib/cn'

/**
 * Secciones que ya tienen pantalla. El resto de capacidades se calcula pero
 * no se pinta hasta que exista su pagina, para no ofrecer enlaces rotos.
 */
const IMPLEMENTED: Capability[] = ['profile', 'team', 'rooms', 'packages']

/**
 * Cascaron del portal del socio.
 *
 * La navegacion se arma con las capacidades de su categoria: un hotel ve
 * habitaciones, una agencia ve paquetes y un atractivo ve experiencias.
 * El codigo de categoria no viene en la sesion, asi que se resuelve cruzando
 * la ficha del socio con el catalogo de categorias.
 */
export default function PartnerLayout() {
  const cerrarSesion = useLogout()
  const session = sessionStore.get()
  const partnerId = session?.user.partner?.id

  const socio = usePartner(partnerId)
  const categorias = usePartnerCategories(true)

  if (session === null) {
    return <Navigate to={PATHS.login} replace />
  }

  if (session.user.role !== 'partner' || partnerId === undefined) {
    return <Navigate to={PATHS.login} replace />
  }

  // La API no deja operar hasta cambiar la contrasena inicial.
  if (session.user.mustChangePassword) {
    return <Navigate to={PATHS.changePassword} replace />
  }

  const categoria = categorias.data?.find((item) => item.id === socio.data?.categoryId)
  const disponibles = capabilitiesFor(categoria?.code).filter((item) =>
    IMPLEMENTED.includes(item),
  )

  return (
    <div className="flex min-h-screen bg-fondo-claro">
      <aside className="sticky top-0 hidden h-screen w-64 shrink-0 flex-col justify-between rounded-r-3xl bg-marca px-4 py-6 text-fondo-claro lg:flex">
        <div>
          <span className="mb-2 block px-3 text-xl font-bold tracking-tight">Turismo</span>
          <p className="mb-8 px-3 text-xs text-fondo-claro/70">
            {socio.data?.commercialName ?? 'Portal del socio'}
          </p>

          <nav className="flex flex-col gap-1.5">
            {disponibles.map((capability) => (
              <NavLink
                key={capability}
                to={CAPABILITY_PATHS[capability]}
                className={({ isActive }) =>
                  cn(
                    'rounded-xl px-3 py-2.5 text-sm font-medium transition-colors',
                    isActive
                      ? 'bg-fondo-claro text-marca shadow-sm'
                      : 'text-fondo-claro/75 hover:bg-white/10 hover:text-fondo-claro',
                  )
                }
              >
                {CAPABILITY_LABELS[capability]}
              </NavLink>
            ))}
          </nav>
        </div>

        <div className="px-3 text-xs text-fondo-claro/60">
          <p className="font-semibold text-fondo-claro/80">Sesion</p>
          <p className="mt-1 truncate">{session.user.email}</p>
        </div>
      </aside>

      <div className="flex min-w-0 flex-1 flex-col">
        <header className="flex items-center justify-between gap-4 px-6 py-5 lg:px-10">
          <div className="min-w-0">
            <p className="text-xs font-semibold uppercase tracking-[0.18em] text-marca">
              {categoria?.name ?? 'Portal del socio'}
            </p>
            <p className="truncate text-sm text-texto-oscuro/60">
              {session.user.name}
              {session.user.partner?.role === 'owner' ? ' · responsable' : ' · colaborador'}
            </p>
          </div>

          <Button variant="secondary" size="sm" onClick={() => void cerrarSesion()}>
            Salir
          </Button>
        </header>

        <main className="min-w-0 flex-1 px-6 pb-12 lg:px-10">
          {socio.isLoading ? <SkeletonPage /> : <Outlet />}
        </main>
      </div>
    </div>
  )
}
