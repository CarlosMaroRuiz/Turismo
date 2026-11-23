import type { UserStatus } from "../../../core/bd/entities/User.js";
import type { AuthPartnerSummary } from "../types/auth.types.js";

export interface UserProfileResponse {
  id: string;
  name: string;
  email: string;
  phone: string | null;
  status: UserStatus;
  mustChangePassword: boolean;
  role: unknown;
  partner: AuthPartnerSummary | null;
}