import { useState, type FormEvent } from 'react'

import { Badge } from '@common/components/Badge'
import { Button } from '@common/Buttons'
import { FormField } from '@common/components/FormField'
import { inputClass } from '@common/components/FormField/styles'
import { QueryState } from '@common/components/QueryState'
import { sessionStore, toMessage, useAction } from '@core/http'
import { PHONE_LENGTH, PHONE_PATTERN, soloDigitos } from '@lib/validation'
import { PARTNER_MEMBER_ROLE_LABELS, addPartnerMember, usePartnerMembers } from '@features/partners'

/**
 * Equipo del socio.
 *
 * El responsable agrega aqui a los colaboradores que operan el catalogo.
 * Los responsables los da de alta la plataforma, no este formulario: por eso
 * el rol se envia fijo como `staff`.
 */
export default function TeamPage() {
  const session = sessionStore.get()
  const partnerId = session?.user.partner?.id

  const miembros = usePartnerMembers(partnerId)
  const agregar = useAction(
    (entrada: { id: string; payload: { name: string; email: string; phone?: string } }) =>
      addPartnerMember(entrada.id, { ...entrada.payload, role: 'staff' }),
  )

  const [nombre, setNombre] = useState('')
  const [correo, setCorreo] = useState('')
  const [telefono, setTelefono] = useState('')

  const soloResponsable = session?.user.partner?.role === 'owner'

  if (partnerId === undefined) {
    return null
  }

  const enviar = (event: FormEvent<HTMLFormElement>): void => {
    event.preventDefault()

    void agregar
      .execute({
        id: partnerId,
        payload: {
          name: nombre.trim(),
          email: correo.trim(),
          ...(telefono.trim() !== '' && { phone: telefono.trim() }),
        },
      })
      .then(() => {
        setNombre('')
        setCorreo('')
        setTelefono('')
        return miembros.refetch()
      })
      .catch(() => {
        // El error queda en `agregar.error` y se muestra en el formulario.
      })
  }

  return (
    <section className="flex flex-col gap-5">
      <header>
        <h1 className="text-2xl font-bold text-texto-oscuro">Equipo</h1>
        <p className="mt-1 text-sm text-texto-oscuro/60">
          Los colaboradores pueden cargar el catalogo, pero no editar la ficha del negocio ni
          administrar al equipo.
        </p>
      </header>

      <div className="overflow-hidden rounded-2xl border border-borde bg-white shadow-sm">
        <QueryState
          query={miembros}
          isEmpty={(lista) => lista.length === 0}
          empty="Todavia no hay miembros en el equipo."
        >
          {(lista) => (
            <table className="w-full text-left text-sm">
              <thead className="text-xs uppercase tracking-wide text-texto-oscuro/40">
                <tr>
                  <th className="px-5 py-3 font-semibold">Nombre</th>
                  <th className="px-5 py-3 font-semibold">Correo</th>
                  <th className="px-5 py-3 font-semibold">Rol</th>
                  <th className="px-5 py-3 font-semibold">Estado</th>
                </tr>
              </thead>
              <tbody>
                {lista.map((miembro) => (
                  <tr key={miembro.id} className="border-t border-borde/60">
                    <td className="px-5 py-3 font-medium text-texto-oscuro">{miembro.name}</td>
                    <td className="px-5 py-3 text-texto-oscuro/70">{miembro.email}</td>
                    <td className="px-5 py-3 text-texto-oscuro/70">
                      {PARTNER_MEMBER_ROLE_LABELS[miembro.role]}
                    </td>
                    <td className="px-5 py-3">
                      <Badge tone={miembro.isActive ? 'success' : 'neutral'}>
                        {miembro.isActive ? 'Activo' : 'Inactivo'}
                      </Badge>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </QueryState>

        {soloResponsable ? (
          <form
            className="grid gap-3 border-t border-borde px-5 py-5 sm:grid-cols-[1fr_1fr_1fr_auto] sm:items-end"
            onSubmit={enviar}
          >
            <p className="text-xs text-texto-oscuro/60 sm:col-span-4">
              El colaborador recibe un correo para activar su cuenta y entra con el rol de
              colaborador.
            </p>

            <FormField htmlFor="nuevoNombre" label="Nombre" required>
              <input
                id="nuevoNombre"
                className={inputClass}
                required
                minLength={2}
                maxLength={150}
                value={nombre}
                onChange={(event) => setNombre(event.target.value)}
              />
            </FormField>

            <FormField htmlFor="nuevoCorreo" label="Correo" required>
              <input
                id="nuevoCorreo"
                type="email"
                className={inputClass}
                required
                maxLength={150}
                value={correo}
                onChange={(event) => setCorreo(event.target.value)}
              />
            </FormField>

            <FormField htmlFor="nuevoTelefono" label="Telefono" hint="Opcional. 10 digitos, solo numeros">
              <input
                id="nuevoTelefono"
                type="tel"
                inputMode="numeric"
                pattern={PHONE_PATTERN}
                maxLength={PHONE_LENGTH}
                title="10 digitos, solo numeros"
                className={inputClass}
                value={telefono}
                onChange={(event) => setTelefono(soloDigitos(event.target.value))}
              />
            </FormField>

            <Button type="submit" size="md" disabled={agregar.isLoading}>
              {agregar.isLoading ? 'Invitando...' : 'Invitar colaborador'}
            </Button>

            {agregar.error !== null && (
              <p role="alert" className="text-sm text-acento sm:col-span-4">
                {toMessage(agregar.error)}
              </p>
            )}
          </form>
        ) : (
          <p className="border-t border-borde px-5 py-4 text-sm text-texto-oscuro/60">
            Solo el responsable del socio puede invitar a nuevos colaboradores.
          </p>
        )}
      </div>
    </section>
  )
}
