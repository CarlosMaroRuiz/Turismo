import { useState } from 'react'

import { Badge } from '@common/components/Badge'
import { Button } from '@common/Buttons'
import { Modal } from '@common/components/Modal'
import { QueryState } from '@common/components/QueryState'
import { useAction } from '@core/http'

import { createRoomType, updateRoomType, upsertInventory, useMyRoomTypes } from '..'
import { InventoryForm } from '../components/InventoryForm'
import { RoomForm } from '../components/RoomForm'
import type { InventoryRangePayload, RoomType, RoomTypePayload } from '../dto/room.dto'

const precio = new Intl.NumberFormat('es-MX', { style: 'currency', currency: 'MXN' })

type Vista =
  | { tipo: 'alta' }
  | { tipo: 'edicion'; room: RoomType }
  | { tipo: 'inventario'; room: RoomType }
  | null

function capacidad(room: RoomType): string {
  const adultos = `${room.maxAdults} ${room.maxAdults === 1 ? 'adulto' : 'adultos'}`
  if (room.maxChildren === 0) {
    return adultos
  }
  return `${adultos} · ${room.maxChildren} ${room.maxChildren === 1 ? 'menor' : 'menores'}`
}

/**
 * Habitaciones del hotel, en tarjetas con foto.
 *
 * El inventario se carga por rango de fechas: si un dia no tiene fila propia,
 * la API usa las unidades y la tarifa base del tipo.
 */
export default function RoomListPage() {
  const habitaciones = useMyRoomTypes()
  const crear = useAction(createRoomType)
  const actualizar = useAction((entrada: { id: string; payload: RoomTypePayload }) =>
    updateRoomType(entrada.id, entrada.payload),
  )
  const inventario = useAction((entrada: { id: string; payload: InventoryRangePayload }) =>
    upsertInventory(entrada.id, entrada.payload),
  )

  const [vista, setVista] = useState<Vista>(null)
  const cerrar = (): void => setVista(null)

  const guardar = (payload: RoomTypePayload): void => {
    if (vista === null) {
      return
    }

    const listo = (): Promise<void> => {
      cerrar()
      return habitaciones.refetch()
    }

    if (vista.tipo === 'edicion') {
      void actualizar.execute({ id: vista.room.id, payload }).then(listo).catch(() => {})
      return
    }

    void crear.execute(payload).then(listo).catch(() => {})
  }

  const aplicarInventario = (payload: InventoryRangePayload): void => {
    if (vista?.tipo !== 'inventario') {
      return
    }

    void inventario
      .execute({ id: vista.room.id, payload })
      .then(() => {
        cerrar()
        return habitaciones.refetch()
      })
      .catch(() => {})
  }

  const titulo =
    vista?.tipo === 'edicion'
      ? 'Editar habitacion'
      : vista?.tipo === 'inventario'
        ? `Inventario · ${vista.room.name}`
        : 'Nueva habitacion'

  return (
    <section className="flex flex-col gap-5">
      <header className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-texto-oscuro">Habitaciones</h1>
          <p className="mt-1 text-sm text-texto-oscuro/60">
            Define los tipos de habitacion, su capacidad y la tarifa de cada fecha.
          </p>
        </div>

        <Button
          size="md"
          onClick={() => {
            crear.reset()
            setVista({ tipo: 'alta' })
          }}
        >
          Agregar habitacion
        </Button>
      </header>

      <Modal
        open={vista !== null}
        title={titulo}
        size={vista?.tipo === 'inventario' ? 'xl' : 'md'}
        description="El inventario manda sobre el precio base: si una fecha tiene tarifa propia, esa se cobra."
        onClose={cerrar}
      >
        {vista?.tipo === 'inventario' ? (
          <InventoryForm
            room={vista.room}
            isSubmitting={inventario.isLoading}
            error={inventario.error}
            onSubmit={aplicarInventario}
            onCancel={cerrar}
          />
        ) : (
          <RoomForm
            room={vista?.tipo === 'edicion' ? vista.room : null}
            isSubmitting={vista?.tipo === 'edicion' ? actualizar.isLoading : crear.isLoading}
            error={vista?.tipo === 'edicion' ? actualizar.error : crear.error}
            onSubmit={guardar}
            onCancel={cerrar}
          />
        )}
      </Modal>

      <QueryState
        query={habitaciones}
        isEmpty={(pagina) => pagina.items.length === 0}
        empty="Aun no hay habitaciones. Agrega la primera para que el cotizador pueda ofrecerlas."
      >
        {(pagina) => (
          <div className="grid gap-5 sm:grid-cols-2 xl:grid-cols-3">
            {pagina.items.map((room) => (
              <article
                key={room.id}
                className="flex flex-col overflow-hidden rounded-2xl border border-borde bg-white shadow-sm transition-shadow hover:shadow-md"
              >
                <div className="relative aspect-[16/10] bg-fondo-claro">
                  {room.images.length > 0 ? (
                    <img
                      src={room.images[0]}
                      alt={room.name}
                      className="size-full object-cover"
                      loading="lazy"
                    />
                  ) : (
                    <div className="flex size-full items-center justify-center text-xs text-texto-oscuro/30">
                      Sin foto
                    </div>
                  )}
                  <span className="absolute left-3 top-3">
                    <Badge tone={room.isActive ? 'success' : 'neutral'}>
                      {room.isActive ? 'Publicada' : 'Oculta'}
                    </Badge>
                  </span>
                </div>

                <div className="flex flex-1 flex-col gap-3 p-4">
                  <div>
                    <h3 className="font-semibold text-texto-oscuro">{room.name}</h3>
                    <p className="mt-0.5 text-xs text-texto-oscuro/50">{capacidad(room)}</p>
                  </div>

                  <div className="mt-auto flex items-end justify-between gap-3">
                    <div>
                      <p className="text-lg font-bold text-texto-oscuro">
                        {precio.format(room.basePrice)}
                      </p>
                      <p className="text-xs text-texto-oscuro/50">
                        por noche · {room.totalUnits} unidad{room.totalUnits === 1 ? '' : 'es'}
                      </p>
                    </div>

                    <div className="flex gap-2">
                      <Button
                        variant="secondary"
                        size="sm"
                        onClick={() => {
                          actualizar.reset()
                          setVista({ tipo: 'edicion', room })
                        }}
                      >
                        Editar
                      </Button>
                      <Button
                        variant="secondary"
                        size="sm"
                        onClick={() => {
                          inventario.reset()
                          setVista({ tipo: 'inventario', room })
                        }}
                      >
                        Inventario
                      </Button>
                    </div>
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
