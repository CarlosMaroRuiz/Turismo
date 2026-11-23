import { useState } from 'react'
import { Link, useParams } from 'react-router'

import { Badge } from '@common/components/Badge'
import { Button } from '@common/Buttons'
import { FormField } from '@common/components/FormField'
import { inputClass, textareaClass } from '@common/components/FormField/styles'
import { QueryState } from '@common/components/QueryState'
import { toMessage, useAction } from '@core/http'
import { PATHS } from '@core/routes/types/paths'
import { formatDate, formatDateTime } from '@lib/format'
import { PHONE_LENGTH, PHONE_PATTERN, soloDigitos } from '@lib/validation'

import { usePartnerCategories } from '@features/partner-categories'
import { useRegion } from '@features/regions'

import {
  addPartnerMember,
  approvePartner,
  reactivatePartner,
  rejectPartner,
  resendMemberInvite,
  resendPartnerInvite,
  suspendPartner,
} from '../api'
import {
  PARTNER_MEMBER_ROLE_LABELS,
  PARTNER_STATUS_LABELS,
  usePartner,
  usePartnerMembers,
} from '..'
import type { AddPartnerMemberPayload, PartnerStatus } from '..'

const REASON_MIN = 10
const REASON_MAX = 255

const STATUS_TONES: Record<PartnerStatus, 'neutral' | 'success' | 'warning' | 'danger'> = {
  pending: 'warning',
  active: 'success',
  suspended: 'danger',
  rejected: 'neutral',
}

type MotivoAccion = 'reject' | 'suspend'

function Dato({ etiqueta, valor }: { etiqueta: string; valor: string }) {
  return (
    <div className="flex flex-col gap-0.5">
      <span className="text-xs uppercase tracking-wide text-texto-oscuro/40">{etiqueta}</span>
      <span className="text-sm text-texto-oscuro">{valor === '' ? '-' : valor}</span>
    </div>
  )
}

/**
 * Detalle del socio.
 *
 * Las acciones dependen del estado: pendiente se aprueba o se rechaza con
 * motivo; activo se suspende con motivo; suspendido se reactiva. El contrato
 * no permite mas transiciones, asi que la UI muestra solo las validas.
 */
export default function PartnerDetailPage() {
  const { id } = useParams()

  const socio = usePartner(id)
  const miembros = usePartnerMembers(id)
  const categorias = usePartnerCategories(true)
  const region = useRegion(socio.data?.regionId)

  const aprobar = useAction(approvePartner)
  const reenviarMiembro = useAction((entrada: { id: string; userId: string }) =>
    resendMemberInvite(entrada.id, entrada.userId),
  )
  const rechazar = useAction((entrada: { id: string; motivo: string }) =>
    rejectPartner(entrada.id, entrada.motivo),
  )
  const suspender = useAction((entrada: { id: string; motivo: string }) =>
    suspendPartner(entrada.id, entrada.motivo),
  )
  const reactivar = useAction(reactivatePartner)
  const reenviar = useAction(resendPartnerInvite)
  const agregarMiembro = useAction(
    (entrada: { id: string; payload: AddPartnerMemberPayload }) =>
      addPartnerMember(entrada.id, entrada.payload),
  )

  const [motivo, setMotivo] = useState('')
  const [accionMotivo, setAccionMotivo] = useState<MotivoAccion | null>(null)

  const [nombreMiembro, setNombreMiembro] = useState('')
  const [correoMiembro, setCorreoMiembro] = useState('')
  const [telefonoMiembro, setTelefonoMiembro] = useState('')

  if (id === undefined) {
    return null
  }

  const refrescar = (): void => {
    void socio.refetch()
    void miembros.refetch()
  }

  const conMotivo = (accion: MotivoAccion): void => {
    setAccionMotivo(accion)
    setMotivo('')
  }

  const confirmarMotivo = (): void => {
    if (accionMotivo === null || socio.data === undefined) {
      return
    }

    const ejecutar = accionMotivo === 'reject' ? rechazar : suspender

    void ejecutar
      .execute({ id, motivo: motivo.trim() })
      .then(() => {
        setAccionMotivo(null)
        setMotivo('')
        refrescar()
      })
      .catch(() => {
        // El error queda en el hook y se muestra en el panel.
      })
  }

  const nombreCategoria = (categoriaId: string): string =>
    categorias.data?.find((categoria) => categoria.id === categoriaId)?.name ?? '-'

  const nombreUbicacion = (): string => {
    if (region.data === undefined) {
      return '-'
    }
    return `${region.data.stateName ?? ''} / ${region.data.name}`
  }

  return (
    <section className="flex flex-col gap-6">
      <div>
        <Link to={PATHS.adminPartners} className="text-sm font-medium text-marca hover:underline">
          Volver a socios
        </Link>
      </div>

      <QueryState query={socio}>
        {(datos) => (
          <>
            <header className="flex flex-wrap items-start justify-between gap-4">
              <div>
                <h1 className="text-2xl font-bold text-texto-oscuro">{datos.commercialName}</h1>
                <p className="mt-1 flex items-center gap-2 text-sm text-texto-oscuro/50">
                  <span className="font-mono text-xs">{datos.slug}</span>
                  <Badge tone={STATUS_TONES[datos.status]}>
                    {PARTNER_STATUS_LABELS[datos.status]}
                  </Badge>
                </p>
              </div>

              <div className="flex flex-wrap gap-2">
                {datos.status === 'pending' && (
                  <>
                    <Button
                      size="sm"
                      disabled={aprobar.isLoading}
                      onClick={() => {
                        void aprobar
                          .execute(id)
                          .then(refrescar)
                          .catch(() => {})
                      }}
                    >
                      {aprobar.isLoading ? 'Aprobando...' : 'Aprobar'}
                    </Button>
                    <Button
                      variant="secondary"
                      size="sm"
                      onClick={() => conMotivo('reject')}
                    >
                      Rechazar
                    </Button>
                    <Button
                      variant="secondary"
                      size="sm"
                      disabled={reenviar.isLoading}
                      onClick={() => {
                        void reenviar
                          .execute(id)
                          .then(refrescar)
                          .catch(() => {})
                      }}
                    >
                      {reenviar.isLoading ? 'Enviando...' : 'Reenviar invitacion'}
                    </Button>
                  </>
                )}

                {datos.status === 'active' && (
                  <Button variant="secondary" size="sm" onClick={() => conMotivo('suspend')}>
                    Suspender
                  </Button>
                )}

                {datos.status === 'suspended' && (
                  <Button
                    size="sm"
                    disabled={reactivar.isLoading}
                    onClick={() => {
                      void reactivar
                        .execute(id)
                        .then(refrescar)
                        .catch(() => {})
                    }}
                  >
                    Reactivar
                  </Button>
                )}
              </div>
            </header>

            {(aprobar.error !== null ||
              reactivar.error !== null ||
              reenviar.error !== null) && (
              <p role="alert" className="rounded-lg bg-acento/10 px-4 py-3 text-sm text-acento">
                {toMessage(aprobar.error ?? reactivar.error ?? reenviar.error)}
              </p>
            )}

            {datos.statusReason !== null && (
              <p className="rounded-lg bg-fondo-claro px-4 py-3 text-sm text-texto-oscuro/70">
                <span className="font-semibold">Motivo registrado:</span> {datos.statusReason}
              </p>
            )}

            {accionMotivo !== null && (
              <div className="flex flex-col gap-3 rounded-2xl border border-borde bg-white p-5">
                <FormField
                  htmlFor="motivo"
                  label={
                    accionMotivo === 'reject'
                      ? 'Motivo del rechazo'
                      : 'Motivo de la suspension'
                  }
                  required
                  hint={`Entre ${REASON_MIN} y ${REASON_MAX} caracteres. Se envia en el correo al socio.`}
                >
                  <textarea
                    id="motivo"
                    className={textareaClass}
                    minLength={REASON_MIN}
                    maxLength={REASON_MAX}
                    value={motivo}
                    onChange={(event) => setMotivo(event.target.value)}
                  />
                </FormField>

                {(rechazar.error !== null || suspender.error !== null) && (
                  <p role="alert" className="text-sm text-acento">
                    {toMessage(rechazar.error ?? suspender.error)}
                  </p>
                )}

                <div className="flex gap-2">
                  <Button
                    size="sm"
                    disabled={motivo.trim().length < REASON_MIN || rechazar.isLoading || suspender.isLoading}
                    onClick={confirmarMotivo}
                  >
                    Confirmar
                  </Button>
                  <Button
                    variant="secondary"
                    size="sm"
                    onClick={() => {
                      setAccionMotivo(null)
                      setMotivo('')
                    }}
                  >
                    Cancelar
                  </Button>
                </div>
              </div>
            )}

            <div className="grid gap-4 rounded-2xl border border-borde bg-white p-6 sm:grid-cols-2 lg:grid-cols-3">
              <Dato etiqueta="Categoria" valor={nombreCategoria(datos.categoryId)} />
              <Dato etiqueta="Razon social" valor={datos.legalName} />
              <Dato etiqueta="Ubicacion" valor={nombreUbicacion()} />
              <Dato etiqueta="Direccion" valor={datos.address} />
              <Dato etiqueta="Alta" valor={formatDate(datos.createdAt)} />
              <Dato etiqueta="Aprobado" valor={formatDateTime(datos.approvedAt)} />
            </div>

            <div className="grid gap-4 rounded-2xl border border-borde bg-white p-6 sm:grid-cols-3">
              <Dato etiqueta="Contacto" valor={datos.contactName} />
              <Dato etiqueta="Correo" valor={datos.contactEmail} />
              <Dato etiqueta="Telefono" valor={datos.contactPhone} />
            </div>

            {datos.description !== null && (
              <div className="rounded-2xl border border-borde bg-white p-6">
                <h2 className="mb-2 text-sm font-semibold uppercase tracking-wide text-texto-oscuro/50">
                  Descripcion
                </h2>
                <p className="text-sm leading-relaxed text-texto-oscuro/80">{datos.description}</p>
              </div>
            )}

            <div className="rounded-2xl border border-borde bg-white">
              <h2 className="border-b border-borde px-6 py-4 text-sm font-semibold uppercase tracking-wide text-texto-oscuro/50">
                Equipo
              </h2>

              <QueryState query={miembros} isEmpty={(lista) => lista.length === 0} empty="Sin miembros.">
                {(lista) => (
                  <table className="w-full text-left text-sm">
                    <thead className="text-xs uppercase tracking-wide text-texto-oscuro/40">
                      <tr>
                        <th className="px-6 py-3 font-semibold">Nombre</th>
                        <th className="px-6 py-3 font-semibold">Correo</th>
                        <th className="px-6 py-3 font-semibold">Rol</th>
                        <th className="px-6 py-3 font-semibold">Estado</th>
                        <th className="px-6 py-3 text-right font-semibold">Acciones</th>
                      </tr>
                    </thead>
                    <tbody>
                      {lista.map((miembro) => (
                        <tr key={miembro.id} className="border-t border-borde/60">
                          <td className="px-6 py-3 font-medium text-texto-oscuro">{miembro.name}</td>
                          <td className="px-6 py-3 text-texto-oscuro/70">{miembro.email}</td>
                          <td className="px-6 py-3 text-texto-oscuro/70">
                            {PARTNER_MEMBER_ROLE_LABELS[miembro.role]}
                          </td>
                          <td className="px-6 py-3">
                            {miembro.userStatus === 'invited' ? (
                              <Badge tone="warning">Sin activar</Badge>
                            ) : (
                              <Badge tone={miembro.isActive ? 'success' : 'neutral'}>
                                {miembro.isActive ? 'Activo' : 'Inactivo'}
                              </Badge>
                            )}
                          </td>
                          <td className="px-6 py-3">
                            <div className="flex items-center justify-end gap-2">
                              {miembro.userStatus === 'invited' && (
                                <Button
                                  variant="secondary"
                                  size="sm"
                                  disabled={reenviarMiembro.isLoading}
                                  onClick={() => {
                                    void reenviarMiembro
                                      .execute({ id, userId: miembro.userId })
                                      .then(() => miembros.refetch())
                                      .catch(() => {})
                                  }}
                                >
                                  Reenviar invitación
                                </Button>
                              )}
                              {miembro.userStatus !== 'invited' &&
                                miembro.mustChangePassword === true && (
                                  <span className="text-xs text-texto-oscuro/50">
                                    Debe cambiar su contrasena
                                  </span>
                                )}
                            </div>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                )}
              </QueryState>

              <form
                className="grid gap-3 border-t border-borde px-6 py-5 sm:grid-cols-[1fr_1fr_1fr_auto] sm:items-end"
                onSubmit={(event) => {
                  event.preventDefault()
                  void agregarMiembro
                    .execute({
                      id,
                      payload: {
                        name: nombreMiembro.trim(),
                        email: correoMiembro.trim(),
                        role: 'owner',
                        ...(telefonoMiembro.trim() !== '' && { phone: telefonoMiembro.trim() }),
                      },
                    })
                    .then(() => {
                      setNombreMiembro('')
                      setCorreoMiembro('')
                      setTelefonoMiembro('')
                      void miembros.refetch()
                    })
                    .catch(() => {})
                }}
              >
                <p className="text-xs text-texto-oscuro/60 sm:col-span-4">
                  El admin solo da de alta responsables. El responsable invita despues a su equipo
                  de colaboradores desde el portal del socio, y tambien puede operar el catalogo.
                </p>

                <FormField htmlFor="miembroNombre" label="Nombre" required>
                  <input
                    id="miembroNombre"
                    className={inputClass}
                    required
                    minLength={2}
                    maxLength={150}
                    value={nombreMiembro}
                    onChange={(event) => setNombreMiembro(event.target.value)}
                  />
                </FormField>

                <FormField htmlFor="miembroCorreo" label="Correo" required>
                  <input
                    id="miembroCorreo"
                    type="email"
                    className={inputClass}
                    required
                    maxLength={150}
                    value={correoMiembro}
                    onChange={(event) => setCorreoMiembro(event.target.value)}
                  />
                </FormField>

                <FormField
                  htmlFor="miembroTelefono"
                  label="Telefono"
                  hint="Opcional. 10 digitos, solo numeros"
                >
                  <input
                    id="miembroTelefono"
                    type="tel"
                    inputMode="numeric"
                    pattern={PHONE_PATTERN}
                    maxLength={PHONE_LENGTH}
                    title="10 digitos, solo numeros"
                    className={inputClass}
                    value={telefonoMiembro}
                    onChange={(event) => setTelefonoMiembro(soloDigitos(event.target.value))}
                  />
                </FormField>

                <Button type="submit" size="md" disabled={agregarMiembro.isLoading}>
                  {agregarMiembro.isLoading ? 'Invitando...' : 'Agregar responsable'}
                </Button>

                {agregarMiembro.error !== null && (
                  <p role="alert" className="text-sm text-acento sm:col-span-4">
                    {toMessage(agregarMiembro.error)}
                  </p>
                )}
              </form>
            </div>
          </>
        )}
      </QueryState>
    </section>
  )
}
