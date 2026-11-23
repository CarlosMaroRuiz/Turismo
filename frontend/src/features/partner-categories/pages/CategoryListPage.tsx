import { useState, type FormEvent } from 'react'

import { Badge } from '@common/components/Badge'
import { Button } from '@common/Buttons'
import { FormField } from '@common/components/FormField'
import { inputClass } from '@common/components/FormField/styles'
import { Modal } from '@common/components/Modal'
import { QueryState } from '@common/components/QueryState'
import { toMessage, useAction } from '@core/http'
import { CATEGORY_LIMITS, SLUG_PATTERN, rango } from '@lib/validation'

import { createPartnerCategory, togglePartnerCategory, usePartnerCategories } from '..'

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
  const [modalAbierto, setModalAbierto] = useState(false)

  const enviar = (event: FormEvent<HTMLFormElement>): void => {
    event.preventDefault()

    void crear
      .execute({ code: code.trim(), name: name.trim() })
      .then(() => {
        setCode('')
        setName('')
        setModalAbierto(false)
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
      <header className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-texto-oscuro">Categorias de socio</h1>
          <p className="mt-1 text-sm text-texto-oscuro/60">
            El codigo define las capacidades del portal: hotel, agency o attraction.
          </p>
        </div>

        <Button
          size="md"
          onClick={() => {
            crear.reset()
            setModalAbierto(true)
          }}
        >
          Agregar categoria
        </Button>
      </header>

      <Modal
        open={modalAbierto}
        title="Nueva categoria"
        description="El codigo define las capacidades del portal y conviene no cambiarlo despues."
        onClose={() => setModalAbierto(false)}
      >
        <form onSubmit={enviar} className="flex flex-col gap-4">
          <FormField
            htmlFor="categoriaCodigo"
            label="Codigo"
            required
            hint={`${rango(CATEGORY_LIMITS.code)}. Minusculas, numeros y guiones.`}
            error={crear.error?.fieldError('code')}
          >
            <input
              id="categoriaCodigo"
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
          </FormField>

          <FormField
            htmlFor="categoriaNombre"
            label="Nombre"
            required
            hint={rango(CATEGORY_LIMITS.name)}
            error={crear.error?.fieldError('name')}
          >
            <input
              id="categoriaNombre"
              type="text"
              required
              minLength={CATEGORY_LIMITS.name.min}
              maxLength={CATEGORY_LIMITS.name.max}
              placeholder="Transportista turistico"
              value={name}
              onChange={(event) => setName(event.target.value)}
              className={inputClass}
            />
          </FormField>

          {crear.error !== null && crear.error.errors === undefined && (
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

      {alternar.error !== null && (
        <p role="alert" className="rounded-lg bg-acento/10 px-4 py-3 text-sm text-acento">
          {toMessage(alternar.error)}
        </p>
      )}

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
