export interface RoomTypeResponse {
  id: string;
  partnerId: string;
  partnerName: string;
  name: string;
  description: string | null;
  maxAdults: number;
  maxChildren: number;
  totalUnits: number;
  basePrice: number;
  amenities: string[];
  isActive: boolean;
  createdAt: Date;
}

export interface RoomInventoryResponse {
  id: string;
  roomTypeId: string;
  date: string;
  units: number;
  price: number;
  isClosed: boolean;
}

export interface InventoryUpsertResponse {
  roomTypeId: string;
  from: string;
  to: string;
  created: number;
  updated: number;
}

export interface AvailabilityNight {
  date: string;
  price: number;
}

export interface AvailabilityItem {
  roomTypeId: string;
  roomTypeName: string;
  partnerId: string;
  partnerName: string;
  regionId: string;
  regionName: string;
  maxAdults: number;
  maxChildren: number;
  amenities: string[];
  checkIn: string;
  checkOut: string;
  nights: number;
  nightly: AvailabilityNight[];
  totalPrice: number;
  currency: "MXN";
}
