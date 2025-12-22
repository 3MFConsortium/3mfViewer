import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'
import pkg from './package.json' with { type: 'json' }

// https://vite.dev/config/
export default defineConfig({
  plugins: [react(), tailwindcss()],
  build: {
    chunkSizeWarningLimit: 2000,
  },
  worker: {
    format: 'es',
  },
  logLevel: 'info',
  define: {
    __APP_VERSION__: JSON.stringify(pkg.version),
  },
})
