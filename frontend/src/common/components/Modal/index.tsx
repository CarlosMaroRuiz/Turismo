import { useEffect, useRef, type ReactNode } from 'react'
import { createPortal } from 'react-dom'

import { cn } from '@lib/cn'

type ModalSize = 'md' | 'lg' | 'xl' | '2xl'

const TAMANOS: Record<ModalSize, string> = {
  md: 'max-w-lg',
  lg: 'max-w-2xl',
  xl: 'max-w-4xl',
  '2xl': 'max-w-6xl',
}

interface ModalProps {
  open: boolean
  title: string
  description?: string
  /** Ancho del dialogo: `md` 512px, `lg` 672px, `xl` 896px, `2xl` 1152px. */
  size?: ModalSize
  /** Se llama al cerrar con la X, con Escape o con clic fuera. */
  onClose: () => void
  children: ReactNode
}

/**
 * Modal basico sobre un portal.
 *
 * Cubre lo que se espera de un dialogo: fondo que bloquea la pagina, Escape
 * para cerrar, foco inicial en el primer control y bloqueo del scroll de
 * fondo mientras esta abierto.
 */
export function Modal({ open, title, description, size = 'md', onClose, children }: ModalProps) {
  const panelRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (!open) {
      return
    }

    const alPresionar = (event: KeyboardEvent): void => {
      if (event.key === 'Escape') {
        onClose()
      }
    }

    const overflowPrevio = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    document.addEventListener('keydown', alPresionar)

    return () => {
      document.removeEventListener('keydown', alPresionar)
      document.body.style.overflow = overflowPrevio
    }
  }, [open, onClose])

  useEffect(() => {
    if (!open) {
      return
    }
    const primero = panelRef.current?.querySelector<HTMLElement>(
      'input:not([type=hidden]), select, textarea',
    )
    primero?.focus()
  }, [open])

  if (!open) {
    return null
  }

  return createPortal(
    <div className="fixed inset-0 z-50 flex items-start justify-center overflow-y-auto p-4 sm:items-center">
      <div
        className="absolute inset-0 bg-oscuro-base/50"
        onClick={onClose}
        aria-hidden="true"
      />

      <div
        ref={panelRef}
        role="dialog"
        aria-modal="true"
        aria-label={title}
        className={cn('relative my-8 w-full overflow-hidden rounded-2xl bg-white shadow-xl', TAMANOS[size])}
      >
        <header className="flex items-start justify-between gap-4 border-b border-borde px-6 py-4">
          <div>
            <h2 className="text-lg font-bold text-texto-oscuro">{title}</h2>
            {description !== undefined && (
              <p className="mt-1 text-xs text-texto-oscuro/60">{description}</p>
            )}
          </div>

          <button
            type="button"
            onClick={onClose}
            aria-label="Cerrar"
            className="rounded-lg px-2 py-0.5 text-xl leading-none text-texto-oscuro/40 transition-colors hover:bg-fondo-claro hover:text-texto-oscuro"
          >
            x
          </button>
        </header>

        <div className="px-6 py-5">{children}</div>
      </div>
    </div>,
    document.body,
  )
}
