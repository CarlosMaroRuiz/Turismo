/**
 * DTO de categorias de socio.
 *
 * Espejo de `api/src/features/partner-category/responses/partner-category.response.ts`.
 * El `code` es lo que decide las capacidades del portal (hotel, agency, attraction),
 * pero es un dato editable: el admin puede crear categorias nuevas.
 */

export interface PartnerCategory {
  id: string
  code: string
  name: string
  isActive: boolean
}

/** `POST /partner-categories`. `code` es unico y en kebab-case. */
export interface CreatePartnerCategoryPayload {
  code: string
  name: string
}

/** `PATCH /partner-categories/:id` */
export interface UpdatePartnerCategoryPayload {
  name?: string
  isActive?: boolean
}
