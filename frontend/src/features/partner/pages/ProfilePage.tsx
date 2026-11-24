import { useState } from 'react'

import { Badge } from '@common/components/Badge'
import { QueryState } from '@common/components/QueryState'
import { sessionStore } from '@core/http'
import { useLogout } from '@features/auth/hooks/useLogout'
import { usePartnerCategories } from '@features/partner-categories'
import { PARTNER_STATUS_LABELS, usePartner } from '@features/partners'
import type { PartnerStatus } from '@features/partners'
import { useRegion } from '@features/regions'
import { formatDate } from '@lib/format'

const STATUS_TONES: Record<PartnerStatus, 'neutral' | 'success' | 'warning' | 'danger'> = {
  pending: 'warning',
  active: 'success',
  suspended: 'danger',
  rejected: 'neutral',
}

/**
 * Ficha del propio negocio adaptada al diseño de tarjeta SaaS moderna.
 * Muestra el perfil público, datos fiscales, contacto y controles de sesión/soporte.
 */
export default function ProfilePage() {
  const cerrarSesion = useLogout()
  const session = sessionStore.get()
  const partnerId = session?.user.partner?.id

  const socio = usePartner(partnerId)
  const categorias = usePartnerCategories(true)
  const region = useRegion(socio.data?.regionId)

  const [copiado, setCopiado] = useState(false)
  const [slugCopiado, setSlugCopiado] = useState(false)
  const [supportAccess, setSupportAccess] = useState(true)

  return (
    <section className="mx-auto max-w-4xl py-2">
      <QueryState query={socio}>
        {(datos) => {
          const categoriaNombre =
            categorias.data?.find((item) => item.id === datos.categoryId)?.name ?? '-'

          return (
            <div className="overflow-hidden rounded-3xl border border-borde/80 bg-white shadow-sm">
              {/* Cabecera / Banner panorámico suave */}
              <div className="relative h-40 w-full overflow-hidden bg-gradient-to-r from-sky-100 via-teal-50 to-blue-100 sm:h-48">
                <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(ellipse_at_top,_var(--tw-gradient-stops))] from-white/60 via-transparent to-transparent" />
                <div className="absolute inset-0 bg-[radial-gradient(#006853_1px,transparent_1px)] opacity-15 [background-size:16px_16px]" />
              </div>

              {/* Área superior de perfil: Avatar, botón Ver perfil, Nombre y Verificación */}
              <div className="px-6 pb-6 sm:px-8">
                <div className="flex items-end justify-between">
                  {/* Avatar circular superpuesto */}
                  <div className="relative -mt-14 sm:-mt-16">
                    {datos.logoUrl !== null && datos.logoUrl !== '' ? (
                      <img
                        src={datos.logoUrl}
                        alt={datos.commercialName}
                        className="size-24 rounded-full border-4 border-white bg-white object-cover shadow-md sm:size-28"
                      />
                    ) : (
                      <div className="flex size-24 items-center justify-center rounded-full border-4 border-white bg-gradient-to-br from-marca to-marca/80 text-2xl font-bold text-white shadow-md sm:size-28">
                        {datos.commercialName.slice(0, 2).toUpperCase()}
                      </div>
                    )}
                  </div>

                  {/* Botón de acción: Ver perfil / Copiar enlace público */}
                  <div className="mb-1">
                    <button
                      type="button"
                      onClick={() => {
                        if (navigator.clipboard) {
                          navigator.clipboard.writeText(
                            `${window.location.origin}/socios/${datos.slug}`,
                          )
                          setCopiado(true)
                          setTimeout(() => setCopiado(false), 2000)
                        }
                      }}
                      className="inline-flex cursor-pointer items-center gap-1.5 rounded-xl border border-borde bg-white px-3.5 py-2 text-xs font-medium text-texto-oscuro shadow-xs transition-colors hover:bg-gray-50 sm:text-sm"
                    >
                      <span>{copiado ? 'Enlace copiado' : 'Ver perfil'}</span>
                      <svg
                        className="size-4 text-texto-oscuro/60"
                        fill="none"
                        viewBox="0 0 24 24"
                        stroke="currentColor"
                      >
                        <path
                          strokeLinecap="round"
                          strokeLinejoin="round"
                          strokeWidth={2}
                          d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14"
                        />
                      </svg>
                    </button>
                  </div>
                </div>

                {/* Título de identidad con insignia de verificación */}
                <div className="mt-3">
                  <div className="flex items-center gap-2">
                    <h1 className="text-2xl font-bold tracking-tight text-texto-oscuro sm:text-3xl">
                      {datos.commercialName}
                    </h1>
                    {/* Insignia verificada azul estilo Twitter/SaaS */}
                    {datos.status === 'active' && (
                      <span title="Socio verificado por Turismo">
                        <svg
                          className="size-5 shrink-0 text-[#1D9BF0] sm:size-6"
                          viewBox="0 0 24 24"
                          fill="currentColor"
                        >
                          <path d="M22.25 12c0-1.43-.88-2.67-2.19-3.34.46-1.39.2-2.9-.81-3.91s-2.52-1.27-3.91-.81c-.67-1.31-1.91-2.19-3.34-2.19s-2.67.88-3.34 2.19c-1.39-.46-2.9-.2-3.91.81s-1.27 2.52-.81 3.91c-1.31.67-2.19 1.91-2.19 3.34s.88 2.67 2.19 3.34c-.46 1.39-.2 2.9.81 3.91s2.52 1.27 3.91.81c.67 1.31 1.91 2.19 3.34 2.19s2.67-.88 3.34-2.19c1.39.46 2.9.2 3.91-.81s1.27-2.52.81-3.91c1.31-.67 2.19-1.91 2.19-3.34zm-11.75 4.75l-4-4 1.41-1.41 2.59 2.59 6.59-6.59 1.41 1.41-8 8z" />
                        </svg>
                      </span>
                    )}
                  </div>
                  <p className="mt-0.5 text-sm font-normal text-texto-oscuro/50">
                    {datos.contactEmail}
                  </p>
                </div>

                {/* Fila de métricas / Estadísticas horizontales (First seen, First purchase, Revenue, MRR) */}
                <div className="mt-6 grid grid-cols-2 gap-4 border-t border-borde/60 pt-5 sm:grid-cols-4">
                  <div>
                    <span className="text-xs text-texto-oscuro/50">Alta en plataforma</span>
                    <p className="mt-1 text-sm font-semibold text-texto-oscuro sm:text-base">
                      {formatDate(datos.createdAt)}
                    </p>
                  </div>
                  <div>
                    <span className="text-xs text-texto-oscuro/50">Aprobación</span>
                    <p className="mt-1 text-sm font-semibold text-texto-oscuro sm:text-base">
                      {datos.approvedAt ? formatDate(datos.approvedAt) : 'En revisión'}
                    </p>
                  </div>
                  <div>
                    <span className="text-xs text-texto-oscuro/50">Categoría</span>
                    <p className="mt-1 truncate text-sm font-semibold text-texto-oscuro sm:text-base">
                      {categoriaNombre}
                    </p>
                  </div>
                  <div>
                    <span className="text-xs text-texto-oscuro/50">Estado</span>
                    <div className="mt-1">
                      <Badge tone={STATUS_TONES[datos.status]}>
                        {PARTNER_STATUS_LABELS[datos.status]}
                      </Badge>
                    </div>
                  </div>
                </div>
              </div>

              {/* Sección 1: Perfil público (Public profile) */}
              <div className="border-t border-borde/60 px-6 py-6 sm:px-8">
                <div className="flex flex-col md:flex-row md:gap-8">
                  <div className="mb-4 md:mb-0 md:w-1/3">
                    <h2 className="text-sm font-semibold text-texto-oscuro">Perfil público</h2>
                    <p className="mt-1 text-xs leading-relaxed text-texto-oscuro/50">
                      Esto se mostrará en tu catálogo oficial y en los resultados del bot de reservas.
                    </p>
                  </div>
                  <div className="flex flex-col gap-3 md:w-2/3">
                    <div className="rounded-xl border border-borde/80 bg-white px-3.5 py-2.5 shadow-xs">
                      <span className="block text-[10px] font-semibold uppercase tracking-wider text-texto-oscuro/40">
                        Nombre del establecimiento
                      </span>
                      <span className="text-sm font-medium text-texto-oscuro">
                        {datos.commercialName}
                      </span>
                    </div>

                    <div className="flex overflow-hidden rounded-xl border border-borde/80 bg-white shadow-xs">
                      <span className="inline-flex select-none items-center border-r border-borde/60 bg-gray-50/80 px-3 py-2.5 font-mono text-xs text-texto-oscuro/50">
                        turismo.mx/socios/
                      </span>
                      <div className="flex flex-1 items-center justify-between px-3.5 py-2.5">
                        <span className="font-mono text-sm text-texto-oscuro">{datos.slug}</span>
                        <button
                          type="button"
                          onClick={() => {
                            if (navigator.clipboard) {
                              navigator.clipboard.writeText(datos.slug)
                              setSlugCopiado(true)
                              setTimeout(() => setSlugCopiado(false), 2000)
                            }
                          }}
                          className="cursor-pointer text-xs font-medium text-marca hover:underline"
                        >
                          {slugCopiado ? '¡Copiado!' : 'Copiar'}
                        </button>
                      </div>
                    </div>

                    {datos.description !== null && datos.description !== '' && (
                      <div className="rounded-xl border border-borde/80 bg-white p-3.5 shadow-xs">
                        <span className="mb-1 block text-[10px] font-semibold uppercase tracking-wider text-texto-oscuro/40">
                          Descripción comercial
                        </span>
                        <p className="text-sm leading-relaxed text-texto-oscuro/80">
                          {datos.description}
                        </p>
                      </div>
                    )}
                  </div>
                </div>
              </div>

              {/* Sección 2: Razón social y ubicación */}
              <div className="border-t border-borde/60 px-6 py-6 sm:px-8">
                <div className="flex flex-col md:flex-row md:gap-8">
                  <div className="mb-4 md:mb-0 md:w-1/3">
                    <h2 className="text-sm font-semibold text-texto-oscuro">Razón social y registro</h2>
                    <p className="mt-1 text-xs leading-relaxed text-texto-oscuro/50">
                      Datos fiscales registrados y zona geográfica de operación oficial.
                    </p>
                  </div>
                  <div className="flex flex-col gap-3 md:w-2/3">
                    <div className="rounded-xl border border-borde/80 bg-white px-3.5 py-2.5 shadow-xs">
                      <span className="block text-[10px] font-semibold uppercase tracking-wider text-texto-oscuro/40">
                        Razón social
                      </span>
                      <span className="text-sm font-medium text-texto-oscuro">{datos.legalName}</span>
                    </div>

                    <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                      <div className="rounded-xl border border-borde/80 bg-white px-3.5 py-2.5 shadow-xs">
                        <span className="block text-[10px] font-semibold uppercase tracking-wider text-texto-oscuro/40">
                          Región turística
                        </span>
                        <span className="text-sm font-medium text-texto-oscuro">
                          {region.data === undefined
                            ? '-'
                            : `${region.data.stateName ?? ''} / ${region.data.name}`}
                        </span>
                      </div>
                      <div className="rounded-xl border border-borde/80 bg-white px-3.5 py-2.5 shadow-xs">
                        <span className="block text-[10px] font-semibold uppercase tracking-wider text-texto-oscuro/40">
                          Categoría autorizada
                        </span>
                        <span className="text-sm font-medium text-texto-oscuro">{categoriaNombre}</span>
                      </div>
                    </div>

                    <div className="rounded-xl border border-borde/80 bg-white px-3.5 py-2.5 shadow-xs">
                      <span className="block text-[10px] font-semibold uppercase tracking-wider text-texto-oscuro/40">
                        Dirección física
                      </span>
                      <span className="text-sm text-texto-oscuro">{datos.address}</span>
                    </div>
                  </div>
                </div>
              </div>

              {/* Sección 3: Contacto operativo */}
              <div className="border-t border-borde/60 px-6 py-6 sm:px-8">
                <div className="flex flex-col md:flex-row md:gap-8">
                  <div className="mb-4 md:mb-0 md:w-1/3">
                    <h2 className="text-sm font-semibold text-texto-oscuro">Contacto operativo</h2>
                    <p className="mt-1 text-xs leading-relaxed text-texto-oscuro/50">
                      Persona responsable para reservaciones, incidencias y comunicación oficial.
                    </p>
                  </div>
                  <div className="flex flex-col gap-3 md:w-2/3">
                    <div className="rounded-xl border border-borde/80 bg-white px-3.5 py-2.5 shadow-xs">
                      <span className="block text-[10px] font-semibold uppercase tracking-wider text-texto-oscuro/40">
                        Responsable directo
                      </span>
                      <span className="text-sm font-medium text-texto-oscuro">
                        {datos.contactName}
                      </span>
                    </div>

                    <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                      <div className="rounded-xl border border-borde/80 bg-white px-3.5 py-2.5 shadow-xs">
                        <span className="block text-[10px] font-semibold uppercase tracking-wider text-texto-oscuro/40">
                          Correo electrónico
                        </span>
                        <span className="text-sm font-medium text-texto-oscuro">
                          {datos.contactEmail}
                        </span>
                      </div>
                      <div className="rounded-xl border border-borde/80 bg-white px-3.5 py-2.5 shadow-xs">
                        <span className="block text-[10px] font-semibold uppercase tracking-wider text-texto-oscuro/40">
                          Teléfono de contacto
                        </span>
                        <span className="text-sm font-medium text-texto-oscuro">
                          {datos.contactPhone}
                        </span>
                      </div>
                    </div>
                  </div>
                </div>
              </div>

              {/* Sección 4: Acceso de soporte central (Support access) */}
              <div className="border-t border-borde/60 px-6 py-6 sm:px-8">
                <div className="flex flex-col justify-between gap-4 sm:flex-row sm:items-center">
                  <div className="max-w-xl">
                    <h2 className="text-sm font-semibold text-texto-oscuro">
                      Acceso de soporte central
                    </h2>
                    <p className="mt-1 text-xs leading-relaxed text-texto-oscuro/50">
                      Has otorgado autorización a Turismo para supervisión de inventario, asistencia técnica y homologación de servicios.
                    </p>
                  </div>
                  <div className="flex items-center gap-3">
                    <button
                      type="button"
                      onClick={() => setSupportAccess((prev) => !prev)}
                      className={`relative inline-flex h-6 w-11 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-none ${
                        supportAccess ? 'bg-marca' : 'bg-gray-200'
                      }`}
                      role="switch"
                      aria-checked={supportAccess}
                    >
                      <span
                        className={`pointer-events-none inline-block size-5 transform rounded-full bg-white shadow-md ring-0 transition duration-200 ease-in-out ${
                          supportAccess ? 'translate-x-5' : 'translate-x-0'
                        }`}
                      />
                    </button>
                  </div>
                </div>
              </div>

              {/* Sección 5: Cerrar sesión activa (Log out of all devices) */}
              <div className="border-t border-borde/60 px-6 py-6 sm:px-8">
                <div className="flex flex-col justify-between gap-4 sm:flex-row sm:items-center">
                  <div className="max-w-xl">
                    <h2 className="text-sm font-semibold text-texto-oscuro">
                      Cerrar sesión activa
                    </h2>
                    <p className="mt-1 text-xs leading-relaxed text-texto-oscuro/50">
                      Cierra la sesión autenticada en este equipo para {session?.user.email}.
                    </p>
                  </div>
                  <div>
                    <button
                      type="button"
                      onClick={() => void cerrarSesion()}
                      className="cursor-pointer rounded-xl border border-borde bg-white px-4 py-2 text-xs font-medium text-texto-oscuro shadow-xs transition-colors hover:bg-gray-50 sm:text-sm"
                    >
                      Cerrar sesión
                    </button>
                  </div>
                </div>
              </div>

              {/* Pie de tarjeta con nota informativa */}
              <div className="flex flex-col justify-between gap-2 border-t border-borde/60 bg-gray-50/50 px-6 py-4 text-xs text-texto-oscuro/50 sm:flex-row sm:items-center sm:px-8">
                <span>
                  Para modificar la razón social, categoría o región oficial, contacta a la mesa de control de Turismo.
                </span>
                <span className="font-mono text-[11px]">ID de socio: {datos.id}</span>
              </div>
            </div>
          )
        }}
      </QueryState>
    </section>
  )
}
