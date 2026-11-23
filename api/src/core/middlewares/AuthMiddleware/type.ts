export interface JwtUserPayload {
  type?: "user";
  userId: string;
  email: string;
  role: string;
  partnerId?: string;
  partnerRole?: string;
  /** Debe coincidir con users.token_version; si no, la sesión fue revocada. */
  tokenVersion?: number;
}

export interface JwtServicePayload {
  type: "service";
  clientId: string;
  role: "service";
  /** Permisos del cliente, por ejemplo ["catalog:read"]. */
  scopes: string[];
}

export type AccessTokenPayload = JwtUserPayload | JwtServicePayload;

/** Principal de servicio ya validado, disponible en req.service. */
export interface ServicePrincipal {
  clientId: string;
  scopes: string[];
}

declare global {
  namespace Express {
    interface Request {
      user?: JwtUserPayload;
      service?: ServicePrincipal;
    }
  }
}
