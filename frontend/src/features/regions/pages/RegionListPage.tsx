import { useState, type FormEvent } from 'react'
import { useSearchParams } from 'react-router'

import { Badge } from '@common/components/Badge'
import { Button } from '@common/Buttons'
import { FormField } from '@common/components/FormField'
import { Modal } from '@common/components/Modal'
import { inputClass, selectClass } from '@common/components/FormField/styles'
import { QueryState } from '@common/components/QueryState'
import { toMessage, useAction } from '@core/http'
import { SLUG_PATTERN } from '@lib/validation'
import {
  REGION_STATUS_LABELS,
  REGION_TYPE_LABELS,
  createRegion,
  toggleRegionStatus,
  useRegions,
  useStates,
} from '@features/regions'
import type { RegionType } from '@features/regions'

const PAGE_SIZE = 20

/**
 * Regiones: municipios y zonas turisticas.
 *
 * Es la pantalla que alimenta el selector del alta de socios, asi que permite
 * dar de alta un municipio sin depender del seeder. Una zona requiere un
 * municipio padre del mismo estado (regla del contrato).
 */
export default function RegionListPage() {
  const [params, setParams] = useSearchParams()

  const page = Number(params.get('pagina') ?? '1') || 1
  const filtroEstado = params.get('estado') ?? undefined
  const filtroTipoParam = params.get('tipo')
  const filtroTipo =
    filtroTipoParam === 'municipality' || filtroTipoParam === 'zone' ? filtroTipoParam : undefined

  const regiones = useRegions({
    page,
    limit: PAGE_SIZE,
    status: 'all',
    ...(filtroEstado !== undefined && { stateId: filtroEstado }),
    ...(filtroTipo !== undefined && { type: filtroTipo }),
  })
  const estados = useStates(true)

  const crear = useAction(createRegion)
  const alternar = useAction(toggleRegionStatus)

  const [nuevoEstado, setNuevoEstado] = useState('')
  const [nuevoTipo, setNuevoTipo] = useState<RegionType>('municipality')
  const [nuevoNombre, setNuevoNombre] = useState('')
  const [nuevoSlug, setNuevoSlug] = useState('')
  const [nuevoPadre, setNuevoPadre] = useState('')
  const [modalAbierto, setModalAbierto] = useState(false)

  const municipiosPadre = useRegions(
    {
      stateId: nuevoEstado,
      type: 'municipality',
      status: 'active',
      limit: 200,
    },
    nuevoEstado !== '',
  )

  const cambiarFiltro = (cambios: Record<string, string | null>): void => {
    const siguiente = new URLSearchParams(params)
    for (const [nombre, valor] of Object.entries(cambios)) {
      if (valor === null) {
        siguiente.delete(nombre)
      } else {
        siguiente.set(nombre, valor)
      }
    }
    setParams(siguiente)
  }

  const enviar = (event: FormEvent<HTMLFormElement>): void => {
    event.preventDefault()

    void crear
      .execute({
        stateId: nuevoEstado,
        type: nuevoTipo,
        name: nuevoNombre.trim(),
        ...(nuevoSlug.trim() !== '' && { slug: nuevoSlug.trim() }),
        ...(nuevoTipo === 'zone' && nuevoPadre !== '' && { parentId: nuevoPadre }),
      })
      .then(() => {
        setNuevoNombre('')
        setNuevoSlug('')
        setNuevoPadre('')
        setModalAbierto(false)
        return regiones.refetch()
      })
      .catch(() => {
        // El error queda en `crear.error`.
      })
  }

  const cambiarEstadoRegion = (id: string): void => {
    void alternar
      .execute(id)
      .then(() => regiones.refetch())
      .catch(() => {})
  }

  return (
    <section className="flex flex-col gap-5">
      <header className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-texto-oscuro">Regiones</h1>
          <p className="mt-1 text-sm text-texto-oscuro/60">
            {regiones.data !== undefined
              ? `${regiones.data.meta.total} ${regiones.data.meta.total === 1 ? 'region' : 'regiones'}`
              : 'Municipios y zonas turisticas'}
          </p>
        </div>

        <Button
          size="md"
          onClick={() => {
            crear.reset()
            setModalAbierto(true)
          }}
        >
          Agregar region
        </Button>
      </header>

      <Modal
        open={modalAbierto}
        title="Nueva region"
        description="Un municipio no lleva padre; una zona requiere el municipio del mismo estado."
        onClose={() => setModalAbierto(false)}
      >
        <form onSubmit={enviar} className="flex flex-col gap-4">
          <FormField htmlFor="regionEstado" label="Estado" required>
            <select
              id="regionEstado"
              required
              className={selectClass}
              value={nuevoEstado}
              onChange={(event) => {
                setNuevoEstado(event.target.value)
                setNuevoPadre('')
              }}
            >
              <option value="">Selecciona un estado</option>
              {(estados.data ?? []).map((estado) => (
                <option key={estado.id} value={estado.id}>
                  {estado.name}
                </option>
              ))}
            </select>
          </FormField>

          <FormField htmlFor="regionTipo" label="Tipo" required>
            <select
              id="regionTipo"
              className={selectClass}
              value={nuevoTipo}
              onChange={(event) => {
                setNuevoTipo(event.target.value as RegionType)
                setNuevoPadre('')
              }}
            >
              <option value="municipality">{REGION_TYPE_LABELS.municipality}</option>
              <option value="zone">{REGION_TYPE_LABELS.zone}</option>
            </select>
          </FormField>

          {nuevoTipo === 'zone' && (
            <FormField
              htmlFor="regionPadre"
              label="Municipio padre"
              required
              hint="Una zona cuelga de un municipio del mismo estado."
            >
              <select
                id="regionPadre"
                required
                className={selectClass}
                value={nuevoPadre}
                onChange={(event) => setNuevoPadre(event.target.value)}
                disabled={nuevoEstado === '' || municipiosPadre.isLoading}
              >
                <option value="">
                  {nuevoEstado === ''
                    ? 'Elige primero el estado'
                    : municipiosPadre.isLoading
                      ? 'Cargando...'
                      : 'Selecciona un municipio'}
                </option>
                {(municipiosPadre.data?.items ?? []).map((municipio) => (
                  <option key={municipio.id} value={municipio.id}>
                    {municipio.name}
                  </option>
                ))}
              </select>
            </FormField>
          )}

          <FormField
            htmlFor="regionNombre"
            label="Nombre"
            required
            hint="Entre 2 y 150 caracteres"
          >
            <input
              id="regionNombre"
              required
              minLength={2}
              maxLength={150}
              className={inputClass}
              value={nuevoNombre}
              onChange={(event) => setNuevoNombre(event.target.value)}
            />
          </FormField>

          <FormField
            htmlFor="regionSlug"
            label="Slug"
            hint="Opcional. Se genera del nombre y debe ser unico en toda la plataforma."
          >
            <input
              id="regionSlug"
              className={inputClass}
              minLength={2}
              maxLength={180}
              pattern={SLUG_PATTERN}
              title="Solo minusculas, numeros y guiones simples"
              value={nuevoSlug}
              onChange={(event) => setNuevoSlug(event.target.value)}
            />
          </FormField>

          {crear.error !== null && (
            <p role="alert" className="text-sm text-acento">
              {toMessage(crear.error)}
            </p>
          )}

          <div className="mt-2 flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
            <Button
              type="button"
              variant="secondary"
              size="md"
              onClick={() => setModalAbierto(false)}
            >
              Cancelar
            </Button>
            <Button type="submit" size="md" disabled={crear.isLoading}>
              {crear.isLoading ? 'Creando...' : 'Agregar'}
            </Button>
          </div>
        </form>
      </Modal>

      <div className="overflow-hidden rounded-2xl border border-borde bg-white shadow-sm">
        <div className="flex flex-wrap items-end gap-3 border-b border-borde px-5 py-4">
          <label className="flex flex-col gap-1 text-sm">
            <span className="font-medium text-texto-oscuro">Estado</span>
            <select
              className="h-10 rounded-lg border border-borde bg-white px-3 text-texto-oscuro focus:border-acento focus:outline-none focus:ring-2 focus:ring-acento/20"
              value={filtroEstado ?? ''}
              onChange={(event) =>
                cambiarFiltro({
                  estado: event.target.value === '' ? null : event.target.value,
                  pagina: '1',
                })
              }
            >
              <option value="">Todos</option>
              {(estados.data ?? []).map((estado) => (
                <option key={estado.id} value={estado.id}>
                  {estado.name}
                </option>
              ))}
            </select>
          </label>

          <label className="flex flex-col gap-1 text-sm">
            <span className="font-medium text-texto-oscuro">Tipo</span>
            <select
              className="h-10 rounded-lg border border-borde bg-white px-3 text-texto-oscuro focus:border-acento focus:outline-none focus:ring-2 focus:ring-acento/20"
              value={filtroTipo ?? ''}
              onChange={(event) =>
                cambiarFiltro({
                  tipo: event.target.value === '' ? null : event.target.value,
                  pagina: '1',
                })
              }
            >
              <option value="">Todos</option>
              <option value="municipality">{REGION_TYPE_LABELS.municipality}</option>
              <option value="zone">{REGION_TYPE_LABELS.zone}</option>
            </select>
          </label>
        </div>

        <QueryState
          query={regiones}
          isEmpty={(datos) => datos.items.length === 0}
          empty="No hay regiones con ese filtro."
        >
          {(datos) => (
            <>
              <div className="overflow-x-auto">
                <table className="w-full min-w-[720px] text-left text-sm">
                  <thead className="text-xs uppercase tracking-wide text-texto-oscuro/40">
                    <tr>
                      <th className="px-5 py-3 font-semibold">Region</th>
                      <th className="px-5 py-3 font-semibold">Tipo</th>
                      <th className="px-5 py-3 font-semibold">Estado</th>
                      <th className="px-5 py-3 font-semibold">Municipio padre</th>
                      <th className="px-5 py-3 font-semibold">Situacion</th>
                      <th className="px-5 py-3 text-right font-semibold">Accion</th>
                    </tr>
                  </thead>
                  <tbody>
                    {datos.items.map((region) => (
                      <tr key={region.id} className="border-t border-borde/60 hover:bg-fondo-claro">
                        <td className="px-5 py-3">
                          <p className="font-medium text-texto-oscuro">{region.name}</p>
                          <p className="font-mono text-xs text-texto-oscuro/50">{region.slug}</p>
                        </td>
                        <td className="px-5 py-3 text-texto-oscuro/70">
                          {REGION_TYPE_LABELS[region.type]}
                        </td>
                        <td className="px-5 py-3 text-texto-oscuro/70">{region.stateName ?? '-'}</td>
                        <td className="px-5 py-3 text-texto-oscuro/70">{region.parentName ?? '-'}</td>
                        <td className="px-5 py-3">
                          <Badge tone={region.status === 'active' ? 'success' : 'neutral'}>
                            {REGION_STATUS_LABELS[region.status]}
                          </Badge>
                        </td>
                        <td className="px-5 py-3 text-right">
                          <Button
                            variant="secondary"
                            size="sm"
                            disabled={alternar.isLoading}
                            onClick={() => cambiarEstadoRegion(region.id)}
                          >
                            {region.status === 'active' ? 'Desactivar' : 'Activar'}
                          </Button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              <footer className="flex flex-wrap items-center justify-between gap-3 border-t border-borde px-5 py-3">
                <span className="text-xs text-texto-oscuro/50">
                  Pagina {datos.meta.page} de {Math.max(datos.meta.totalPages, 1)}
                </span>
                <div className="flex gap-2">
                  <Button
                    variant="secondary"
                    size="sm"
                    disabled={page <= 1 || regiones.isRefreshing}
                    onClick={() => cambiarFiltro({ pagina: String(page - 1) })}
                  >
                    Anterior
                  </Button>
                  <Button
                    variant="secondary"
                    size="sm"
                    disabled={page >= datos.meta.totalPages || regiones.isRefreshing}
                    onClick={() => cambiarFiltro({ pagina: String(page + 1) })}
                  >
                    Siguiente
                  </Button>
                </div>
              </footer>
            </>
          )}
        </QueryState>
      </div>
    </section>
  )
}
