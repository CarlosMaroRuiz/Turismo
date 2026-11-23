import { useState, type FormEvent } from 'react'
import { useNavigate } from 'react-router'

import { Badge } from '@common/components/Badge'
import { Button } from '@common/Buttons'
import { FormField } from '@common/components/FormField'
import { inputClass, selectClass, textareaClass } from '@common/components/FormField/styles'
import { Modal } from '@common/components/Modal'
import { QueryState } from '@common/components/QueryState'
import { useAction } from '@core/http'
import { PATHS } from '@core/routes/types/paths'
import { useRegions } from '@features/regions'
import { PACKAGE_LIMITS, PACKAGE_STATUS_LABELS, createPackage, useMyPackages } from '..'

const precio = new Intl.NumberFormat('es-MX', { style: 'currency', currency: 'MXN' })

const TONOS: Record<string, 'neutral' | 'success' | 'warning'> = {
  draft: 'warning',
  published: 'success',
  paused: 'neutral',
}

/** Paquetes de la agencia, en tarjetas con portada. */
export default function PackageListPage() {
  const navigate = useNavigate()
  const paquetes = useMyPackages()
  const crear = useAction(createPackage)
  const municipios = useRegions({ type: 'municipality', status: 'active', limit: 200 }, true)

  const [abierto, setAbierto] = useState(false)
  const [nombre, setNombre] = useState('')
  const [resumen, setResumen] = useState('')
  const [descripcion, setDescripcion] = useState('')
  const [noches, setNoches] = useState('3')
  const [viajeros, setViajeros] = useState('1')
  const [regionId, setRegionId] = useState('')
  const [encuentro, setEncuentro] = useState('')
  const [politica, setPolitica] = useState(
    'Cancelación gratuita hasta 7 días antes de la salida. Menos de 48 horas no reembolsable.',
  )

  const enviar = (event: FormEvent<HTMLFormElement>): void => {
    event.preventDefault()

    void crear
      .execute({
        destinationRegionId: regionId,
        name: nombre.trim(),
        summary: resumen.trim(),
        description: descripcion.trim(),
        nights: Number(noches),
        minTravelers: Number(viajeros),
        cancellationPolicy: politica.trim(),
        taxesIncluded: true,
        ...(encuentro.trim() !== '' && { meetingPoint: encuentro.trim() }),
      })
      .then((paquete) => {
        navigate(PATHS.panelPackageDetail(paquete.id))
      })
      .catch(() => {
        // El error queda en `crear.error` y se muestra en el modal.
      })
  }

  return (
    <section className="flex flex-col gap-5">
      <header className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-texto-oscuro">Paquetes</h1>
          <p className="mt-1 text-sm text-texto-oscuro/60">
            Un paquete se publica cuando tiene al menos un ítem incluido, itinerario y una salida
            abierta con cupo.
          </p>
        </div>

        <Button
          size="md"
          onClick={() => {
            crear.reset()
            setAbierto(true)
          }}
        >
          Nuevo paquete
        </Button>
      </header>

      <Modal
        open={abierto}
        title="Nuevo paquete"
        description="Se crea como borrador. Después agregas qué incluye, el itinerario y las salidas."
        onClose={() => setAbierto(false)}
      >
        <form onSubmit={enviar} className="flex flex-col gap-4">
          <FormField htmlFor="paqueteNombre" label="Nombre" required error={crear.error?.fieldError('name')}>
            <input
              id="paqueteNombre"
              className={inputClass}
              required
              minLength={PACKAGE_LIMITS.name.min}
              maxLength={PACKAGE_LIMITS.name.max}
              value={nombre}
              onChange={(event) => setNombre(event.target.value)}
            />
          </FormField>

          <FormField
            htmlFor="paqueteRegion"
            label="Destino"
            required
            error={crear.error?.fieldError('destinationRegionId')}
          >
            <select
              id="paqueteRegion"
              className={selectClass}
              required
              value={regionId}
              onChange={(event) => setRegionId(event.target.value)}
            >
              <option value="">Selecciona el destino</option>
              {(municipios.data?.items ?? []).map((municipio) => (
                <option key={municipio.id} value={municipio.id}>
                  {municipio.name}
                </option>
              ))}
            </select>
          </FormField>

          <FormField
            htmlFor="paqueteResumen"
            label="Resumen"
            required
            hint={`${PACKAGE_LIMITS.summary.min} a ${PACKAGE_LIMITS.summary.max} caracteres`}
            error={crear.error?.fieldError('summary')}
          >
            <input
              id="paqueteResumen"
              className={inputClass}
              required
              minLength={PACKAGE_LIMITS.summary.min}
              maxLength={PACKAGE_LIMITS.summary.max}
              value={resumen}
              onChange={(event) => setResumen(event.target.value)}
            />
          </FormField>

          <FormField
            htmlFor="paqueteDescripcion"
            label="Descripción"
            required
            hint="Mínimo 20 caracteres"
            error={crear.error?.fieldError('description')}
          >
            <textarea
              id="paqueteDescripcion"
              className={textareaClass}
              required
              minLength={PACKAGE_LIMITS.description.min}
              value={descripcion}
              onChange={(event) => setDescripcion(event.target.value)}
            />
          </FormField>

          <div className="grid gap-4 sm:grid-cols-2">
            <FormField htmlFor="paqueteNoches" label="Noches" required error={crear.error?.fieldError('nights')}>
              <input
                id="paqueteNoches"
                type="number"
                inputMode="numeric"
                className={inputClass}
                required
                min={PACKAGE_LIMITS.nights.min}
                max={PACKAGE_LIMITS.nights.max}
                value={noches}
                onChange={(event) => setNoches(event.target.value)}
              />
            </FormField>

            <FormField
              htmlFor="paqueteViajeros"
              label="Mínimo de viajeros"
              required
              error={crear.error?.fieldError('minTravelers')}
            >
              <input
                id="paqueteViajeros"
                type="number"
                inputMode="numeric"
                className={inputClass}
                required
                min={PACKAGE_LIMITS.minTravelers.min}
                max={PACKAGE_LIMITS.minTravelers.max}
                value={viajeros}
                onChange={(event) => setViajeros(event.target.value)}
              />
            </FormField>
          </div>

          <FormField htmlFor="paqueteEncuentro" label="Punto de encuentro" hint="Opcional">
            <input
              id="paqueteEncuentro"
              className={inputClass}
              maxLength={255}
              value={encuentro}
              onChange={(event) => setEncuentro(event.target.value)}
            />
          </FormField>

          <FormField
            htmlFor="paquetePolitica"
            label="Política de cancelación"
            required
            error={crear.error?.fieldError('cancellationPolicy')}
          >
            <textarea
              id="paquetePolitica"
              className={textareaClass}
              required
              minLength={PACKAGE_LIMITS.cancellationPolicy.min}
              value={politica}
              onChange={(event) => setPolitica(event.target.value)}
            />
          </FormField>

          {crear.error !== null && crear.error.errors === undefined && (
            <p role="alert" className="text-sm text-acento">
              {crear.error.message}
            </p>
          )}

          <div className="mt-2 flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
            <Button type="button" variant="secondary" size="md" onClick={() => setAbierto(false)}>
              Cancelar
            </Button>
            <Button type="submit" size="md" disabled={crear.isLoading}>
              {crear.isLoading ? 'Creando...' : 'Crear borrador'}
            </Button>
          </div>
        </form>
      </Modal>

      <QueryState
        query={paquetes}
        isEmpty={(pagina) => pagina.items.length === 0}
        empty="Aún no hay paquetes. Crea el primero para que el bot pueda cotizarlo."
      >
        {(pagina) => (
          <div className="grid gap-5 sm:grid-cols-2 xl:grid-cols-3">
            {pagina.items.map((paquete) => (
              <article
                key={paquete.id}
                className="flex flex-col overflow-hidden rounded-2xl border border-borde bg-white shadow-sm transition-shadow hover:shadow-md"
              >
                <div className="relative aspect-[16/10] bg-fondo-claro">
                  {paquete.images.length > 0 ? (
                    <img
                      src={paquete.images[0]}
                      alt={paquete.name}
                      className="size-full object-cover"
                      loading="lazy"
                    />
                  ) : (
                    <div className="flex size-full items-center justify-center text-xs text-texto-oscuro/30">
                      Sin portada
                    </div>
                  )}
                  <span className="absolute left-3 top-3">
                    <Badge tone={TONOS[paquete.status] ?? 'neutral'}>
                      {PACKAGE_STATUS_LABELS[paquete.status]}
                    </Badge>
                  </span>
                </div>

                <div className="flex flex-1 flex-col gap-3 p-4">
                  <div>
                    <h3 className="font-semibold text-texto-oscuro">{paquete.name}</h3>
                    <p className="mt-0.5 text-xs text-texto-oscuro/50">
                      {paquete.destinationRegionName} · {paquete.days} días / {paquete.nights} noches
                    </p>
                  </div>

                  <div className="mt-auto flex items-end justify-between gap-3">
                    <div>
                      <p className="text-xs text-texto-oscuro/50">Desde</p>
                      <p className="text-lg font-bold text-texto-oscuro">
                        {paquete.minPriceAdult === null ? '-' : precio.format(paquete.minPriceAdult)}
                      </p>
                    </div>

                    <Button
                      variant="secondary"
                      size="sm"
                      onClick={() => navigate(PATHS.panelPackageDetail(paquete.id))}
                    >
                      Abrir
                    </Button>
                  </div>
                </div>
              </article>
            ))}
          </div>
        )}
      </QueryState>
    </section>
  )
}
