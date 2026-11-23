import { api } from '@core/http'
import type { Paginated } from '@core/http'

import type {
  AddPartnerMemberPayload,
  CreatePartnerPayload,
  Partner,
  PartnerFilters,
  PartnerMember,
  PartnerRegistration,
  RegisterPartnerPayload,
  UpdatePartnerMemberPayload,
  UpdatePartnerPayload,
} from './dto/partner.dto'

/** Rutas del recurso, compartidas por las funciones `api` y los hooks. */
export const PARTNER_PATHS = {
  list: '/partners',
  register: '/partners/register',
  detail: (id: string): string => `/partners/${id}`,
  approve: (id: string): string => `/partners/${id}/approve`,
  reject: (id: string): string => `/partners/${id}/reject`,
  suspend: (id: string): string => `/partners/${id}/suspend`,
  reactivate: (id: string): string => `/partners/${id}/reactivate`,
  resendInvite: (id: string): string => `/partners/${id}/resend-invite`,
  members: (id: string): string => `/partners/${id}/members`,
  member: (id: string, memberId: string): string =>
    `/partners/${id}/members/${memberId}`,
} as const

/**
 * Endpoints de `Socios`.
 *
 * Detalle importante: las transiciones de estado (`approve`, `reject`,
 * `suspend`, `reactivate`) son PATCH y responden `data: null`, no el socio.
 * `resend-invite` es POST y tambien responde `null`.
 */

export function getPartners(filters: PartnerFilters = {}): Promise<Paginated<Partner>> {
  return api.getPaginated<Partner>(PARTNER_PATHS.list, { params: { ...filters } })
}

export function getPartner(id: string): Promise<Partner> {
  return api.get<Partner>(PARTNER_PATHS.detail(id))
}

/** Alta directa del admin (201). `invite: true` aprueba y envia el correo. */
export function createPartner(payload: CreatePartnerPayload): Promise<PartnerRegistration> {
  return api.post<PartnerRegistration>(PARTNER_PATHS.list, payload)
}

/** Solicitud publica de registro (201). Queda en `pending`. */
export function registerPartner(payload: RegisterPartnerPayload): Promise<PartnerRegistration> {
  return api.post<PartnerRegistration>(PARTNER_PATHS.register, payload, { skipAuth: true })
}

export function updatePartner(id: string, payload: UpdatePartnerPayload): Promise<Partner> {
  return api.patch<Partner>(PARTNER_PATHS.detail(id), payload)
}

/** `pending -> active` y envio del correo de activacion. */
export function approvePartner(id: string): Promise<null> {
  return api.patch<null>(PARTNER_PATHS.approve(id))
}

export function rejectPartner(id: string, reason: string): Promise<null> {
  return api.patch<null>(PARTNER_PATHS.reject(id), { reason })
}

export function suspendPartner(id: string, reason: string): Promise<null> {
  return api.patch<null>(PARTNER_PATHS.suspend(id), { reason })
}

export function reactivatePartner(id: string): Promise<null> {
  return api.patch<null>(PARTNER_PATHS.reactivate(id))
}

export function resendPartnerInvite(id: string): Promise<null> {
  return api.post<null>(PARTNER_PATHS.resendInvite(id))
}

/** Equipo del socio. No paginado: devuelve el arreglo completo. */
export function getPartnerMembers(id: string): Promise<PartnerMember[]> {
  return api.get<PartnerMember[]>(PARTNER_PATHS.members(id))
}

export function addPartnerMember(
  id: string,
  payload: AddPartnerMemberPayload,
): Promise<PartnerMember> {
  return api.post<PartnerMember>(PARTNER_PATHS.members(id), payload)
}

export function updatePartnerMember(
  id: string,
  memberId: string,
  payload: UpdatePartnerMemberPayload,
): Promise<PartnerMember> {
  return api.patch<PartnerMember>(PARTNER_PATHS.member(id, memberId), payload)
}
