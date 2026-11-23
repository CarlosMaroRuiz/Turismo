import type { ReactNode } from 'react'

import { Button } from '@common/Buttons'
import { SkeletonPage } from '@common/SkeletonPage'
import type { AsyncResource } from '@common/types/async'
import { toMessage } from '@core/http'

interface QueryStateProps<T> {
  /** El objeto que devuelve `useFetch`, `usePaginated` u otro `AsyncResource`. */
  query: AsyncResource<T>
  /** Que pintar en la primera carga. */
  skeleton?: ReactNode
  /** Que pintar cuando el dato esta vacio. */
  empty?: ReactNode
  /** Como saber que el dato esta vacio (por ejemplo `(p) => p.items.length === 0`). */
  isEmpty?: (data: T) => boolean
  /** Render del contenido cuando ya hay dato. */
  children: (data: T) => ReactNode
}

/**
 * Un solo lugar para los estados de una lectura: carga, error y vacio.
 *
 * Asi las pantallas no repiten tres ramas cada una, y el manejo del error
 * (mensaje amable para 5xx, `code` y `requestId` para soporte) es identico
 * en todo el panel.
 */
export function QueryState<T>({
  query,
  skeleton = <SkeletonPage />,
  empty,
  isEmpty,
  children,
}: QueryStateProps<T>) {
  if (query.isLoading) {
    return <>{skeleton}</>
  }

  if (query.error !== null) {
    return (
      <div role="alert" className="rounded-xl border border-borde bg-white p-6 text-center">
        <p className="text-texto-oscuro">{toMessage(query.error)}</p>
        <p className="mt-1 text-xs text-texto-oscuro/50">
          {query.error.code}
          {query.error.requestId !== undefined ? ` - ref ${query.error.requestId}` : ''}
        </p>
        <div className="mt-4 flex justify-center">
          <Button variant="secondary" size="sm" onClick={() => void query.refetch()}>
            Reintentar
          </Button>
        </div>
      </div>
    )
  }

  if (query.data === undefined) {
    return null
  }

  if (isEmpty?.(query.data) === true) {
    return (
      <>
        {empty ?? (
          <p className="rounded-xl border border-dashed border-borde p-8 text-center text-sm text-texto-oscuro/60">
            Sin resultados
          </p>
        )}
      </>
    )
  }

  return <>{children(query.data)}</>
}
