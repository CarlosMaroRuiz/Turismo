import type { ReactNode } from 'react'

import { errorClass, hintClass, labelClass } from './styles'

interface FormFieldProps {
  /** `id` del control, para asociar la etiqueta. */
  htmlFor: string
  label: string
  required?: boolean
  /** Texto de ayuda bajo el control. */
  hint?: string
  /** Error del servidor para este campo (viene de `ApiError.fieldError`). */
  error?: string
  children: ReactNode
}

/**
 * Etiqueta, control y error en una sola pieza, para que los formularios
 * largos no repitan la misma estructura en cada campo.
 */
export function FormField({
  htmlFor,
  label,
  required = false,
  hint,
  error,
  children,
}: FormFieldProps) {
  return (
    <div className="flex flex-col gap-1.5">
      <label htmlFor={htmlFor} className={labelClass}>
        {label}
        {required && <span className="ml-0.5 text-acento">*</span>}
      </label>

      {children}

      {error !== undefined ? (
        <p className={errorClass}>{error}</p>
      ) : (
        hint !== undefined && <p className={hintClass}>{hint}</p>
      )}
    </div>
  )
}
