import { SkeletonPage } from '@common/SkeletonPage'
import { lazy, Suspense, type ComponentType, type ReactNode } from 'react'

/**
 * Envuelve una página cargada con `import()` en un `<Suspense>`,
 * para usarla como `element` de una ruta.
 *
 * Se llama al definir las rutas (una sola vez, al cargar el módulo),
 * no dentro del render: por eso `lazy()` no se recrea en cada render.
 */
export const LoadSuspense = (
  importFn: () => Promise<{ default: ComponentType }>,
  fallback: ReactNode = <SkeletonPage />,
): ReactNode => {
  const LazyComponent = lazy(importFn)

  return (
    <Suspense fallback={fallback}>
      <LazyComponent />
    </Suspense>
  )
}
