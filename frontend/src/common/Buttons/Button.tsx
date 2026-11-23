import { cn } from '../../lib/cn'
import { buttonBase, buttonShapes, buttonSizes, buttonVariants } from './styles'
import type { ButtonProps } from './type'

/**
 * Botón reutilizable.
 *
 * ```tsx
 * <Button>Guardar</Button>
 * <Button variant="secondary" size="sm">Cancelar</Button>
 * <Button size="xl" shape="pill" fullWidth>Reservar</Button>
 * ```
 */
export function Button({
  variant = 'primary',
  size = 'md',
  shape = 'rounded',
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
        buttonShapes[shape],
        buttonVariants[variant],
        buttonSizes[size],
        fullWidth && 'w-full',
        className,
      )}
      {...props}
    />
  )
}
