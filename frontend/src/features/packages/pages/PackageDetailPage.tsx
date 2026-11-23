import { useState, type FormEvent, type ReactNode } from 'react'
import { Link, useParams } from 'react-router'

import { Badge } from '@common/components/Badge'
import { Button } from '@common/Buttons'
import { FormField } from '@common/components/FormField'
import { inputClass, selectClass, textareaClass } from '@common/components/FormField/styles'
import { QueryState } from '@common/components/QueryState'
import { useAction } from '@core/http'
import { PATHS } from '@core/routes/types/paths'

import {
  DEPARTURE_STATUS_LABELS,
  PACKAGE_ITEM_LABELS,
  PACKAGE_LIMITS,
  PACKAGE_STATUS_LABELS,
  addDeparture,
  changePackageStatus,
  updateDeparture,
  updatePackage,
  usePackageDetail,
} from '..'
import type {
  Departure,
  DeparturePayload,
  ItineraryDay,
  PackageItem,
  PackageItemType,
  PackageStatus,
  UpdatePackagePayload,
} from '../dto/package.dto'

const precio = new Intl.NumberFormat('es-MX', { style: 'currency', currency: 'MXN' })

const TONOS: Record<PackageStatus, 'neutral' | 'success' | 'warning'> = {
  draft: 'warning',
  published: 'success',
  paused: 'neutral',
}

function Tarjeta({ titulo, extra, children }: { titulo: string; extra?: ReactNode; children: ReactNode }) {
  return (
    <section className="rounded-2xl border border-borde bg-white p-6 shadow-sm">
      <div className="mb-4 flex flex-wrap items-center justify-between gap-2">
        <h2 className="text-sm font-semibold uppercase tracking-wide text-texto-oscuro/50">{titulo}</h2>
        {extra}
      </div>
      {children}
    </section>
  )
}

/**
 * Detalle del paquete.
 *
 * La API reemplaza los arreglos completos, así que cada alta o baja de ítem o
 * de día reenvía la lista entera: no hay endpoints por elemento.
 */
export default function PackageDetailPage() {
  const { id } = useParams<{ id: string }>()
  const paquete = usePackageDetail(id)

  const actualizar = useAction((entrada: { id: string; payload: UpdatePackagePayload }) =>
    updatePackage(entrada.id, entrada.payload),
  )
  const estado = useAction((entrada: { id: string; estado: PackageStatus }) =>
    changePackageStatus(entrada.id, entrada.estado),
  )
  const nuevaSalida = useAction((entrada: { id: string; payload: DeparturePayload }) =>
    addDeparture(entrada.id, entrada.payload),
  )
  const cambiarSalida = useAction(
    (entrada: { id: string; departureId: string; status: 'open' | 'closed' }) =>
      updateDeparture(entrada.id, entrada.departureId, { status: entrada.status }),
  )

  const [itemTipo, setItemTipo] = useState<PackageItemType>('activity')
  const [itemTexto, setItemTexto] = useState('')
  const [itemIncluido, setItemIncluido] = useState(true)

  const [diaTitulo, setDiaTitulo] = useState('')
  const [diaTexto, setDiaTexto] = useState('')

  const [fecha, setFecha] = useState('')
  const [asientos, setAsientos] = useState('20')
  const [precioAdulto, setPrecioAdulto] = useState('')
  const [precioMenor, setPrecioMenor] = useState('')

  const datos = paquete.data

  const guardar = (payload: UpdatePackagePayload): void => {
    if (datos === undefined) {
      return
    }

    void actualizar
      .execute({ id: datos.id, payload })
      .then(() => paquete.refetch())
      .catch(() => {
        // El error queda en `actualizar.error`.
      })
  }

  const agregarItem = (event: FormEvent<HTMLFormElement>): void => {
    event.preventDefault()
    if (datos === undefined) {
      return
    }

    const items = [
      ...datos.items,
      {
        id: `nuevo-${Date.now()}`,
        type: itemTipo,
        description: itemTexto.trim(),
        isIncluded: itemIncluido,
        sortOrder: datos.items.length,
      } satisfies PackageItem,
    ]

    setItemTexto('')
    guardar({ items: items.map(aEntradaItem) })
  }

  const quitarItem = (item: PackageItem): void => {
    if (datos === undefined) {
      return
    }
    guardar({ items: datos.items.filter((otro) => otro.id !== item.id).map(aEntradaItem) })
  }

  const agregarDia = (event: FormEvent<HTMLFormElement>): void => {
    event.preventDefault()
    if (datos === undefined) {
      return
    }

    const dias = [
      ...datos.itinerary,
      {
        id: `nuevo-${Date.now()}`,
        dayNumber: datos.itinerary.length + 1,
        title: diaTitulo.trim(),
        description: diaTexto.trim(),
      } satisfies ItineraryDay,
    ]

    setDiaTitulo('')
    setDiaTexto('')
    guardar({ itinerary: dias.map(aEntradaDia) })
  }

  const quitarDia = (dia: ItineraryDay): void => {
    if (datos === undefined) {
      return
    }

    const dias = datos.itinerary
      .filter((otro) => otro.id !== dia.id)
      .map((otro, indice) => ({ ...otro, dayNumber: indice + 1 }))

    guardar({ itinerary: dias.map(aEntradaDia) })
  }

  const agregarSalida = (event: FormEvent<HTMLFormElement>): void => {
    event.preventDefault()
    if (datos === undefined) {
      return
    }

    void nuevaSalida
      .execute({
        id: datos.id,
        payload: {
          departureDate: fecha,
          totalSeats: Number(asientos),
          adultPrice: Number(precioAdulto),
          ...(precioMenor.trim() !== '' && { childPrice: Number(precioMenor) }),
        },
      })
      .then(() => {
        setFecha('')
        setPrecioAdulto('')
        setPrecioMenor('')
        return paquete.refetch()
      })
      .catch(() => {
        // El error queda en `nuevaSalida.error`.
      })
  }

  const alternarSalida = (salida: Departure): void => {
    if (datos === undefined) {
      return
    }

    void cambiarSalida
      .execute({
        id: datos.id,
        departureId: salida.id,
        status: salida.status === 'open' ? 'closed' : 'open',
      })
      .then(() => paquete.refetch())
      .catch(() => {
        // El error queda en `cambiarSalida.error`.
      })
  }

  const cambiarEstado = (siguiente: PackageStatus): void => {
    if (datos === undefined) {
      return
    }

    void estado
      .execute({ id: datos.id, estado: siguiente })
      .then(() => paquete.refetch())
      .catch(() => {
        // El error queda en `estado.error`.
      })
  }

  return (
    <QueryState query={paquete}>
      {(detalle) => (
        <div className="flex flex-col gap-5">
          <Link to={PATHS.panelPackages} className="text-sm font-medium text-marca hover:underline">
            Volver a paquetes
          </Link>

          <header className="flex flex-wrap items-start justify-between gap-4">
            <div>
              <div className="flex flex-wrap items-center gap-3">
                <h1 className="text-2xl font-bold text-texto-oscuro">{detalle.name}</h1>
                <Badge tone={TONOS[detalle.status]}>{PACKAGE_STATUS_LABELS[detalle.status]}</Badge>
              </div>
              <p className="mt-1 text-sm text-texto-oscuro/60">
                {detalle.destinationRegionName} · {detalle.days} días / {detalle.nights} noches ·
                desde {detalle.minTravelers} viajero{detalle.minTravelers === 1 ? '' : 's'}
              </p>
            </div>

            <div className="flex flex-wrap gap-2">
              {detalle.status === 'published' ? (
                <Button
                  variant="secondary"
                  size="md"
                  disabled={estado.isLoading}
                  onClick={() => cambiarEstado('paused')}
                >
                  Pausar
                </Button>
              ) : (
                <Button size="md" disabled={estado.isLoading} onClick={() => cambiarEstado('published')}>
                  {estado.isLoading ? 'Publicando...' : 'Publicar'}
                </Button>
              )}
            </div>
          </header>

          {estado.error !== null && (
            <p role="alert" className="rounded-lg bg-acento/10 px-4 py-3 text-sm text-acento">
              {estado.error.message}
            </p>
          )}

          <Tarjeta titulo="Descripción">
            <p className="text-sm leading-relaxed text-texto-oscuro/80">{detalle.summary}</p>
            <p className="mt-2 text-sm leading-relaxed text-texto-oscuro/60">{detalle.description}</p>
            <p className="mt-3 text-xs text-texto-oscuro/50">
              Política de cancelación: {detalle.cancellationPolicy}
            </p>
          </Tarjeta>

          <Tarjeta titulo="Portada">
            <PortadaEditor
              actual={detalle.images[0] ?? null}
              guardando={actualizar.isLoading}
              onGuardar={(url) => guardar({ images: url === '' ? [] : [url] })}
            />
            {actualizar.error !== null && (
              <p role="alert" className="mt-2 text-sm text-acento">
                {actualizar.error.message}
              </p>
            )}
          </Tarjeta>

          <Tarjeta titulo="Incluye"
            extra={
              <span className="text-xs text-texto-oscuro/40">
                {detalle.items.filter((item) => item.isIncluded).length} incluidos
              </span>
            }
          >
            {detalle.items.length === 0 ? (
              <p className="text-sm text-texto-oscuro/60">
                Sin ítems. Se necesita al menos uno incluido para publicar.
              </p>
            ) : (
              <ul className="flex flex-col gap-2">
                {detalle.items.map((item) => (
                  <li key={item.id} className="flex items-start justify-between gap-3 text-sm">
                    <span className={item.isIncluded ? 'text-texto-oscuro/80' : 'text-texto-oscuro/40 line-through'}>
                      <span className="mr-2 text-xs uppercase tracking-wide text-texto-oscuro/40">
                        {PACKAGE_ITEM_LABELS[item.type]}
                      </span>
                      {item.description}
                    </span>
                    <button
                      type="button"
                      onClick={() => quitarItem(item)}
                      className="shrink-0 text-xs font-medium text-acento hover:underline"
                    >
                      Quitar
                    </button>
                  </li>
                ))}
              </ul>
            )}

            <form onSubmit={agregarItem} className="mt-4 flex flex-col gap-3 border-t border-borde pt-4 sm:flex-row sm:items-end">
              <FormField htmlFor="itemTipo" label="Tipo">
                <select
                  id="itemTipo"
                  className={selectClass}
                  value={itemTipo}
                  onChange={(event) => setItemTipo(event.target.value as PackageItemType)}
                >
                  {Object.entries(PACKAGE_ITEM_LABELS).map(([valor, etiqueta]) => (
                    <option key={valor} value={valor}>
                      {etiqueta}
                    </option>
                  ))}
                </select>
              </FormField>

              <div className="flex-1">
                <FormField htmlFor="itemTexto" label="Descripción">
                  <input
                    id="itemTexto"
                    className={inputClass}
                    required
                    minLength={PACKAGE_LIMITS.itemDescription.min}
                    maxLength={PACKAGE_LIMITS.itemDescription.max}
                    value={itemTexto}
                    onChange={(event) => setItemTexto(event.target.value)}
                  />
                </FormField>
              </div>

              <label className="flex cursor-pointer items-center gap-2 pb-3 text-sm text-texto-oscuro/70">
                <input
                  type="checkbox"
                  className="size-4 cursor-pointer accent-acento"
                  checked={itemIncluido}
                  onChange={(event) => setItemIncluido(event.target.checked)}
                />
                Incluido
              </label>

              <Button type="submit" size="md" disabled={actualizar.isLoading}>
                Agregar
              </Button>
            </form>

            {actualizar.error !== null && (
              <p role="alert" className="mt-2 text-sm text-acento">
                {actualizar.error.message}
              </p>
            )}
          </Tarjeta>

          <Tarjeta titulo="Itinerario">
            {detalle.itinerary.length === 0 ? (
              <p className="text-sm text-texto-oscuro/60">Sin días. Se necesita el itinerario para publicar.</p>
            ) : (
              <ol className="flex flex-col gap-3">
                {detalle.itinerary.map((dia) => (
                  <li key={dia.id} className="flex items-start justify-between gap-3">
                    <div>
                      <p className="text-sm font-medium text-texto-oscuro">
                        Día {dia.dayNumber}: {dia.title}
                      </p>
                      <p className="text-sm text-texto-oscuro/60">{dia.description}</p>
                    </div>
                    <button
                      type="button"
                      onClick={() => quitarDia(dia)}
                      className="shrink-0 text-xs font-medium text-acento hover:underline"
                    >
                      Quitar
                    </button>
                  </li>
                ))}
              </ol>
            )}

            <form onSubmit={agregarDia} className="mt-4 flex flex-col gap-3 border-t border-borde pt-4">
              <FormField htmlFor="diaTitulo" label="Título del día" required>
                <input
                  id="diaTitulo"
                  className={inputClass}
                  required
                  minLength={PACKAGE_LIMITS.itineraryTitle.min}
                  maxLength={PACKAGE_LIMITS.itineraryTitle.max}
                  value={diaTitulo}
                  onChange={(event) => setDiaTitulo(event.target.value)}
                />
              </FormField>

              <FormField htmlFor="diaTexto" label="Descripción" required>
                <textarea
                  id="diaTexto"
                  className={textareaClass}
                  required
                  minLength={5}
                  value={diaTexto}
                  onChange={(event) => setDiaTexto(event.target.value)}
                />
              </FormField>

              <div className="flex justify-end">
                <Button type="submit" size="md" disabled={actualizar.isLoading}>
                  Agregar día
                </Button>
              </div>
            </form>
          </Tarjeta>

          <Tarjeta titulo="Salidas">
            {detalle.departures.length === 0 ? (
              <p className="text-sm text-texto-oscuro/60">
                Sin salidas. Se necesita una abierta con cupo para publicar.
              </p>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-left text-sm">
                  <thead className="text-xs uppercase tracking-wide text-texto-oscuro/40">
                    <tr>
                      <th className="py-2 font-semibold">Fecha</th>
                      <th className="py-2 font-semibold">Cupo</th>
                      <th className="py-2 font-semibold">Adulto</th>
                      <th className="py-2 font-semibold">Menor</th>
                      <th className="py-2 font-semibold">Estado</th>
                      <th className="py-2" />
                    </tr>
                  </thead>
                  <tbody>
                    {detalle.departures.map((salida) => (
                      <tr key={salida.id} className="border-t border-borde/60">
                        <td className="py-2 text-texto-oscuro/80">{salida.departureDate}</td>
                        <td className="py-2 text-texto-oscuro/70">
                          {salida.availableSeats} de {salida.totalSeats}
                        </td>
                        <td className="py-2 text-texto-oscuro/70">{precio.format(salida.adultPrice)}</td>
                        <td className="py-2 text-texto-oscuro/70">
                          {salida.childPrice === null ? '-' : precio.format(salida.childPrice)}
                        </td>
                        <td className="py-2 text-texto-oscuro/70">
                          {DEPARTURE_STATUS_LABELS[salida.status]}
                        </td>
                        <td className="py-2 text-right">
                          <button
                            type="button"
                            onClick={() => alternarSalida(salida)}
                            className="text-xs font-medium text-marca hover:underline"
                          >
                            {salida.status === 'open' ? 'Cerrar' : 'Abrir'}
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}

            <form
              onSubmit={agregarSalida}
              className="mt-4 grid gap-3 border-t border-borde pt-4 sm:grid-cols-2 lg:grid-cols-5 lg:items-end"
            >
              <FormField htmlFor="salidaFecha" label="Fecha" required>
                <input
                  id="salidaFecha"
                  type="date"
                  className={inputClass}
                  required
                  value={fecha}
                  onChange={(event) => setFecha(event.target.value)}
                />
              </FormField>

              <FormField htmlFor="salidaAsientos" label="Cupo" required>
                <input
                  id="salidaAsientos"
                  type="number"
                  inputMode="numeric"
                  className={inputClass}
                  required
                  min={PACKAGE_LIMITS.seats.min}
                  max={PACKAGE_LIMITS.seats.max}
                  value={asientos}
                  onChange={(event) => setAsientos(event.target.value)}
                />
              </FormField>

              <FormField htmlFor="salidaAdulto" label="Precio adulto" required>
                <input
                  id="salidaAdulto"
                  type="number"
                  inputMode="decimal"
                  step="0.01"
                  className={inputClass}
                  required
                  min={1}
                  value={precioAdulto}
                  onChange={(event) => setPrecioAdulto(event.target.value)}
                />
              </FormField>

              <FormField htmlFor="salidaMenor" label="Precio menor" hint="Opcional">
                <input
                  id="salidaMenor"
                  type="number"
                  inputMode="decimal"
                  step="0.01"
                  className={inputClass}
                  min={1}
                  value={precioMenor}
                  onChange={(event) => setPrecioMenor(event.target.value)}
                />
              </FormField>

              <Button type="submit" size="md" disabled={nuevaSalida.isLoading}>
                {nuevaSalida.isLoading ? 'Agregando...' : 'Agregar salida'}
              </Button>
            </form>

            {nuevaSalida.error !== null && (
              <p role="alert" className="mt-2 text-sm text-acento">
                {nuevaSalida.error.message}
              </p>
            )}
            {cambiarSalida.error !== null && (
              <p role="alert" className="mt-2 text-sm text-acento">
                {cambiarSalida.error.message}
              </p>
            )}
          </Tarjeta>
        </div>
      )}
    </QueryState>
  )
}

/** Editor de la portada: una sola URL, porque no hay almacenamiento de archivos. */
function PortadaEditor({
  actual,
  guardando,
  onGuardar,
}: {
  actual: string | null
  guardando: boolean
  onGuardar: (url: string) => void
}) {
  const [url, setUrl] = useState(actual ?? '')

  return (
    <form
      onSubmit={(event) => {
        event.preventDefault()
        onGuardar(url.trim())
      }}
      className="flex flex-col gap-3 sm:flex-row sm:items-end"
    >
      <div className="flex-1">
        <FormField
          htmlFor="portada"
          label="URL de la imagen"
          hint="Opcional. Se usa como portada del paquete en el catalogo."
        >
          <input
            id="portada"
            type="url"
            className={inputClass}
            placeholder="https://..."
            value={url}
            onChange={(event) => setUrl(event.target.value)}
          />
        </FormField>
      </div>

      {actual !== null && (
        <img src={actual} alt="" className="h-16 w-28 rounded-lg object-cover" />
      )}

      <Button type="submit" size="md" disabled={guardando}>
        {guardando ? 'Guardando...' : 'Guardar portada'}
      </Button>
    </form>
  )
}

/** Convierte un ítem de la API al cuerpo que espera el PATCH. */
function aEntradaItem(item: PackageItem, indice: number) {
  return {
    type: item.type,
    description: item.description,
    isIncluded: item.isIncluded,
    sortOrder: indice,
  }
}

function aEntradaDia(dia: ItineraryDay) {
  return { dayNumber: dia.dayNumber, title: dia.title, description: dia.description }
}
