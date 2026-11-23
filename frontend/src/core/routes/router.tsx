import { createBrowserRouter, redirect } from 'react-router'

import { LoadSuspense } from '@core/helpers/WithSuspense'
import { onPasswordChangeRequired, onSessionExpired } from '@core/http'
import { PATHS } from '@core/routes/types/paths'

/**
 * Configuracion de rutas.
 *
 * Cada pagina entra por `import()` perezoso, asi que el bundle inicial solo
 * trae el router. Este archivo no contiene JSX: es solo configuracion, y las
 * redirecciones se hacen con `loader` + `redirect`.
 */
export const router = createBrowserRouter([
  {
    path: '/',
    loader: () => redirect(PATHS.login),
  },
  {
    // Acceso de hoteles, agencias y atractivos
    path: PATHS.login,
    element: LoadSuspense(() => import('@features/auth/partners')),
  },
  {
    // Cambio obligatorio de contrasena (403 PASSWORD_CHANGE_REQUIRED)
    path: PATHS.changePassword,
    element: LoadSuspense(() => import('@features/auth/change-password')),
  },
  {
    // Activacion desde el enlace del correo de invitacion
    path: PATHS.activateAccount,
    element: LoadSuspense(() => import('@features/auth/activation')),
  },
  {
    // Acceso del equipo interno
    path: PATHS.loginAdmin,
    element: LoadSuspense(() => import('@features/auth/admin')),
  },
  {
    // Panel del administrador: el layout hace el guard de rol
    path: PATHS.admin,
    element: LoadSuspense(() => import('@features/admin/AdminLayout')),
    children: [
      {
        index: true,
        loader: () => redirect(PATHS.adminPartners),
      },
      {
        path: 'socios',
        element: LoadSuspense(() => import('@features/partners/pages/PartnerListPage')),
      },
      {
        path: 'socios/nuevo',
        element: LoadSuspense(() => import('@features/partners/pages/PartnerCreatePage')),
      },
      {
        path: 'socios/:id',
        element: LoadSuspense(() => import('@features/partners/pages/PartnerDetailPage')),
      },
      {
        path: 'categorias',
        element: LoadSuspense(
          () => import('@features/partner-categories/pages/CategoryListPage'),
        ),
      },
      {
        path: 'regiones',
        element: LoadSuspense(() => import('@features/regions/pages/RegionListPage')),
      },
    ],
  },
  {
    // Portal del socio: el layout arma la navegacion segun su categoria
    path: PATHS.panel,
    element: LoadSuspense(() => import('@features/partner/PartnerLayout')),
    children: [
      {
        index: true,
        loader: () => redirect(PATHS.panelTeam),
      },
      {
        path: 'equipo',
        element: LoadSuspense(() => import('@features/partner/pages/TeamPage')),
      },
      {
        path: 'ficha',
        element: LoadSuspense(() => import('@features/partner/pages/ProfilePage')),
      },
      {
        path: 'habitaciones',
        element: LoadSuspense(() => import('@features/rooms/pages/RoomListPage')),
      },
      {
        path: 'paquetes',
        element: LoadSuspense(() => import('@features/packages/pages/PackageListPage')),
      },
      {
        path: 'paquetes/:id',
        element: LoadSuspense(() => import('@features/packages/pages/PackageDetailPage')),
      },
    ],
  },
  {
    // Cualquier URL desconocida regresa al acceso publico
    path: '*',
    loader: () => redirect(PATHS.login),
  },
])

/**
 * Cuando el refresh token ya no sirve, el transporte limpia la sesion y avisa
 * aqui. El transporte no conoce el router, por eso el enganche se hace al
 * crear el router y no dentro de un componente.
 */
onSessionExpired(() => {
  void router.navigate(PATHS.login, { replace: true })
})

/**
 * La API responde 403 `PASSWORD_CHANGE_REQUIRED` mientras la cuenta no cambie
 * la contrasena. La sesion sigue siendo valida, asi que solo se redirige.
 */
onPasswordChangeRequired(() => {
  void router.navigate(PATHS.changePassword, { replace: true })
})
