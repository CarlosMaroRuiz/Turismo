import { cn } from '../../lib/cn'
import { buttonBase, buttonSizes, buttonVariants } from './styles'
import type { ButtonProps } from './type'

/**
 * Botón reutilizable.
 *
 * ```tsx
 * <Button>Guardar</Button>
 * <Button variant="secondary" size="sm">Cancelar</Button>
 * <Button size="xl" fullWidth>Reservar</Button>
 * ```
 */
export function Button({
  variant = 'primary',
  size = 'md',
  fullWidth = false,
  className,
  type = 'button',
  ...props
}: ButtonProps) {
  return (
    <button
      type={type}
      className={cn(
        buttonBase,
        buttonVariants[variant],
        buttonSizes[size],
        fullWidth && 'w-full',
        className,
      )}
      {...props}
    />
  )
}
