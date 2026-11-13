import { fileURLToPath } from 'node:url';
import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

// https://vite.dev/config/
export default defineConfig(({ mode }) => ({
  plugins: [react()],
  // En modo e2e se reemplaza Clerk por un stub local para que las pruebas de
  // extremo a extremo no dependan de la red ni de claves reales.
  resolve:
    mode === 'e2e'
      ? {
          alias: {
            '@clerk/clerk-react': fileURLToPath(
              new URL('../e2e/soporte/clerk-stub.jsx', import.meta.url)
            )
          }
        }
      : {},
  server: {
    proxy: {
      '/api': 'http://localhost:3000'
    }
  },
  test: {
    environment: 'jsdom',
    globals: true,
    setupFiles: './src/test-utils.jsx'
  }
}));
