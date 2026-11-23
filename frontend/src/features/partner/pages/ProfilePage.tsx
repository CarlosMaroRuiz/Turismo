import { Badge } from '@common/components/Badge'
import { QueryState } from '@common/components/QueryState'
import { sessionStore } from '@core/http'
import { usePartnerCategories } from '@features/partner-categories'
import { PARTNER_STATUS_LABELS, usePartner } from '@features/partners'
import type { PartnerStatus } from '@features/partners'
import { useRegion } from '@features/regions'
import { formatDate, formatDateTime } from '@lib/format'

const STATUS_TONES: Record<PartnerStatus, 'neutral' | 'success' | 'warning' | 'danger'> = {
  pending: 'warning',
  active: 'success',
  suspended: 'danger',
  rejected: 'neutral',
}

function Dato({ etiqueta, valor }: { etiqueta: string; valor: string }) {
  return (
    <div className="flex flex-col gap-0.5">
      <span className="text-xs uppercase tracking-wide text-texto-oscuro/40">{etiqueta}</span>
      <span className="text-sm text-texto-oscuro">{valor === '' ? '-' : valor}</span>
    </div>
  )
}

/**
 * Ficha del propio negocio, en modo lectura.
 *
 * La edicion queda para cuando el socio pueda cambiar sus datos desde aqui;
 * hoy la plataforma es la que valida categoria, region y slug.
 */
export default function ProfilePage() {
  const session = sessionStore.get()
  const partnerId = session?.user.partner?.id

  const socio = usePartner(partnerId)
  const categorias = usePartnerCategories(true)
  const region = useRegion(socio.data?.regionId)

  return (
    <section className="flex flex-col gap-5">
      <header>
        <h1 className="text-2xl font-bold text-texto-oscuro">Mi negocio</h1>
        <p className="mt-1 text-sm text-texto-oscuro/60">
          Asi te ven los viajeros en el catalogo.
        </p>
      </header>

      <QueryState query={socio}>
        {(datos) => (
          <>
            <div className="flex flex-wrap items-center gap-4 rounded-2xl border border-borde bg-white p-6 shadow-sm">
              {datos.logoUrl !== null && datos.logoUrl !== '' && (
                <img
                  src={datos.logoUrl}
                  alt={datos.commercialName}
                  className="size-16 shrink-0 rounded-xl object-cover"
                  loading="lazy"
                />
              )}
              <div className="min-w-0 flex-1">
                <p className="text-lg font-semibold text-texto-oscuro">{datos.commercialName}</p>
                <p className="font-mono text-xs text-texto-oscuro/50">{datos.slug}</p>
              </div>
              <Badge tone={STATUS_TONES[datos.status]}>
                {PARTNER_STATUS_LABELS[datos.status]}
              </Badge>
            </div>

            <div className="grid gap-4 rounded-2xl border border-borde bg-white p-6 shadow-sm sm:grid-cols-2 lg:grid-cols-3">
              <Dato
                etiqueta="Categoria"
                valor={categorias.data?.find((item) => item.id === datos.categoryId)?.name ?? '-'}
              />
              <Dato etiqueta="Razon social" valor={datos.legalName} />
              <Dato
                etiqueta="Ubicacion"
                valor={
                  region.data === undefined
                    ? '-'
                    : `${region.data.stateName ?? ''} / ${region.data.name}`
                }
              />
              <Dato etiqueta="Direccion" valor={datos.address} />
              <Dato etiqueta="Alta" valor={formatDate(datos.createdAt)} />
              <Dato etiqueta="Aprobado" valor={formatDateTime(datos.approvedAt)} />
            </div>

            <div className="grid gap-4 rounded-2xl border border-borde bg-white p-6 shadow-sm sm:grid-cols-3">
              <Dato etiqueta="Contacto" valor={datos.contactName} />
              <Dato etiqueta="Correo" valor={datos.contactEmail} />
              <Dato etiqueta="Telefono" valor={datos.contactPhone} />
            </div>

            {datos.description !== null && (
              <div className="rounded-2xl border border-borde bg-white p-6 shadow-sm">
                <h2 className="mb-2 text-sm font-semibold uppercase tracking-wide text-texto-oscuro/50">
                  Descripcion
                </h2>
                <p className="text-sm leading-relaxed text-texto-oscuro/80">{datos.description}</p>
              </div>
            )}

            <p className="text-xs text-texto-oscuro/50">
              Para corregir la categoria, la region o el slug, escribenos: esos campos los
              administra la plataforma.
            </p>
          </>
        )}
      </QueryState>
    </section>
  )
}
