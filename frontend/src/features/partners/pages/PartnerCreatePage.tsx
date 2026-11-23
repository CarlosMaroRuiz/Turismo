import { useState } from 'react'
import { useNavigate } from 'react-router'

import { SkeletonPage } from '@common/SkeletonPage'
import { QueryState } from '@common/components/QueryState'
import { toMessage, useAction } from '@core/http'
import { PATHS } from '@core/routes/types/paths'
import { usePartnerCategories } from '@features/partner-categories'
import { useRegions, useStates } from '@features/regions'

import { createPartner } from '../api'
import { PartnerForm } from '../components/PartnerForm'
import type { PartnerFormValues } from '../components/PartnerForm'
import type { CreatePartnerPayload } from '../dto/partner.dto'

/** Opcional: se omite del cuerpo si el campo quedo vacio. */
function optionalText(value: string): { value?: string } {
  const trimmed = value.trim()
  return trimmed === '' ? {} : { value: trimmed }
}

function optionalNumber(value: string): { value?: number } {
  const trimmed = value.trim()
  if (trimmed === '') {
    return {}
  }
  const parsed = Number(trimmed)
  return Number.isFinite(parsed) ? { value: parsed } : {}
}

/**
 * Alta de socio desde el panel.
 *
 * Usa `POST /partners`, que es la via del administrador: puede crear y
 * aprobar en un paso (`invite`). La categoria es lo que distingue hotel,
 * agencia u operador; no hay formularios separados por tipo.
 */
export default function PartnerCreatePage() {
  const navigate = useNavigate()
  const [stateId, setStateId] = useState('')

  const categorias = usePartnerCategories()
  const estados = useStates()
  const municipios = useRegions(
    {
      type: 'municipality',
      status: 'active',
      limit: 200,
      ...(stateId !== '' && { stateId }),
    },
    stateId !== '',
  )

  const crear = useAction(createPartner)

  const enviar = (values: PartnerFormValues): void => {
    const description = optionalText(values.description)
    const lng = optionalNumber(values.lng)
    const ownerPhone = optionalText(values.ownerPhone)

    const payload: CreatePartnerPayload = {
      categoryId: values.categoryId,
      regionId: values.regionId,
      commercialName: values.commercialName.trim(),
      legalName: values.legalName.trim(),
      address: values.address.trim(),
      contactName: values.contactName.trim(),
      contactEmail: values.contactEmail.trim(),
      contactPhone: values.contactPhone.trim(),
      ownerName: values.ownerName.trim(),
      ownerEmail: values.ownerEmail.trim(),
      invite: values.invite,
      ...(description.value !== undefined && { description: description.value }),
      ...(lng.value !== undefined && { lng: lng.value }),
      ...(ownerPhone.value !== undefined && { ownerPhone: ownerPhone.value }),
    }

    void crear
      .execute(payload)
      .then(() => {
        navigate(PATHS.adminPartners)
      })
      .catch(() => {
        // El error queda en `crear.error` y se pinta en el formulario.
      })
  }

  return (
    <section className="flex flex-col gap-6">
      <header>
        <h1 className="text-2xl font-bold text-texto-oscuro">Nuevo socio</h1>
        <p className="mt-1 text-sm text-texto-oscuro/60">
          Hotel, agencia u operador de atractivos. La categoria define que modulos tendra su portal.
        </p>
      </header>

      {crear.error !== null && crear.error.errors === undefined && (
        <p role="alert" className="rounded-lg bg-acento/10 px-4 py-3 text-sm text-acento">
          {toMessage(crear.error)}
        </p>
      )}

      <QueryState query={categorias} skeleton={<SkeletonPage />}>
        {(listaCategorias) => (
          <QueryState query={estados} skeleton={<SkeletonPage />}>
            {(listaEstados) => (
              <PartnerForm
                categorias={listaCategorias}
                estados={listaEstados}
                municipios={municipios.data?.items ?? []}
                cargandoMunicipios={municipios.isLoading}
                isSubmitting={crear.isLoading}
                error={crear.error}
                onEstadoChange={setStateId}
                onSubmit={enviar}
                onCancel={() => navigate(PATHS.adminPartners)}
              />
            )}
          </QueryState>
        )}
      </QueryState>
    </section>
  )
}
