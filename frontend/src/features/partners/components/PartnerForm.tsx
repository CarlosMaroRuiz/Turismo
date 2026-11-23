import { useState, type FormEvent } from 'react'

import { Button } from '@common/Buttons'
import { FormField } from '@common/components/FormField'
import { inputClass, selectClass, textareaClass } from '@common/components/FormField/styles'
import type { ApiError } from '@core/http'
import { EMAIL_MAX, PARTNER_LIMITS, rango } from '@lib/validation'

import type { PartnerCategory } from '@features/partner-categories'
import type { Region, State } from '@features/regions'

/** Valores del formulario como strings: los numeros se convierten al enviar. */
export interface PartnerFormValues {
  categoryId: string
  regionId: string
  commercialName: string
  legalName: string
  description: string
  address: string
  lng: string
  contactName: string
  contactEmail: string
  contactPhone: string
  ownerName: string
  ownerEmail: string
  ownerPhone: string
  invite: boolean
}

const INITIAL_VALUES: PartnerFormValues = {
  categoryId: '',
  regionId: '',
  commercialName: '',
  legalName: '',
  description: '',
  address: '',
  lng: '',
  contactName: '',
  contactEmail: '',
  contactPhone: '',
  ownerName: '',
  ownerEmail: '',
  ownerPhone: '',
  invite: false,
}

interface PartnerFormProps {
  categorias: PartnerCategory[]
  estados: State[]
  municipios: Region[]
  cargandoMunicipios: boolean
  isSubmitting: boolean
  error: ApiError | null
  /** Se dispara al cambiar el estado, para cargar sus municipios. */
  onEstadoChange: (stateId: string) => void
  onSubmit: (values: PartnerFormValues) => void
  onCancel: () => void
}

/**
 * Alta de socio (hotel, agencia u operador de atractivos).
 *
 * En el caso normal el contacto del negocio y el responsable de la cuenta son
 * la misma persona, asi que se capturan una sola vez y se envian en los dos
 * campos del contrato. Si el responsable es otro (por ejemplo, la
 * administracion central de un grupo), se desmarca la casilla y se captura
 * aparte.
 */
export function PartnerForm({
  categorias,
  estados,
  municipios,
  cargandoMunicipios,
  isSubmitting,
  error,
  onEstadoChange,
  onSubmit,
  onCancel,
}: PartnerFormProps) {
  const [values, setValues] = useState<PartnerFormValues>(INITIAL_VALUES)
  const [stateId, setStateId] = useState('')
  const [responsableDistinto, setResponsableDistinto] = useState(false)

  const set = <K extends keyof PartnerFormValues>(name: K, value: PartnerFormValues[K]): void => {
    setValues((previous) => ({ ...previous, [name]: value }))
  }

  const handleSubmit = (event: FormEvent<HTMLFormElement>): void => {
    event.preventDefault()

    const efectivos: PartnerFormValues = responsableDistinto
      ? values
      : {
          ...values,
          ownerName: values.contactName,
          ownerEmail: values.contactEmail,
          ownerPhone: values.contactPhone,
        }

    onSubmit(efectivos)
  }

  const fieldError = (name: string): string | undefined => error?.fieldError(name)

  const municipiosHint =
    stateId === ''
      ? 'Elige primero el estado'
      : !cargandoMunicipios && municipios.length === 0
        ? 'Este estado no tiene municipios cargados en la base.'
        : undefined

  const correoInvitacion = responsableDistinto
    ? values.ownerEmail.trim() || 'la persona responsable'
    : values.contactEmail.trim() || 'la persona de contacto'

  return (
    <form onSubmit={handleSubmit} className="flex flex-col gap-6">
      <section className="rounded-2xl border border-borde bg-white p-6 shadow-sm">
        <h2 className="mb-4 text-sm font-semibold uppercase tracking-wide text-texto-oscuro/50">
          Datos del negocio
        </h2>

        <div className="grid gap-4 sm:grid-cols-2">
          <FormField htmlFor="categoryId" label="Categoria" required error={fieldError('categoryId')}>
            <select
              id="categoryId"
              required
              value={values.categoryId}
              onChange={(event) => set('categoryId', event.target.value)}
              className={selectClass}
            >
              <option value="">Selecciona una categoria</option>
              {categorias.map((categoria) => (
                <option key={categoria.id} value={categoria.id}>
                  {categoria.name}
                </option>
              ))}
            </select>
          </FormField>

          <FormField
            htmlFor="commercialName"
            label="Nombre comercial"
            required
            hint={rango(PARTNER_LIMITS.commercialName)}
            error={fieldError('commercialName')}
          >
            <input
              id="commercialName"
              type="text"
              required
              minLength={PARTNER_LIMITS.commercialName.min}
              maxLength={PARTNER_LIMITS.commercialName.max}
              value={values.commercialName}
              onChange={(event) => set('commercialName', event.target.value)}
              className={inputClass}
            />
          </FormField>

          <FormField
            htmlFor="legalName"
            label="Razon social"
            required
            hint={rango(PARTNER_LIMITS.legalName)}
            error={fieldError('legalName')}
          >
            <input
              id="legalName"
              type="text"
              required
              minLength={PARTNER_LIMITS.legalName.min}
              maxLength={PARTNER_LIMITS.legalName.max}
              value={values.legalName}
              onChange={(event) => set('legalName', event.target.value)}
              className={inputClass}
            />
          </FormField>

          <div className="sm:col-span-2">
            <FormField
              htmlFor="description"
              label="Descripcion"
              hint={`Opcional. ${rango(PARTNER_LIMITS.description)} (${values.description.length}/${PARTNER_LIMITS.description.max})`}
              error={fieldError('description')}
            >
              <textarea
                id="description"
                maxLength={PARTNER_LIMITS.description.max}
                value={values.description}
                onChange={(event) => set('description', event.target.value)}
                className={textareaClass}
              />
            </FormField>
          </div>
        </div>
      </section>

      <section className="rounded-2xl border border-borde bg-white p-6 shadow-sm">
        <h2 className="mb-4 text-sm font-semibold uppercase tracking-wide text-texto-oscuro/50">
          Ubicacion
        </h2>

        <div className="grid gap-4 sm:grid-cols-2">
          <FormField htmlFor="stateId" label="Estado" required error={fieldError('stateId')}>
            <select
              id="stateId"
              required
              value={stateId}
              onChange={(event) => {
                setStateId(event.target.value)
                set('regionId', '')
                onEstadoChange(event.target.value)
              }}
              className={selectClass}
            >
              <option value="">Selecciona un estado</option>
              {estados.map((estado) => (
                <option key={estado.id} value={estado.id}>
                  {estado.name}
                </option>
              ))}
            </select>
          </FormField>

          <FormField
            htmlFor="regionId"
            label="Municipio"
            required
            hint={municipiosHint}
            error={fieldError('regionId')}
          >
            <select
              id="regionId"
              required
              disabled={stateId === '' || cargandoMunicipios}
              value={values.regionId}
              onChange={(event) => set('regionId', event.target.value)}
              className={selectClass}
            >
              <option value="">
                {cargandoMunicipios ? 'Cargando...' : 'Selecciona un municipio'}
              </option>
              {municipios.map((municipio) => (
                <option key={municipio.id} value={municipio.id}>
                  {municipio.name}
                </option>
              ))}
            </select>
          </FormField>

          <div className="sm:col-span-2">
            <FormField
              htmlFor="address"
              label="Direccion"
              required
              hint={rango(PARTNER_LIMITS.address)}
              error={fieldError('address')}
            >
              <input
                id="address"
                type="text"
                required
                minLength={PARTNER_LIMITS.address.min}
                maxLength={PARTNER_LIMITS.address.max}
                value={values.address}
                onChange={(event) => set('address', event.target.value)}
                className={inputClass}
              />
            </FormField>
          </div>

          <FormField
            htmlFor="lng"
            label="Longitud"
            hint="Opcional. Entre -180 y 180."
            error={fieldError('lng')}
          >
            <input
              id="lng"
              type="number"
              step="any"
              min={-180}
              max={180}
              value={values.lng}
              onChange={(event) => set('lng', event.target.value)}
              className={inputClass}
            />
          </FormField>
        </div>
      </section>

      <section className="rounded-2xl border border-borde bg-white p-6 shadow-sm">
        <h2 className="mb-1 text-sm font-semibold uppercase tracking-wide text-texto-oscuro/50">
          Contacto y responsable
        </h2>
        <p className="mb-4 text-xs text-texto-oscuro/60">
          Esta persona es la misma en los tres lados: el contacto del negocio, quien recibe el
          correo y quien administra el portal del socio.
        </p>

        <div className="grid gap-4 sm:grid-cols-2">
          <FormField
            htmlFor="contactName"
            label="Nombre"
            required
            hint={rango(PARTNER_LIMITS.contactName)}
            error={fieldError('contactName')}
          >
            <input
              id="contactName"
              type="text"
              required
              minLength={PARTNER_LIMITS.contactName.min}
              maxLength={PARTNER_LIMITS.contactName.max}
              value={values.contactName}
              onChange={(event) => set('contactName', event.target.value)}
              className={inputClass}
            />
          </FormField>

          <FormField
            htmlFor="contactEmail"
            label="Correo"
            required
            hint={`Hasta ${EMAIL_MAX} caracteres. Aqui llega la invitacion.`}
            error={fieldError('contactEmail')}
          >
            <input
              id="contactEmail"
              type="email"
              required
              maxLength={EMAIL_MAX}
              autoComplete="email"
              value={values.contactEmail}
              onChange={(event) => set('contactEmail', event.target.value)}
              className={inputClass}
            />
          </FormField>

          <FormField
            htmlFor="contactPhone"
            label="Telefono"
            required
            hint={rango(PARTNER_LIMITS.contactPhone)}
            error={fieldError('contactPhone')}
          >
            <input
              id="contactPhone"
              type="tel"
              required
              minLength={PARTNER_LIMITS.contactPhone.min}
              maxLength={PARTNER_LIMITS.contactPhone.max}
              value={values.contactPhone}
              onChange={(event) => set('contactPhone', event.target.value)}
              className={inputClass}
            />
          </FormField>
        </div>

        <label className="mt-4 flex cursor-pointer items-start gap-2 text-sm text-texto-oscuro/80">
          <input
            type="checkbox"
            checked={responsableDistinto}
            onChange={(event) => setResponsableDistinto(event.target.checked)}
            className="mt-0.5 size-4 cursor-pointer accent-acento"
          />
          <span>
            El responsable de la cuenta es otra persona
            <span className="mt-0.5 block text-xs text-texto-oscuro/50">
              Por ejemplo, la administracion central de un grupo hotelero.
            </span>
          </span>
        </label>

        {responsableDistinto && (
          <div className="mt-5 grid gap-4 border-t border-borde pt-5 sm:grid-cols-2">
            <FormField
              htmlFor="ownerName"
              label="Nombre del responsable"
              required
              hint={rango(PARTNER_LIMITS.ownerName)}
              error={fieldError('ownerName')}
            >
              <input
                id="ownerName"
                type="text"
                required
                minLength={PARTNER_LIMITS.ownerName.min}
                maxLength={PARTNER_LIMITS.ownerName.max}
                value={values.ownerName}
                onChange={(event) => set('ownerName', event.target.value)}
                className={inputClass}
              />
            </FormField>

            <FormField
              htmlFor="ownerEmail"
              label="Correo del responsable"
              required
              hint={`Hasta ${EMAIL_MAX} caracteres. Aqui llega la invitacion.`}
              error={fieldError('ownerEmail')}
            >
              <input
                id="ownerEmail"
                type="email"
                required
                maxLength={EMAIL_MAX}
                autoComplete="email"
                value={values.ownerEmail}
                onChange={(event) => set('ownerEmail', event.target.value)}
                className={inputClass}
              />
            </FormField>

            <FormField
              htmlFor="ownerPhone"
              label="Telefono del responsable"
              hint={`Opcional. ${rango(PARTNER_LIMITS.ownerPhone)}`}
              error={fieldError('ownerPhone')}
            >
              <input
                id="ownerPhone"
                type="tel"
                minLength={PARTNER_LIMITS.ownerPhone.min}
                maxLength={PARTNER_LIMITS.ownerPhone.max}
                value={values.ownerPhone}
                onChange={(event) => set('ownerPhone', event.target.value)}
                className={inputClass}
              />
            </FormField>
          </div>
        )}
      </section>

      <section className="rounded-2xl border border-marca/30 bg-marca/5 p-6">
        <h2 className="mb-1 text-sm font-semibold uppercase tracking-wide text-marca">
          Invitacion
        </h2>
        <p className="mb-4 text-xs text-texto-oscuro/60">
          El correo de activacion se enviara a <strong>{correoInvitacion}</strong>.
        </p>

        <label className="flex cursor-pointer items-start gap-3">
          <input
            type="checkbox"
            checked={values.invite}
            onChange={(event) => set('invite', event.target.checked)}
            className="mt-0.5 size-4 cursor-pointer accent-acento"
          />
          <span className="text-sm">
            <span className="font-medium text-texto-oscuro">
              Aprobar y enviar la invitacion ahora
            </span>
            <span className="mt-0.5 block text-xs text-texto-oscuro/60">
              Sin esta opcion el socio queda en pendiente y el correo se envia al aprobarlo desde
              el detalle.
            </span>
          </span>
        </label>
      </section>

      <div className="flex flex-wrap items-center gap-3">
        <Button type="submit" size="md" disabled={isSubmitting}>
          {isSubmitting ? 'Creando...' : 'Crear socio'}
        </Button>
        <Button type="button" variant="secondary" size="md" onClick={onCancel}>
          Cancelar
        </Button>
      </div>
    </form>
  )
}
