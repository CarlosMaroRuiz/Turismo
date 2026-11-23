import { useState, type FormEvent } from 'react'

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

const DIAS = ['L', 'M', 'M', 'J', 'V', 'S', 'D']

function hoyIso(): string {
  const fecha = new Date()
  const mes = String(fecha.getMonth() + 1).padStart(2, '0')
  const dia = String(fecha.getDate()).padStart(2, '0')
  return `${fecha.getFullYear()}-${mes}-${dia}`
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

/**
 * Inventario en calendario.
 *
 * Cada dia muestra sus unidades y tarifa; los cerrados van en rosa y los que
 * no tienen fila propia se ven en blanco (usan la tarifa base del tipo).
 * Al hacer clic se arma el rango sobre el que se aplican los valores.
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

  const porFecha = new Map<string, InventoryDay>()
  for (const dia of dias.data ?? []) {
    porFecha.set(dia.date, dia)
  }

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
    <div className="grid gap-5 md:grid-cols-[minmax(0,280px)_minmax(0,1fr)]">
      <form onSubmit={enviar} className="flex flex-col gap-4">
        <div className="flex flex-col gap-4">
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
            error={rangoInvalido ? 'La fecha final debe ser igual o posterior.' : undefined}
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
        </div>

        <label className="flex cursor-pointer items-center gap-2 text-sm text-texto-oscuro/80">
          <input
            type="checkbox"
            className="size-4 cursor-pointer accent-acento"
            checked={cerrado}
            onChange={(event) => setCerrado(event.target.checked)}
          />
          Cerrar estas fechas (no se pueden reservar)
        </label>

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

      <div className="rounded-xl border border-borde">
        <div className="flex flex-wrap items-center justify-between gap-2 border-b border-borde px-4 py-2.5">
          <div className="flex items-center gap-1">
            <button
              type="button"
              onClick={() => setMes(sumarMes(mes, -1))}
              className="rounded-lg px-2 py-1 text-sm text-texto-oscuro/60 hover:bg-fondo-claro"
              aria-label="Mes anterior"
            >
              ←
            </button>
            <span className="text-sm font-semibold text-texto-oscuro">{nombreMes(mes)}</span>
            <button
              type="button"
              onClick={() => setMes(sumarMes(mes, 1))}
              className="rounded-lg px-2 py-1 text-sm text-texto-oscuro/60 hover:bg-fondo-claro"
              aria-label="Mes siguiente"
            >
              →
            </button>
          </div>

          <div className="flex flex-wrap items-center gap-3 text-xs text-texto-oscuro/50">
            <span className="flex items-center gap-1">
              <span className="size-2.5 rounded-sm border border-marca/20 bg-marca/5" /> Tarifa
              propia
            </span>
            <span className="flex items-center gap-1">
              <span className="size-2.5 rounded-sm border border-acento/30 bg-acento/10" /> Cerrado
            </span>
            <span className="flex items-center gap-1">
              <span className="size-2.5 rounded-sm border border-borde bg-white" /> Usa la base
            </span>
          </div>
        </div>

        <div className="grid grid-cols-7 gap-1 px-3 pb-1 pt-2 text-center text-[11px] font-semibold uppercase text-texto-oscuro/35">
          {DIAS.map((dia, indice) => (
            <span key={`${dia}-${indice}`}>{dia}</span>
          ))}
        </div>

        <div className="grid grid-cols-7 gap-1 p-3 pt-1">
          {celdas.map((fecha, indice) => {
            if (fecha === null) {
              return <span key={`vacio-${indice}`} />
            }

            const fila = porFecha.get(fecha)
            const cerradoDia = fila?.isClosed ?? false
            const unidadesDia = fila?.units ?? room.totalUnits
            const tarifaDia = fila?.price ?? room.basePrice
            const enRango = fecha >= desde && fecha <= hasta
            const esHoy = fecha === hoy

            return (
              <button
                key={fecha}
                type="button"
                onClick={() => elegirDia(fecha)}
                className={cn(
                  'flex flex-col items-start gap-0.5 rounded-lg border p-1.5 text-left transition-colors',
                  cerradoDia
                    ? 'border-acento/30 bg-acento/5 text-acento'
                    : fila
                      ? 'border-marca/20 bg-marca/5 text-texto-oscuro'
                      : 'border-borde bg-white text-texto-oscuro',
                  enRango && 'ring-2 ring-marca/50',
                  esHoy && 'font-bold',
                )}
              >
                <span className="text-xs">{Number(fecha.slice(8, 10))}</span>
                <span className="text-[10px] leading-tight opacity-70">{unidadesDia} u</span>
                <span className="text-[10px] leading-tight opacity-70">{precio.format(tarifaDia)}</span>
              </button>
            )
          })}
        </div>

        <p className="border-t border-borde px-4 py-2 text-xs text-texto-oscuro/50">
          Haz clic en los dias para armar el rango. Del <strong>{desde}</strong> al{' '}
          <strong>{hasta}</strong>.
        </p>
      </div>
    </div>
  )
}
