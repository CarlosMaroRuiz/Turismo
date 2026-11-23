import type { AuthPartnerSummary } from "../types/auth.types.js";

export interface LoginResponse {
  accessToken: string;
  /** Token de renovación: se guarda solo su hash y rota en cada uso. */
  refreshToken: string;
  /** TTL del access token (por ejemplo "15m"). */
  expiresIn: string;
  user: {
    id: string;
    name: string;
    email: string;
    role: string;
    mustChangePassword: boolean;
    partner: Omit<AuthPartnerSummary, "slug"> | null;
  };
}
