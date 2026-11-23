export interface ExperienceSlotResponse {
  id: string;
  experienceId: string;
  date: string;
  startTime: string;
  capacity: number;
  booked: number;
  remaining: number;
  status: string;
}

export interface ExperienceSummaryResponse {
  id: string;
  partnerId: string;
  partnerName: string;
  regionId: string;
  regionName: string;
  name: string;
  slug: string;
  description: string;
  durationMinutes: number;
  minAge: number | null;
  priceAdult: number;
  priceChild: number | null;
  isActive: boolean;
  createdAt: Date;
}

export interface ExperienceDetailResponse extends ExperienceSummaryResponse {
  requirements: string | null;
  slots: ExperienceSlotResponse[];
}

export interface ExperienceAvailabilityItem {
  slotId: string;
  experienceId: string;
  experienceName: string;
  partnerId: string;
  partnerName: string;
  regionId: string;
  regionName: string;
  date: string;
  startTime: string;
  durationMinutes: number;
  capacity: number;
  remaining: number;
  priceAdult: number;
  priceChild: number | null;
  currency: "MXN";
}
