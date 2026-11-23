import { useMemo } from 'react'
import { Link, useSearchParams } from 'react-router'

import { QueryState } from '@common/components/QueryState'
import { PATHS, partnerDetailPath } from '@core/routes/types/paths'
import { cn } from '@lib/cn'
import { formatDate } from '@lib/format'

import { usePartnerCategories } from '@features/partner-categories'
import { PARTNER_STATUS_LABELS, usePartners } from '..'
import type { PartnerStatus } from '..'

const PAGE_SIZE = 20

const STATUS_DOT: Record<PartnerStatus, string> = {
  pending: 'bg-acento',
  active: 'bg-marca',
  suspended: 'bg-acento',
  rejected: 'bg-texto-oscuro/30',
}

const STATUS_TEXT: Record<PartnerStatus, string> = {
  pending: 'text-acento',
  active: 'text-marca',
  suspended: 'text-acento',
  rejected: 'text-texto-oscuro/50',
}

const TABS: { value: '' | PartnerStatus; label: string }[] = [
  { value: '', label: 'Todos' },
  { value: 'pending', label: 'Pendientes' },
  { value: 'active', label: 'Activos' },
  { value: 'suspended', label: 'Suspendidos' },
  { value: 'rejected', label: 'Rechazados' },
]

function iniciales(nombre: string): string {
  return nombre
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((parte) => parte[0]?.toUpperCase() ?? '')
    .join('')
}

/** Ventana de paginas alrededor de la actual, para no listar 40 botones. */
function ventanaPaginas(actual: number, total: number): number[] {
  const tamano = 5
  const inicio = Math.max(1, Math.min(actual - 2, total - tamano + 1))
  const fin = Math.min(total, inicio + tamano - 1)
  return Array.from({ length: fin - inicio + 1 }, (_, indice) => inicio + indice)
}

/**
 * Listado de socios del panel.
 *
 * Los filtros viven en la URL (`?page=&status=`) para que el listado se pueda
 * recargar, compartir y usar con el boton atras del navegador.
 */
export default function PartnerListPage() {
  const [searchParams, setSearchParams] = useSearchParams()

  const page = Number(searchParams.get('page') ?? '1') || 1
  const statusParam = searchParams.get('status')
  const status =
    statusParam === 'pending' ||
    statusParam === 'active' ||
    statusParam === 'suspended' ||
    statusParam === 'rejected'
      ? statusParam
      : undefined

  const socios = usePartners({ page, limit: PAGE_SIZE, ...(status !== undefined && { status }) })
  const categorias = usePartnerCategories(true)

  const nombreCategoria = useMemo(() => {
    const porId = new Map<string, string>()
    for (const categoria of categorias.data ?? []) {
      porId.set(categoria.id, categoria.name)
    }
    return porId
  }, [categorias.data])

  const updateParams = (cambios: Record<string, string | null>): void => {
    const next = new URLSearchParams(searchParams)
    for (const [name, value] of Object.entries(cambios)) {
      if (value === null) {
        next.delete(name)
      } else {
        next.set(name, value)
      }
    }
    setSearchParams(next)
  }

  return (
    <section className="flex flex-col gap-5">
      <header className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-texto-oscuro">Socios</h1>
          <p className="mt-1 text-sm text-texto-oscuro/60">
            {socios.data !== undefined
              ? `${socios.data.meta.total} ${socios.data.meta.total === 1 ? 'socio encontrado' : 'socios encontrados'}`
              : 'Hoteles, agencias y operadores de atractivos'}
          </p>
        </div>

        <Link
          to={PATHS.adminPartnerCreate}
          className="inline-flex h-10 items-center justify-center rounded-lg bg-acento px-4 text-sm font-semibold text-fondo-claro transition-colors hover:bg-acento-hover"
        >
          Nuevo socio
        </Link>
      </header>

      <div className="overflow-hidden rounded-2xl border border-borde bg-white shadow-sm">
        <div className="flex flex-wrap items-center gap-1 border-b border-borde px-4 pt-3">
          {TABS.map((tab) => {
            const activo = (status ?? '') === tab.value
            return (
              <button
                key={tab.value}
                type="button"
                onClick={() =>
                  updateParams({ status: tab.value === '' ? null : tab.value, page: '1' })
                }
                className={cn(
                  'border-b-2 px-3 py-2.5 text-sm font-medium transition-colors',
                  activo
                    ? 'border-marca text-marca'
                    : 'border-transparent text-texto-oscuro/50 hover:text-texto-oscuro',
                )}
              >
                {tab.label}
              </button>
            )
          })}
        </div>

        <QueryState
          query={socios}
          isEmpty={(data) => data.items.length === 0}
          empty="No hay socios con ese filtro."
        >
          {(data) => {
            const totalPages = Math.max(data.meta.totalPages, 1)
            const desde = data.meta.total === 0 ? 0 : (data.meta.page - 1) * data.meta.limit + 1
            const hasta = Math.min(data.meta.page * data.meta.limit, data.meta.total)

            return (
              <>
                <div className="overflow-x-auto">
                  <table className="w-full min-w-[720px] text-left text-sm">
                    <thead className="text-xs uppercase tracking-wide text-texto-oscuro/40">
                      <tr>
                        <th className="px-5 py-3 font-semibold">Socio</th>
                        <th className="px-5 py-3 font-semibold">Categoria</th>
                        <th className="px-5 py-3 font-semibold">Estado</th>
                        <th className="px-5 py-3 font-semibold">Alta</th>
                        <th className="px-5 py-3 text-right font-semibold">Acciones</th>
                      </tr>
                    </thead>
                    <tbody>
                      {data.items.map((socio) => (
                        <tr
                          key={socio.id}
                          className="border-t border-borde/60 transition-colors hover:bg-fondo-claro"
                        >
                          <td className="px-5 py-3">
                            <div className="flex items-center gap-3">
                              <span className="flex size-9 shrink-0 items-center justify-center rounded-full bg-marca/10 text-xs font-semibold text-marca">
                                {iniciales(socio.commercialName)}
                              </span>
                              <div className="min-w-0">
                                <p className="truncate font-medium text-texto-oscuro">
                                  {socio.commercialName}
                                </p>
                                <p className="truncate text-xs text-texto-oscuro/50">
                                  {socio.slug}
                                </p>
                              </div>
                            </div>
                          </td>
                          <td className="px-5 py-3 text-texto-oscuro/70">
                            {nombreCategoria.get(socio.categoryId) ?? '-'}
                          </td>
                          <td className="px-5 py-3">
                            <span className="flex items-center gap-2">
                              <span
                                className={cn('size-1.5 rounded-full', STATUS_DOT[socio.status])}
                              />
                              <span className={cn('text-sm', STATUS_TEXT[socio.status])}>
                                {PARTNER_STATUS_LABELS[socio.status]}
                              </span>
                            </span>
                          </td>
                          <td className="px-5 py-3 text-texto-oscuro/60">
                            {formatDate(socio.createdAt)}
                          </td>
                          <td className="px-5 py-3 text-right">
                            <Link
                              to={partnerDetailPath(socio.id)}
                              className="text-sm font-semibold text-marca hover:underline"
                            >
                              Ver ficha
                            </Link>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>

                <footer className="flex flex-wrap items-center justify-between gap-3 border-t border-borde px-5 py-3">
                  <span className="text-xs text-texto-oscuro/50">
                    Mostrando {desde}-{hasta} de {data.meta.total}
                  </span>

                  <div className="flex items-center gap-1">
                    <button
                      type="button"
                      disabled={page <= 1 || socios.isRefreshing}
                      onClick={() => updateParams({ page: String(page - 1) })}
                      className="size-8 rounded-lg border border-borde text-sm text-texto-oscuro/60 transition-colors hover:bg-fondo-claro disabled:opacity-40"
                      aria-label="Pagina anterior"
                    >
                      {'<'}
                    </button>

                    {ventanaPaginas(data.meta.page, totalPages).map((numero) => (
                      <button
                        key={numero}
                        type="button"
                        disabled={socios.isRefreshing}
                        onClick={() => updateParams({ page: String(numero) })}
                        className={cn(
                          'size-8 rounded-lg text-sm font-medium transition-colors',
                          numero === data.meta.page
                            ? 'bg-marca text-fondo-claro'
                            : 'text-texto-oscuro/60 hover:bg-fondo-claro',
                        )}
                      >
                        {numero}
                      </button>
                    ))}

                    <button
                      type="button"
                      disabled={page >= totalPages || socios.isRefreshing}
                      onClick={() => updateParams({ page: String(page + 1) })}
                      className="size-8 rounded-lg border border-borde text-sm text-texto-oscuro/60 transition-colors hover:bg-fondo-claro disabled:opacity-40"
                      aria-label="Pagina siguiente"
                    >
                      {'>'}
                    </button>
                  </div>
                </footer>
              </>
            )
          }}
        </QueryState>
      </div>
    </section>
  )
}
