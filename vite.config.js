import react from '@vitejs/plugin-react'
import { defineConfig } from 'vite'

// https://vite.dev/config/
export default defineConfig({
  plugins: [react()],
  // Puerto fijo: si el 5173 está ocupado avisa en vez de saltar a otro. Cada dirección guarda
  // su propia sesión, y con puertos que cambian te pedía iniciar sesión de nuevo.
  server: { port: 5173, strictPort: true },
})
