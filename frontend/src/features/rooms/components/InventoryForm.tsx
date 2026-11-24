import { useMemo, useState, type FormEvent } from 'react'

import { Button } from '@common/Buttons'
import { FormField } from '@common/components/FormField'
import { inputClass } from '@common/components/FormField/styles'
import type { ApiError } from '@core/http'
import { cn } from '@lib/cn'

import type { InventoryDay, InventoryRangePayload, RoomType } from '../dto/room.dto'
import { useInventory } from '../hooks'

interface InventoryFormProps {
  room: RoomType
  isSubmitting: boolean
  error: ApiError | null
  onSubmit: (payload: InventoryRangePayload) => void
  onCancel: () => void
}

const precio = new Intl.NumberFormat('es-MX', { style: 'currency', currency: 'MXN' })
const corto = new Intl.NumberFormat('es-MX', { maximumFractionDigits: 0 })

const DIAS = ['Lun', 'Mar', 'Mié', 'Jue', 'Vie', 'Sáb', 'Dom']

function iso(fecha: Date): string {
  const mes = String(fecha.getMonth() + 1).padStart(2, '0')
  const dia = String(fecha.getDate()).padStart(2, '0')
  return `${fecha.getFullYear()}-${mes}-${dia}`
}

function hoyIso(): string {
  return iso(new Date())
}

function mesDe(fecha: string): string {
  return fecha.slice(0, 7)
}

function inicioDeMes(mes: string): string {
  return `${mes}-01`
}

function finDeMes(mes: string): string {
  const [anio, numero] = mes.split('-').map(Number)
  const ultimo = new Date(anio, numero, 0).getDate()
  return `${mes}-${String(ultimo).padStart(2, '0')}`
}

function sumarMes(mes: string, delta: number): string {
  const [anio, numero] = mes.split('-').map(Number)
  const fecha = new Date(anio, numero - 1 + delta, 1)
  return `${fecha.getFullYear()}-${String(fecha.getMonth() + 1).padStart(2, '0')}`
}

function nombreMes(mes: string): string {
  const [anio, numero] = mes.split('-').map(Number)
  const texto = new Date(anio, numero - 1, 1).toLocaleDateString('es-MX', {
    month: 'long',
    year: 'numeric',
  })
  return texto.charAt(0).toUpperCase() + texto.slice(1)
}

/** Celdas vacias antes del dia 1, para que la semana empiece en lunes. */
function desfase(mes: string): number {
  const [anio, numero] = mes.split('-').map(Number)
  const dia = new Date(anio, numero - 1, 1).getDay()
  return (dia + 6) % 7
}

function diasEntre(desde: string, hasta: string): number {
  const inicio = new Date(`${desde}T00:00:00`)
  const fin = new Date(`${hasta}T00:00:00`)
  return Math.round((fin.getTime() - inicio.getTime()) / 86_400_000) + 1
}

function fechaLegible(fecha: string): string {
  const [anio, mes, dia] = fecha.split('-').map(Number)
  return new Date(anio, mes - 1, dia).toLocaleDateString('es-MX', {
    day: 'numeric',
    month: 'short',
  })
}

/** Lunes y domingo de la semana que contiene la fecha dada. */
function finDeSemana(fecha: string): { desde: string; hasta: string } {
  const [anio, mes, dia] = fecha.split('-').map(Number)
  const base = new Date(anio, mes - 1, dia)
  const desplazamiento = (base.getDay() + 6) % 7
  const lunes = new Date(base)
  lunes.setDate(base.getDate() - desplazamiento)
  const domingo = new Date(lunes)
  domingo.setDate(lunes.getDate() + 6)
  return { desde: iso(lunes), hasta: iso(domingo) }
}

/**
 * Inventario en calendario.
 *
 * El calendario es la pieza central: cada dia muestra su tarifa y sus
 * unidades, y se pinta distinto si tiene tarifa propia, si usa la base o si
 * esta cerrado. Al elegir un rango, el panel izquierdo calcula en vivo lo que
 * se va a guardar y lo que representa en ingresos.
 */
export function InventoryForm({ room, isSubmitting, error, onSubmit, onCancel }: InventoryFormProps) {
  const hoy = hoyIso()
  const [desde, setDesde] = useState(hoy)
  const [hasta, setHasta] = useState(hoy)
  const [mes, setMes] = useState(mesDe(hoy))
  const [unidades, setUnidades] = useState(String(room.totalUnits))
  const [tarifa, setTarifa] = useState(String(room.basePrice))
  const [cerrado, setCerrado] = useState(false)
  const [eligiendo, setEligiendo] = useState(true)

  const dias = useInventory(room.id, inicioDeMes(mes), finDeMes(mes))
  const rangoInvalido = desde === '' || hasta === '' || desde > hasta

  const porFecha = useMemo(() => {
    const mapa = new Map<string, InventoryDay>()
    for (const dia of dias.data ?? []) {
      mapa.set(dia.date, dia)
    }
    return mapa
  }, [dias.data])

  const resumen = useMemo(() => {
    const fechas = [...porFecha.keys()].filter((fecha) => fecha.startsWith(mes))
    const cerrados = fechas.filter((fecha) => porFecha.get(fecha)?.isClosed === true).length
    const propias = fechas.filter((fecha) => porFecha.has(fecha) && !porFecha.get(fecha)?.isClosed)
    const promedio =
      propias.length === 0
        ? room.basePrice
        : Math.round(
            propias.reduce((suma, fecha) => suma + (porFecha.get(fecha)?.price ?? 0), 0) /
              propias.length,
          )
    return { cerrados, promedio, propias: propias.length }
  }, [porFecha, mes, room.basePrice])

  const noches = rangoInvalido ? 0 : diasEntre(desde, hasta)
  const ingreso = noches * Number(unidades || 0) * Number(tarifa || 0)

  const elegirDia = (fecha: string): void => {
    if (eligiendo) {
      setDesde(fecha)
      setHasta(fecha)
      setEligiendo(false)
      return
    }

    if (fecha < desde) {
      setDesde(fecha)
    } else {
      setHasta(fecha)
    }
    setEligiendo(true)
  }

  const aplicarAtajo = (nuevoDesde: string, nuevoHasta: string): void => {
    setDesde(nuevoDesde)
    setHasta(nuevoHasta)
    setMes(mesDe(nuevoDesde))
    setEligiendo(true)
  }

  const enviar = (event: FormEvent<HTMLFormElement>): void => {
    event.preventDefault()

    onSubmit({
      from: desde,
      to: hasta,
      units: Number(unidades),
      price: Number(tarifa),
      isClosed: cerrado,
    })
  }

  const total = new Date(Number(mes.slice(0, 4)), Number(mes.slice(5, 7)), 0).getDate()
  const celdas: Array<string | null> = [
    ...Array.from({ length: desfase(mes) }, () => null),
    ...Array.from({ length: total }, (_, indice) => `${mes}-${String(indice + 1).padStart(2, '0')}`),
  ]


  return (
    <div className="grid gap-5 lg:grid-cols-[minmax(0,320px)_minmax(0,1fr)]">
      <form onSubmit={enviar} className="flex flex-col gap-4">
        {/* Resumen vivo de lo que se va a guardar */}
        <div className="overflow-hidden rounded-2xl bg-marca p-4 text-fondo-claro">
          <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-fondo-claro/70">
            Rango seleccionado
          </p>
          <p className="mt-1 text-lg font-bold">
            {rangoInvalido ? 'Elige las fechas' : `${fechaLegible(desde)} — ${fechaLegible(hasta)}`}
          </p>
          <div className="mt-3 grid grid-cols-3 gap-2 text-center">
            <div className="rounded-xl bg-white/10 px-2 py-2">
              <p className="text-lg font-bold leading-none">{noches}</p>
              <p className="mt-1 text-[10px] text-fondo-claro/70">noches</p>
            </div>
            <div className="rounded-xl bg-white/10 px-2 py-2">
              <p className="text-lg font-bold leading-none">{unidades || 0}</p>
              <p className="mt-1 text-[10px] text-fondo-claro/70">unidades</p>
            </div>
            <div className="rounded-xl bg-white/10 px-2 py-2">
              <p className="text-lg font-bold leading-none">{corto.format(Number(tarifa || 0))}</p>
              <p className="mt-1 text-[10px] text-fondo-claro/70">por noche</p>
            </div>
          </div>
          <p className="mt-3 text-xs text-fondo-claro/80">
            {cerrado ? 'Se cierran estas fechas' : `Ingreso estimado ${precio.format(ingreso)}`}
          </p>
        </div>

        <div className="flex flex-col gap-4">
          <details className="rounded-xl border border-borde bg-white px-3 py-2">
            <summary className="cursor-pointer text-xs font-semibold text-texto-oscuro/60">
              Escribir las fechas exactas
            </summary>
            <div className="mt-3 grid grid-cols-2 gap-3">
              <FormField htmlFor="inventarioDesde" label="Desde" required>
                <input
                  id="inventarioDesde"
                  type="date"
                  className={inputClass}
                  required
                  value={desde}
                  onChange={(event) => setDesde(event.target.value)}
                />
              </FormField>

              <FormField
                htmlFor="inventarioHasta"
                label="Hasta"
                required
                error={rangoInvalido ? 'Debe ser igual o posterior.' : undefined}
              >
                <input
                  id="inventarioHasta"
                  type="date"
                  className={inputClass}
                  required
                  value={hasta}
                  onChange={(event) => setHasta(event.target.value)}
                />
              </FormField>
            </div>
          </details>

          <FormField
            htmlFor="inventarioUnidades"
            label="Unidades disponibles"
            required
            hint={`Hoy el tipo tiene ${room.totalUnits}`}
          >
            <input
              id="inventarioUnidades"
              type="number"
              inputMode="numeric"
              className={inputClass}
              required
              min={0}
              max={500}
              value={unidades}
              onChange={(event) => setUnidades(event.target.value)}
            />
          </FormField>

          <FormField
            htmlFor="inventarioTarifa"
            label="Tarifa por noche"
            required
            hint={`Base: ${precio.format(room.basePrice)}`}
          >
            <input
              id="inventarioTarifa"
              type="number"
              inputMode="decimal"
              step="0.01"
              className={inputClass}
              required
              min={1}
              value={tarifa}
              onChange={(event) => setTarifa(event.target.value)}
            />
          </FormField>

          <label
            className={cn(
              'flex cursor-pointer items-start gap-3 rounded-xl border p-3 transition-colors',
              cerrado ? 'border-acento/40 bg-acento/5' : 'border-borde bg-white',
            )}
          >
            <input
              type="checkbox"
              className="mt-0.5 size-4 cursor-pointer accent-acento"
              checked={cerrado}
              onChange={(event) => setCerrado(event.target.checked)}
            />
            <span>
              <span className="block text-sm font-semibold text-texto-oscuro">
                Cerrar estas fechas
              </span>
              <span className="block text-xs text-texto-oscuro/60">
                No aparecen en el cotizador ni se pueden reservar.
              </span>
            </span>
          </label>
        </div>

        {error !== null && (
          <p role="alert" className="text-sm text-acento">
            {error.message}
          </p>
        )}

        <div className="flex flex-col gap-2">
          <Button type="submit" size="md" fullWidth disabled={isSubmitting || rangoInvalido}>
            {isSubmitting ? 'Aplicando...' : 'Aplicar al rango'}
          </Button>
          <Button type="button" variant="secondary" size="md" fullWidth onClick={onCancel}>
            Cerrar
          </Button>
        </div>
      </form>

      <div className="flex flex-col overflow-hidden rounded-2xl border border-borde bg-white shadow-sm">
        <div className="flex flex-wrap items-center justify-between gap-3 border-b border-borde px-4 py-3">
          <div className="flex items-center gap-2">
            <h3 className="text-base font-bold text-texto-oscuro">{nombreMes(mes)}</h3>
            <div className="flex items-center gap-1">
              <button
                type="button"
                onClick={() => setMes(sumarMes(mes, -1))}
                className="rounded-full p-1 text-texto-oscuro/50 transition-colors hover:bg-fondo-claro hover:text-texto-oscuro"
                aria-label="Mes anterior"
              >
                ‹
              </button>
              <button
                type="button"
                onClick={() => setMes(sumarMes(mes, 1))}
                className="rounded-full p-1 text-texto-oscuro/50 transition-colors hover:bg-fondo-claro hover:text-texto-oscuro"
                aria-label="Mes siguiente"
              >
                ›
              </button>
              <button
                type="button"
                onClick={() => {
                  setMes(mesDe(hoy))
                  aplicarAtajo(hoy, hoy)
                }}
                className="ml-1 rounded-full border border-borde px-3 py-1 text-xs font-semibold text-texto-oscuro transition-colors hover:border-marca/40 hover:text-marca"
              >
                Hoy
              </button>
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-2 text-[11px]">
            <span className="rounded-full bg-marca/[0.08] px-2.5 py-1 font-semibold text-marca">
              {precio.format(resumen.promedio)} promedio
            </span>
            <span className="rounded-full bg-acento/10 px-2.5 py-1 font-semibold text-acento">
              {resumen.cerrados} cerrado{resumen.cerrados === 1 ? '' : 's'}
            </span>
            <span className="rounded-full bg-fondo-claro px-2.5 py-1 font-semibold text-texto-oscuro/60">
              {resumen.propias} con tarifa propia
            </span>
          </div>
        </div>

        <div className="flex flex-wrap items-center justify-between gap-2 px-4 py-2">
          <div className="flex flex-wrap gap-1.5">
            {[
              { texto: 'Próximos 7 días', accion: () => {
                const inicio7 = new Date()
                const fin7 = new Date()
                fin7.setDate(inicio7.getDate() + 6)
                aplicarAtajo(iso(inicio7), iso(fin7))
              } },
              { texto: 'Esta semana', accion: () => {
                const semana = finDeSemana(hoy)
                aplicarAtajo(semana.desde, semana.hasta)
              } },
              { texto: 'Mes completo', accion: () => aplicarAtajo(inicioDeMes(mes), finDeMes(mes)) },
              { texto: 'Mes siguiente', accion: () => aplicarAtajo(inicioDeMes(sumarMes(mes, 1)), finDeMes(sumarMes(mes, 1))) },
            ].map((atajo) => (
              <button
                key={atajo.texto}
                type="button"
                onClick={atajo.accion}
                className="rounded-full border border-borde px-2.5 py-1 text-[11px] font-medium text-texto-oscuro/65 transition-colors hover:border-marca/40 hover:bg-marca/[0.04] hover:text-marca"
              >
                {atajo.texto}
              </button>
            ))}
          </div>

          <div className="flex items-center gap-3 text-[11px] text-texto-oscuro/45">
            <span className="flex items-center gap-1">
              <span className="size-2 rounded-full bg-marca/40" /> Tarifa propia
            </span>
            <span className="flex items-center gap-1">
              <span className="size-2 rounded-full bg-acento/50" /> Cerrado
            </span>
            <span className="flex items-center gap-1">
              <span className="size-2 rounded-full border border-borde bg-white" /> Base
            </span>
          </div>
        </div>

        <div className="grid grid-cols-7 border-y border-borde bg-fondo-claro/70 text-[10px] font-semibold uppercase tracking-wide text-texto-oscuro/40">
          {DIAS.map((dia) => (
            <span key={dia} className="px-3 py-2">
              {dia}
            </span>
          ))}
        </div>

        <div className="grid grid-cols-7">
          {celdas.map((fecha, indice) => {
            if (fecha === null) {
              return (
                <span
                  key={`vacio-${indice}`}
                  className={cn(
                    'min-h-[96px] border-b border-r border-borde bg-fondo-claro/30',
                    indice % 7 === 6 && 'border-r-0',
                  )}
                />
              )
            }

            const fila = porFecha.get(fecha)
            const cerradoDia = fila?.isClosed ?? false
            const unidadesDia = fila?.units ?? room.totalUnits
            const tarifaDia = fila?.price ?? room.basePrice
            const enRango = !rangoInvalido && fecha >= desde && fecha <= hasta
            const esHoy = fecha === hoy
            const extremo = fecha === desde || fecha === hasta
            const finDeSemanaDia = [0, 6].includes(new Date(`${fecha}T00:00:00`).getDay())

            return (
              <button
                key={fecha}
                type="button"
                onClick={() => elegirDia(fecha)}
                title={`${fechaLegible(fecha)} · ${unidadesDia} unidades · ${precio.format(tarifaDia)}`}
                className={cn(
                  'group relative flex min-h-[96px] flex-col gap-1 border-b border-r border-borde p-2 text-left transition-colors',
                  indice % 7 === 6 && 'border-r-0',
                  cerradoDia ? 'bg-acento/[0.04]' : finDeSemanaDia ? 'bg-fondo-claro/40' : 'bg-white',
                  enRango && 'bg-marca/[0.15]',
                  extremo && 'ring-1 ring-inset ring-marca/40',
                  'hover:bg-fondo-claro',
                )}
              >
                <span className="flex items-center justify-between">
                  <span
                    className={cn(
                      'flex size-6 items-center justify-center rounded-full text-xs font-semibold',
                      esHoy
                        ? 'bg-acento text-white'
                        : extremo
                          ? 'bg-marca text-fondo-claro'
                          : enRango
                            ? 'text-marca'
                            : 'text-texto-oscuro/70',
                    )}
                  >
                    {Number(fecha.slice(8, 10))}
                  </span>
                  {extremo && !esHoy && <span className="text-[9px] font-bold uppercase text-marca">Fin</span>}
                </span>

                {cerradoDia ? (
                  <span className="rounded-md bg-acento/10 px-1.5 py-1 text-[11px] font-semibold text-acento">
                    Cerrado
                  </span>
                ) : (
                  <span className="flex flex-col gap-1">
                    <span
                      className={cn(
                        'rounded-md px-1.5 py-1 text-[11px] font-bold leading-none',
                        fila ? 'bg-marca/10 text-marca' : 'bg-fondo-claro text-texto-oscuro/70',
                      )}
                    >
                      {precio.format(tarifaDia)}
                    </span>
                    <span className="flex items-center gap-1.5 px-0.5 text-[10px] text-texto-oscuro/45">
                      <span className="h-1 flex-1 overflow-hidden rounded-full bg-borde/60">
                        <span
                          className="block h-full rounded-full bg-marca/45"
                          style={{
                            width: `${Math.max(6, Math.min(100, (unidadesDia / Math.max(1, room.totalUnits)) * 100))}%`,
                          }}
                        />
                      </span>
                      {unidadesDia} u
                    </span>
                  </span>
                )}
              </button>
            )
          })}
        </div>

        <div className="mt-auto flex flex-wrap items-center justify-between gap-3 border-t border-borde bg-fondo-claro/50 px-4 py-2.5 text-xs">
          <span className="text-texto-oscuro/50">
            Haz clic en un día y luego en otro para armar el rango.
          </span>
          <span className="font-semibold text-texto-oscuro/70">
            {rangoInvalido
              ? 'Elige un rango'
              : `${fechaLegible(desde)} al ${fechaLegible(hasta)} · ${noches} ${noches === 1 ? 'noche' : 'noches'}`}
          </span>
        </div>
      </div>
    </div>
  )
}