import { RouterProvider } from 'react-router'

import { router } from '@core/routes/router'

/**
 * Conecta el router de React Router con el árbol de React.
 * Se monta una sola vez, en `App.tsx`.
 */
export function RoutesProvider() {
  return <RouterProvider router={router} />
}
