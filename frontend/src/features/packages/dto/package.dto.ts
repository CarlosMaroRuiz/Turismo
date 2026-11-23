/** Contrato de paquetes, copiado de los esquemas Zod de la API. */

export type PackageStatus = 'draft' | 'published' | 'paused'

export type PackageItemType = 'lodging' | 'transport' | 'meals' | 'activity' | 'other'

export type DepartureStatus = 'open' | 'closed'

export interface PackageSummary {
  id: string
  partnerId: string
  partnerName: string
  destinationRegionId: string
  destinationRegionName: string
  name: string
  slug: string
  summary: string
  nights: number
  days: number
  minTravelers: number
  maxTravelers: number | null
  minPriceAdult: number | null
  images: string[]
  status: PackageStatus
  createdAt: string
}

export interface PackageItem {
  id: string
  type: PackageItemType
  description: string
  isIncluded: boolean
  sortOrder: number
}

export interface ItineraryDay {
  id: string
  dayNumber: number
  title: string
  description: string
}

export interface Departure {
  id: string
  departureDate: string
  totalSeats: number
  soldSeats: number
  availableSeats: number
  adultPrice: number
  childPrice: number | null
  status: DepartureStatus
}

export interface PackageDetail extends PackageSummary {
  description: string
  meetingPoint: string | null
  requirements: string | null
  cancellationPolicy: string
  taxesIncluded: boolean
  childMinAge: number | null
  childMaxAge: number | null
  items: PackageItem[]
  itinerary: ItineraryDay[]
  departures: Departure[]
  promotions: unknown[]
}

export interface CreatePackagePayload {
  destinationRegionId: string
  name: string
  summary: string
  description: string
  nights: number
  minTravelers: number
  cancellationPolicy: string
  meetingPoint?: string
  taxesIncluded: boolean
}

/** Item o dia tal como los espera la API al reemplazar los arreglos. */
export interface PackageItemInput {
  type: PackageItemType
  description: string
  isIncluded: boolean
  sortOrder: number
}

export interface ItineraryDayInput {
  dayNumber: number
  title: string
  description: string
}

export interface UpdatePackagePayload {
  items?: PackageItemInput[]
  itinerary?: ItineraryDayInput[]
  images?: string[]
  name?: string
  summary?: string
  description?: string
  nights?: number
  meetingPoint?: string
  cancellationPolicy?: string
}

export interface DeparturePayload {
  departureDate: string
  totalSeats: number
  adultPrice: number
  childPrice?: number
}

export const PACKAGE_STATUS_LABELS: Record<PackageStatus, string> = {
  draft: 'Borrador',
  published: 'Publicado',
  paused: 'Pausado',
}

export const PACKAGE_ITEM_LABELS: Record<PackageItemType, string> = {
  lodging: 'Hospedaje',
  transport: 'Transporte',
  meals: 'Alimentos',
  activity: 'Actividad',
  other: 'Otro',
}

export const DEPARTURE_STATUS_LABELS: Record<DepartureStatus, string> = {
  open: 'Abierta',
  closed: 'Cerrada',
}

export const PACKAGE_LIMITS = {
  name: { min: 3, max: 150 },
  summary: { min: 10, max: 300 },
  description: { min: 20, max: 5000 },
  nights: { min: 0, max: 60 },
  minTravelers: { min: 1, max: 100 },
  cancellationPolicy: { min: 10, max: 2000 },
  itemDescription: { min: 3, max: 255 },
  itineraryTitle: { min: 3, max: 150 },
  seats: { min: 1, max: 1000 },
} as const
