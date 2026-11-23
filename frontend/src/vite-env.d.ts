/// <reference types="vite/client" />

/**
 * Variables de entorno del frontend.
 * Las que empiezan con VITE_ se exponen al bundle (no pongas secretos aquí).
 */
interface ImportMetaEnv {
  /** Base de la API, incluido el prefijo de versión. Ej.: http://localhost:3000/api/v1 */
  readonly VITE_API_URL?: string
}

interface ImportMeta {
  readonly env: ImportMetaEnv
}
