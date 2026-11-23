import { RoutesProvider } from '@core/routes/provider'

/**
 * Punto de composición global: aquí se montarán los providers
 * que envuelvan toda la app (sesión, tema, notificaciones).
 * Por ahora solo el router.
 */
export default function App() {
  return <RoutesProvider />
}
