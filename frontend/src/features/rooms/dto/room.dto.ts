/** Contrato de habitaciones de hotel, copiado de los esquemas Zod de la API. */

export interface RoomType {
  id: string
  partnerId: string
  partnerName: string
  name: string
  description: string | null
  maxAdults: number
  maxChildren: number
  totalUnits: number
  basePrice: number
  amenities: string[]
  images: string[]
  isActive: boolean
  createdAt: string
}

export interface RoomTypePayload {
  name: string
  description?: string
  maxAdults: number
  maxChildren: number
  totalUnits: number
  basePrice: number
  amenities: string[]
  images?: string[]
  isActive: boolean
}

/** Carga de inventario para un rango de fechas, ambas inclusive. */
export interface InventoryRangePayload {
  from: string
  to: string
  units?: number
  price?: number
  isClosed?: boolean
}

export interface InventoryDay {
  id: string
  roomTypeId: string
  date: string
  units: number
  price: number
  isClosed: boolean
}

export interface InventoryResult {
  roomTypeId: string
  from: string
  to: string
  created: number
  updated: number
}

export const ROOM_LIMITS = {
  name: { min: 2, max: 120 },
  description: { max: 2000 },
  adults: { min: 1, max: 10 },
  children: { min: 0, max: 10 },
  units: { min: 1, max: 500 },
  price: { min: 1, max: 1000000 },
  amenities: 30,
} as const
