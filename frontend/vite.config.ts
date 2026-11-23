import react, { reactCompilerPreset } from '@vitejs/plugin-react'
import babel from '@rolldown/plugin-babel'
import { fileURLToPath, URL } from 'node:url'
import { defineConfig } from 'vite'
import tailwindcss from '@tailwindcss/vite'

// https://vite.dev/config/
export default defineConfig({
  plugins: [
    react(),
    babel({ presets: [reactCompilerPreset()] }),
    tailwindcss(),
  ],
  resolve: {
    // Deben coincidir con "paths" de tsconfig.app.json
    alias: {
      '@core': fileURLToPath(new URL('./src/core', import.meta.url)),
      '@common': fileURLToPath(new URL('./src/common', import.meta.url)),
      '@features': fileURLToPath(new URL('./src/features', import.meta.url)),
      '@lib': fileURLToPath(new URL('./src/lib', import.meta.url)),
      '@assets': fileURLToPath(new URL('./src/assets', import.meta.url)),
    },
  },
  server: {
    /**
     * En desarrollo se habla con la API por el mismo origen que sirve Vite,
     * asi el contrato (`servers: [{ url: "/api/v1" }]`) se cumple sin CORS.
     * En produccion lo resuelve el proxy del servidor web.
     */
    proxy: {
      '/api': {
        target: 'http://localhost:3000',
        changeOrigin: true,
      },
    },
  },
})
