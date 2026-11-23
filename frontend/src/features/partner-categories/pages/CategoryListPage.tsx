import { useState, type FormEvent } from 'react'

import { Badge } from '@common/components/Badge'
import { Button } from '@common/Buttons'
import { QueryState } from '@common/components/QueryState'
import { toMessage, useAction } from '@core/http'
import { CATEGORY_LIMITS, SLUG_PATTERN, rango } from '@lib/validation'

import { createPartnerCategory, togglePartnerCategory, usePartnerCategories } from '..'

const inputClass =
  'h-10 w-full rounded-lg border border-borde bg-white px-3 text-texto-oscuro placeholder:text-texto-oscuro/40 focus:border-acento focus:outline-none focus:ring-2 focus:ring-acento/20'

/**
 * Categorias de socio.
 *
 * Se piden con `includeInactive` porque esta pantalla las administra todas.
 * No hay borrado: la API hace baja logica (`DELETE` pone `isActive=false`),
 * asi que la accion visible es activar o desactivar.
 */
export default function CategoryListPage() {
  const categorias = usePartnerCategories(true)
  const crear = useAction(createPartnerCategory)
  const alternar = useAction(togglePartnerCategory)

  const [code, setCode] = useState('')
  const [name, setName] = useState('')

  const enviar = (event: FormEvent<HTMLFormElement>): void => {
    event.preventDefault()

    void crear
      .execute({ code: code.trim(), name: name.trim() })
      .then(() => {
        setCode('')
        setName('')
        return categorias.refetch()
      })
      .catch(() => {
        // El error queda en `crear.error` y se muestra en el formulario.
      })
  }

  const cambiarEstado = (id: string): void => {
    void alternar
      .execute(id)
      .then(() => categorias.refetch())
      .catch(() => {
        // El error queda en `alternar.error`.
      })
  }

  return (
    <section className="flex flex-col gap-6">
      <header>
        <h1 className="text-2xl font-bold text-texto-oscuro">Categorias de socio</h1>
        <p className="mt-1 text-sm text-texto-oscuro/60">
          El codigo define las capacidades del portal: hotel, agency o attraction.
        </p>
      </header>

      <form
        onSubmit={enviar}
        className="grid gap-4 rounded-2xl border border-borde bg-white p-5 shadow-sm sm:grid-cols-[1fr_1.5fr_auto] sm:items-end"
      >
        <label className="flex flex-col gap-1 text-sm">
          <span className="font-medium text-texto-oscuro">Codigo</span>
          <input
            type="text"
            required
            minLength={CATEGORY_LIMITS.code.min}
            maxLength={CATEGORY_LIMITS.code.max}
            pattern={SLUG_PATTERN}
            title="Solo minusculas, numeros y guiones simples"
            placeholder="transportista"
            value={code}
            onChange={(event) => setCode(event.target.value)}
            className={inputClass}
          />
          <span className="text-xs text-texto-oscuro/50">
            {rango(CATEGORY_LIMITS.code)}. Minusculas, numeros y guiones.
          </span>
        </label>

        <label className="flex flex-col gap-1 text-sm">
          <span className="font-medium text-texto-oscuro">Nombre</span>
          <input
            type="text"
            required
            minLength={CATEGORY_LIMITS.name.min}
            maxLength={CATEGORY_LIMITS.name.max}
            placeholder="Transportista turistico"
            value={name}
            onChange={(event) => setName(event.target.value)}
            className={inputClass}
          />
          <span className="text-xs text-texto-oscuro/50">{rango(CATEGORY_LIMITS.name)}.</span>
        </label>

        <Button type="submit" size="md" disabled={crear.isLoading}>
          {crear.isLoading ? 'Creando...' : 'Agregar'}
        </Button>

        {(crear.error !== null || alternar.error !== null) && (
          <p role="alert" className="text-sm text-acento sm:col-span-3">
            {toMessage(crear.error ?? alternar.error)}
          </p>
        )}
      </form>

      <QueryState
        query={categorias}
        isEmpty={(data) => data.length === 0}
        empty="Todavia no hay categorias."
      >
        {(data) => (
          <div className="overflow-x-auto rounded-2xl border border-borde bg-white shadow-sm">
            <table className="w-full min-w-[560px] text-left text-sm">
              <thead className="border-b border-borde text-xs uppercase tracking-wide text-texto-oscuro/50">
                <tr>
                  <th className="px-4 py-3 font-semibold">Codigo</th>
                  <th className="px-4 py-3 font-semibold">Nombre</th>
                  <th className="px-4 py-3 font-semibold">Estado</th>
                  <th className="px-4 py-3 text-right font-semibold">Accion</th>
                </tr>
              </thead>
              <tbody>
                {data.map((categoria) => (
                  <tr key={categoria.id} className="border-b border-borde/60 last:border-0">
                    <td className="px-4 py-3 font-mono text-xs text-texto-oscuro/80">
                      {categoria.code}
                    </td>
                    <td className="px-4 py-3 font-medium text-texto-oscuro">{categoria.name}</td>
                    <td className="px-4 py-3">
                      <Badge tone={categoria.isActive ? 'success' : 'neutral'}>
                        {categoria.isActive ? 'Activa' : 'Inactiva'}
                      </Badge>
                    </td>
                    <td className="px-4 py-3 text-right">
                      <Button
                        variant="secondary"
                        size="sm"
                        disabled={alternar.isLoading}
                        onClick={() => cambiarEstado(categoria.id)}
                      >
                        {categoria.isActive ? 'Desactivar' : 'Activar'}
                      </Button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </QueryState>
    </section>
  )
}
