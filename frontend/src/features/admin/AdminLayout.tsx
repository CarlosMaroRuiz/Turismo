import { NavLink, Navigate, Outlet } from 'react-router'

import { Button } from '@common/Buttons'
import { sessionStore } from '@core/http'
import { PATHS } from '@core/routes/types/paths'
import { useLogout } from '@features/auth/hooks/useLogout'
import { cn } from '@lib/cn'

const NAV_ITEMS = [
  { to: PATHS.adminPartners, label: 'Socios' },
  { to: PATHS.adminCategories, label: 'Categorias' },
  { to: PATHS.adminRegions, label: 'Regiones' },
]

/**
 * Cascaron del panel.
 *
 * Sidebar pintado con el verde de marca y contenido sobre fondo claro, para
 * que la navegacion se lea como una sola pieza y el area de trabajo quede
 * como tarjeta. El guard de rol vive aqui: una ruta nueva queda protegida
 * sin tener que acordarse de nada.
 */
export default function AdminLayout() {
  const cerrarSesion = useLogout()
  const session = sessionStore.get()

  // Sesion en memoria: al recargar se pierde y se vuelve al acceso.
  if (session === null) {
    return <Navigate to={PATHS.loginAdmin} replace />
  }

  if (session.user.role !== 'super_user') {
    return <Navigate to={PATHS.loginAdmin} replace />
  }

  return (
    <div className="flex min-h-screen bg-fondo-claro">
      <aside className="sticky top-0 hidden h-screen w-64 shrink-0 flex-col justify-between rounded-r-3xl bg-marca px-4 py-6 text-fondo-claro lg:flex">
        <div>
          <span className="mb-10 block px-3 text-xl font-bold tracking-tight">Turismo</span>

          <nav className="flex flex-col gap-1.5">
            {NAV_ITEMS.map((item) => (
              <NavLink
                key={item.to}
                to={item.to}
                className={({ isActive }) =>
                  cn(
                    'rounded-xl px-3 py-2.5 text-sm font-medium transition-colors',
                    isActive
                      ? 'bg-fondo-claro text-marca shadow-sm'
                      : 'text-fondo-claro/75 hover:bg-white/10 hover:text-fondo-claro',
                  )
                }
              >
                {item.label}
              </NavLink>
            ))}
          </nav>
        </div>

        <div className="px-3 text-xs text-fondo-claro/60">
          <p className="font-semibold text-fondo-claro/80">Panel interno</p>
          <p className="mt-1 truncate">{session.user.email}</p>
        </div>
      </aside>

      <div className="flex min-w-0 flex-1 flex-col">
        <header className="flex items-center justify-between gap-4 px-6 py-5 lg:px-10">
          <div className="min-w-0">
            <p className="text-xs font-semibold uppercase tracking-[0.18em] text-marca">
              Administracion
            </p>
          </div>

          <div className="flex items-center gap-3">
            <span className="hidden truncate text-sm text-texto-oscuro/60 sm:block">
              {session.user.name}
            </span>
            <Button variant="secondary" size="sm" onClick={() => void cerrarSesion()}>
              Salir
            </Button>
          </div>
        </header>

        <main className="min-w-0 flex-1 px-6 pb-12 lg:px-10">
          <Outlet />
        </main>
      </div>
    </div>
  )
}
