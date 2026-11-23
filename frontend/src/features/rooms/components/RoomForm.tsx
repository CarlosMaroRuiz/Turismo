import { useState, type FormEvent } from 'react'

import { Button } from '@common/Buttons'
import { FormField } from '@common/components/FormField'
import { inputClass, textareaClass } from '@common/components/FormField/styles'
import type { ApiError } from '@core/http'
import { rango } from '@lib/validation'

import { ROOM_LIMITS } from '../dto/room.dto'
import type { RoomType, RoomTypePayload } from '../dto/room.dto'

interface RoomFormProps {
  /** Habitacion a editar; `null` cuando es un alta. */
  room: RoomType | null
  isSubmitting: boolean
  error: ApiError | null
  onSubmit: (payload: RoomTypePayload) => void
  onCancel: () => void
}

/**
 * Alta y edicion de un tipo de habitacion.
 *
 * Los numeros se capturan como texto y se convierten al enviar, porque un
 * input vacio no es `0`: es "sin dato" y la API lo rechazaria.
 */
export function RoomForm({ room, isSubmitting, error, onSubmit, onCancel }: RoomFormProps) {
  const [nombre, setNombre] = useState(room?.name ?? '')
  const [descripcion, setDescripcion] = useState(room?.description ?? '')
  const [adultos, setAdultos] = useState(String(room?.maxAdults ?? 2))
  const [menores, setMenores] = useState(String(room?.maxChildren ?? 0))
  const [unidades, setUnidades] = useState(String(room?.totalUnits ?? 1))
  const [precio, setPrecio] = useState(room === null ? '' : String(room.basePrice))
  const [amenidades, setAmenidades] = useState((room?.amenities ?? []).join(', '))
  const [imagen, setImagen] = useState(room?.images[0] ?? '')
  const [activa, setActiva] = useState(room?.isActive ?? true)

  const fieldError = (name: string): string | undefined => error?.fieldError(name)

  const enviar = (event: FormEvent<HTMLFormElement>): void => {
    event.preventDefault()

    const lista = amenidades
      .split(',')
      .map((item) => item.trim())
      .filter((item) => item !== '')
      .slice(0, ROOM_LIMITS.amenities)

    onSubmit({
      name: nombre.trim(),
      maxAdults: Number(adultos),
      maxChildren: Number(menores),
      totalUnits: Number(unidades),
      basePrice: Number(precio),
      amenities: lista,
      isActive: activa,
      ...(descripcion.trim() !== '' && { description: descripcion.trim() }),
      images: imagen.trim() === '' ? [] : [imagen.trim()],
    })
  }

  return (
    <form onSubmit={enviar} className="flex flex-col gap-4">
      <FormField
        htmlFor="habitacionNombre"
        label="Nombre"
        required
        hint={`${rango(ROOM_LIMITS.name)}. Por ejemplo: "Suite con vista al mar"`}
        error={fieldError('name')}
      >
        <input
          id="habitacionNombre"
          className={inputClass}
          required
          minLength={ROOM_LIMITS.name.min}
          maxLength={ROOM_LIMITS.name.max}
          value={nombre}
          onChange={(event) => setNombre(event.target.value)}
        />
      </FormField>

      <FormField htmlFor="habitacionDescripcion" label="Descripcion" hint="Opcional">
        <textarea
          id="habitacionDescripcion"
          className={textareaClass}
          maxLength={ROOM_LIMITS.description.max}
          value={descripcion}
          onChange={(event) => setDescripcion(event.target.value)}
        />
      </FormField>

      <div className="grid gap-4 sm:grid-cols-2">
        <FormField htmlFor="habitacionAdultos" label="Adultos" required error={fieldError('maxAdults')}>
          <input
            id="habitacionAdultos"
            type="number"
            inputMode="numeric"
            className={inputClass}
            required
            min={ROOM_LIMITS.adults.min}
            max={ROOM_LIMITS.adults.max}
            value={adultos}
            onChange={(event) => setAdultos(event.target.value)}
          />
        </FormField>

        <FormField htmlFor="habitacionMenores" label="Menores" error={fieldError('maxChildren')}>
          <input
            id="habitacionMenores"
            type="number"
            inputMode="numeric"
            className={inputClass}
            min={ROOM_LIMITS.children.min}
            max={ROOM_LIMITS.children.max}
            value={menores}
            onChange={(event) => setMenores(event.target.value)}
          />
        </FormField>

        <FormField
          htmlFor="habitacionUnidades"
          label="Unidades"
          required
          hint="Cuantas habitaciones de este tipo existen"
          error={fieldError('totalUnits')}
        >
          <input
            id="habitacionUnidades"
            type="number"
            inputMode="numeric"
            className={inputClass}
            required
            min={ROOM_LIMITS.units.min}
            max={ROOM_LIMITS.units.max}
            value={unidades}
            onChange={(event) => setUnidades(event.target.value)}
          />
        </FormField>

        <FormField
          htmlFor="habitacionPrecio"
          label="Precio por noche"
          required
          hint="En pesos mexicanos"
          error={fieldError('basePrice')}
        >
          <input
            id="habitacionPrecio"
            type="number"
            inputMode="decimal"
            step="0.01"
            className={inputClass}
            required
            min={ROOM_LIMITS.price.min}
            max={ROOM_LIMITS.price.max}
            value={precio}
            onChange={(event) => setPrecio(event.target.value)}
          />
        </FormField>
      </div>

      <FormField
        htmlFor="habitacionAmenidades"
        label="Amenidades"
        hint="Separadas por coma. Maximo 30, de 60 caracteres cada una."
        error={fieldError('amenities')}
      >
        <input
          id="habitacionAmenidades"
          className={inputClass}
          value={amenidades}
          onChange={(event) => setAmenidades(event.target.value)}
        />
      </FormField>

      <FormField
        htmlFor="habitacionImagen"
        label="Foto (URL)"
        hint="Opcional. Una URL publica de imagen; 1200x800 se ve mejor."
        error={fieldError('images')}
      >
        <input
          id="habitacionImagen"
          type="url"
          className={inputClass}
          placeholder="https://..."
          value={imagen}
          onChange={(event) => setImagen(event.target.value)}
        />
      </FormField>

      <label className="flex cursor-pointer items-center gap-2 text-sm text-texto-oscuro/80">
        <input
          type="checkbox"
          className="size-4 cursor-pointer accent-acento"
          checked={activa}
          onChange={(event) => setActiva(event.target.checked)}
        />
        Publicar esta habitacion en el catalogo
      </label>

      {error !== null && (
        <p role="alert" className="text-sm text-acento">
          {error.message}
        </p>
      )}

      <div className="mt-2 flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
        <Button type="button" variant="secondary" size="md" onClick={onCancel}>
          Cancelar
        </Button>
        <Button type="submit" size="md" disabled={isSubmitting}>
          {isSubmitting ? 'Guardando...' : room === null ? 'Agregar habitacion' : 'Guardar cambios'}
        </Button>
      </div>
    </form>
  )
}
