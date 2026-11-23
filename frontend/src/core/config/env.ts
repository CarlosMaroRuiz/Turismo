/**
 * Configuración del entorno del frontend.
 *
 * Único lugar donde se lee `import.meta.env`, para que una variable mal
 * escrita falle con un mensaje claro en vez de producir URLs raras.
 */

const RAW_API_URL: string | undefined = import.meta.env.VITE_API_URL

/**
 * Base de la API, incluido el prefijo de versión del contrato
 * (`servers: [{ url: "/api/v1" }]`).
 */
export const API_URL: string = (RAW_API_URL ?? '/api/v1').replace(/\/+$/, '')

if (API_URL === '') {
  throw new Error(
    'VITE_API_URL está vacía. Define la base de la API, por ejemplo http://localhost:3000/api/v1',
  )
}
