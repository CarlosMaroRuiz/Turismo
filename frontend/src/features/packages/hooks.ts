import type { AsyncResource } from '@common/types/async'
import { useFetch, usePaginated } from '@core/http'
import type { Paginated } from '@core/http'

import type { PackageDetail, PackageSummary } from './dto/package.dto'

/** Paquetes del socio autenticado. */
export function useMyPackages(): AsyncResource<Paginated<PackageSummary>> {
  return usePaginated<PackageSummary>('/packages/mine', {
    params: { page: 1, limit: 100 },
  })
}

/** Detalle completo: items, itinerario y salidas. */
export function usePackageDetail(id: string | undefined): AsyncResource<PackageDetail> {
  return useFetch<PackageDetail>(id === undefined ? '' : `/packages/${id}`, {
    enabled: id !== undefined,
  })
}
