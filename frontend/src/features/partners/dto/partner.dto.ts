/**
 * DTOs de socios.
 *
 * Espejo de `api/src/features/partner/responses/partner.response.ts`, con una
 * correccion deliberada: `approvedAt` y `createdAt` son `string` en el cable
 * (la interfaz de la API los declara `Date`, pero JSON no tiene fechas).
 *
 * La API NO incluye `categoryName` ni `regionName`: solo los ids. Para pintar
 * los nombres hay que cruzar con `partner-categories` y `regions`.
 */

export type PartnerStatus = 'pending' | 'active' | 'suspended' | 'rejected'

/** Rol dentro del socio. Distinto del rol global (`super_user` | `partner`). */
export type PartnerMemberRole = 'owner' | 'staff'

/** `GET /partners` y `GET /partners/:id` */
export interface Partner {
  id: string
  categoryId: string
  regionId: string
  commercialName: string
  legalName: string
  slug: string
  logoUrl: string | null
  description: string | null
  address: string
  lat: number | null
  lng: number | null
  contactName: string
  contactEmail: string
  contactPhone: string
  status: PartnerStatus
  /** Motivo del rechazo o de la suspension. */
  statusReason: string | null
  approvedAt: string | null
  createdAt: string
}

/** Respuesta de `POST /partners` y `POST /partners/register` (201). */
export interface PartnerRegistration {
  partnerId: string
  commercialName: string
  slug: string
  status: PartnerStatus
  ownerEmail: string
}

/** Un miembro del equipo. `GET /partners/:id/members` (no paginado). */
export interface PartnerMember {
  id: string
  partnerId: string
  userId: string
  name: string
  email: string
  phone: string | null
  userStatus: string
  /** true si la API le exige cambiar la contrasena al entrar. */
  mustChangePassword: boolean
  role: PartnerMemberRole
  isActive: boolean
  createdAt: string
}

/** Filtros del listado. `status` invalido devuelve 400, no 422. */
export interface PartnerFilters {
  status?: PartnerStatus
  page?: number
  limit?: number
}

/**
 * `POST /partners` (admin) y `POST /partners/register` (publico).
 * `invite` solo lo acepta el alta del admin: aprueba y envia el correo.
 */
export interface CreatePartnerPayload {
  categoryId: string
  regionId: string
  commercialName: string
  legalName: string
  description?: string
  address: string
  lat?: number
  lng?: number
  contactName: string
  contactEmail: string
  contactPhone: string
  ownerName: string
  ownerEmail: string
  ownerPhone?: string
  invite?: boolean
}

/** `POST /partners/register`: igual que el alta, sin `invite`. */
export type RegisterPartnerPayload = Omit<CreatePartnerPayload, 'invite'>

/**
 * `PATCH /partners/:id`.
 * `categoryId`, `regionId` y `slug` son exclusivos del admin: si el socio los
 * manda, la API responde 403 `ADMIN_ONLY_FIELDS`.
 */
export interface UpdatePartnerPayload {
  categoryId?: string
  regionId?: string
  slug?: string
  commercialName?: string
  legalName?: string
  description?: string | null
  address?: string
  lat?: number | null
  lng?: number | null
  contactName?: string
  contactEmail?: string
  contactPhone?: string
}

/** `PATCH /partners/:id/reject` y `.../suspend`: motivo de 10 a 255. */
export interface PartnerReasonPayload {
  reason: string
}

/** `POST /partners/:id/members` */
export interface AddPartnerMemberPayload {
  name: string
  email: string
  phone?: string
  role?: PartnerMemberRole
}

/** `PATCH /partners/:id/members/:memberId` */
export interface UpdatePartnerMemberPayload {
  role?: PartnerMemberRole
  isActive?: boolean
}

/** Etiquetas para tablas y badges, sin repetir los literales. */
export const PARTNER_STATUS_LABELS: Record<PartnerStatus, string> = {
  pending: 'Pendiente',
  active: 'Activo',
  suspended: 'Suspendido',
  rejected: 'Rechazado',
}

export const PARTNER_MEMBER_ROLE_LABELS: Record<PartnerMemberRole, string> = {
  owner: 'Responsable',
  staff: 'Colaborador',
}
