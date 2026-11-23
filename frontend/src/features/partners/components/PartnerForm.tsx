import { useState, type FormEvent } from 'react'

import { Button } from '@common/Buttons'
import { FormField } from '@common/components/FormField'
import { inputClass, selectClass, textareaClass } from '@common/components/FormField/styles'
import type { ApiError } from '@core/http'
import { EMAIL_MAX, PARTNER_LIMITS, PHONE_HINT, PHONE_LENGTH, PHONE_PATTERN, rango, soloDigitos } from '@lib/validation'

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
 * Lo que se crea es la **cuenta del responsable**: su correo recibe la
 * invitacion, define la contrasena y administra el portal. Por eso se captura
 * una sola vez y se reutiliza como contacto publico del negocio.
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

  const set = <K extends keyof PartnerFormValues>(name: K, value: PartnerFormValues[K]): void => {
    setValues((previous) => ({ ...previous, [name]: value }))
  }

  const handleSubmit = (event: FormEvent<HTMLFormElement>): void => {
    event.preventDefault()

    // El contacto del negocio son los mismos datos del responsable.
    onSubmit({
      ...values,
      contactName: values.ownerName,
      contactEmail: values.ownerEmail,
      contactPhone: values.ownerPhone,
    })
  }

  const fieldError = (name: string): string | undefined => error?.fieldError(name)

  const municipiosHint =
    stateId === ''
      ? 'Elige primero el estado'
      : !cargandoMunicipios && municipios.length === 0
        ? 'Este estado no tiene municipios cargados en la base.'
        : undefined

  const correoInvitacion = values.ownerEmail.trim() || 'la persona responsable'

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

        </div>
      </section>

      <section className="rounded-2xl border border-borde bg-white p-6 shadow-sm">
        <h2 className="mb-1 text-sm font-semibold uppercase tracking-wide text-texto-oscuro/50">
          Responsable de la cuenta
        </h2>
        <p className="mb-4 text-xs text-texto-oscuro/60">
          Es la cuenta que se crea: recibe la invitacion, define su contrasena y administra el
          portal del socio. Estos datos se usan tambien como contacto publico del negocio.
        </p>

        <div className="grid gap-4 sm:grid-cols-2">
          <FormField
            htmlFor="ownerName"
            label="Nombre completo"
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
            label="Correo"
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
            label="Telefono"
            required
            hint={PHONE_HINT}
            error={fieldError('ownerPhone') ?? fieldError('contactPhone')}
          >
            <input
              id="ownerPhone"
              type="tel"
              inputMode="numeric"
              required
              pattern={PHONE_PATTERN}
              maxLength={PHONE_LENGTH}
              title="10 digitos, solo numeros"
              value={values.ownerPhone}
              onChange={(event) => set('ownerPhone', soloDigitos(event.target.value))}
              className={inputClass}
            />
          </FormField>
        </div>
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
