export interface QuoteLineResponse {
  type: "package_departure" | "room_stay" | "experience_slot";
  refId: string;
  title: string;
  partnerId: string;
  partnerName: string;
  /** Viajeros para paquete/experiencia; noches para la estancia. */
  quantity: number;
  quantityLabel: "viajeros" | "noches";
  unitPrice: number;
  subtotal: number;
  discount: number;
  taxes: number;
  taxesIncluded: boolean;
  total: number;
  detail: Record<string, unknown>;
}

export interface QuoteResponse {
  quoteId: string;
  reference: string;
  currency: string;
  items: QuoteLineResponse[];
  subtotal: number;
  discountTotal: number;
  taxesTotal: number;
  total: number;
  expiresAt: string;
  createdAt: string;
}
