import { api } from '@core/http'
import type { Paginated } from '@core/http'

import type {
  CreatePackagePayload,
  Departure,
  DeparturePayload,
  PackageDetail,
  PackageStatus,
  PackageSummary,
  UpdatePackagePayload,
} from './dto/package.dto'

const PACKAGE_PATHS = {
  list: '/packages',
  mine: '/packages/mine',
  item: (id: string) => `/packages/${id}`,
  status: (id: string) => `/packages/${id}/status`,
  departures: (id: string) => `/packages/${id}/departures`,
  departure: (id: string, departureId: string) => `/packages/${id}/departures/${departureId}`,
}

/** Paquetes del socio en cualquier estado (borradores incluidos). */
export function getMyPackages(): Promise<Paginated<PackageSummary>> {
  return api.getPaginated<PackageSummary>(PACKAGE_PATHS.mine, {
    params: { page: 1, limit: 100 },
  })
}

export function getPackage(id: string): Promise<PackageDetail> {
  return api.get<PackageDetail>(PACKAGE_PATHS.item(id))
}

export function createPackage(payload: CreatePackagePayload): Promise<PackageDetail> {
  return api.post<PackageDetail>(PACKAGE_PATHS.list, payload)
}

export function updatePackage(id: string, payload: UpdatePackagePayload): Promise<PackageDetail> {
  return api.patch<PackageDetail>(PACKAGE_PATHS.item(id), payload)
}

export function changePackageStatus(id: string, status: PackageStatus): Promise<PackageDetail> {
  return api.patch<PackageDetail>(PACKAGE_PATHS.status(id), { status })
}

export function addDeparture(id: string, payload: DeparturePayload): Promise<Departure> {
  return api.post<Departure>(PACKAGE_PATHS.departures(id), payload)
}

export function updateDeparture(
  id: string,
  departureId: string,
  payload: { status?: 'open' | 'closed'; totalSeats?: number; adultPrice?: number },
): Promise<Departure> {
  return api.patch<Departure>(PACKAGE_PATHS.departure(id, departureId), payload)
}
