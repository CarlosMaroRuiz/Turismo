/**
 * MySQL devuelve DECIMAL como string; este transformer lo normaliza a number.
 * (Mismo comportamiento que usan las entidades existentes.)
 */
export const decimalTransformer = {
  to: (value?: number | null) => value,
  from: (value?: string | null) =>
    value === null || value === undefined ? null : parseFloat(value),
};
