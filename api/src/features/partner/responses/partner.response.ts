export interface PartnerSummaryResponse {
  id: string;
  categoryId: string;
  categoryName: string;
  regionId: string;
  regionName: string;
  commercialName: string;
  legalName: string;
  slug: string;
  logoUrl: string | null;
  description: string | null;
  address: string;
  lat: number | null;
  lng: number | null;
  contactName: string;
  contactEmail: string;
  contactPhone: string;
  status: string;
  statusReason: string | null;
  approvedAt: Date | null;
  createdAt: Date;
}

export interface PartnerRegistrationResponse {
  partnerId: string;
  commercialName: string;
  slug: string;
  status: string;
  ownerEmail: string;
}

export interface PartnerMemberResponse {
  id: string;
  partnerId: string;
  userId: string;
  name: string;
  email: string;
  phone: string | null;
  userStatus: string;
  /** true si la API le exige cambiar la contrasena al entrar. */
  mustChangePassword: boolean;
  role: string;
  isActive: boolean;
  createdAt: Date;
}