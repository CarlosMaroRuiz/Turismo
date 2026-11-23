export interface PackageItemResponse {
  id: string;
  type: string;
  description: string;
  isIncluded: boolean;
  sortOrder: number;
}

export interface ItineraryDayResponse {
  id: string;
  dayNumber: number;
  title: string;
  description: string;
}

export interface DepartureResponse {
  id: string;
  departureDate: string;
  totalSeats: number;
  soldSeats: number;
  availableSeats: number;
  adultPrice: number;
  childPrice: number | null;
  status: string;
}

export interface PromotionResponse {
  id: string;
  name: string;
  discountType: string;
  discountValue: number;
  validFrom: string;
  validTo: string;
  minTravelers: number | null;
  daysOfWeek: number[] | null;
  status: string;
}

export interface PackageSummaryResponse {
  id: string;
  partnerId: string;
  partnerName: string;
  destinationRegionId: string;
  destinationRegionName: string;
  name: string;
  slug: string;
  summary: string;
  nights: number;
  /** Días de viaje (noches + 1). */
  days: number;
  minTravelers: number;
  maxTravelers: number | null;
  minPriceAdult: number | null;
  status: string;
  createdAt: Date;
}

export interface PackageDetailResponse extends PackageSummaryResponse {
  description: string;
  meetingPoint: string | null;
  requirements: string | null;
  cancellationPolicy: string;
  taxesIncluded: boolean;
  childMinAge: number | null;
  childMaxAge: number | null;
  items: PackageItemResponse[];
  itinerary: ItineraryDayResponse[];
  departures: DepartureResponse[];
  promotions: PromotionResponse[];
}

export interface PackageDetailOptions {
  /** El dueño o un administrador ven borradores y salidas cerradas. */
  includeUnpublished: boolean;
}
