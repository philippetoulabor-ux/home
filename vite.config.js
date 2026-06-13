import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// https://vite.dev/config/
export default defineConfig({
  base: '/home/',
  plugins: [react()],
  server: {
    port: Number(process.env.VITE_DEV_PORT) || 5173,
    strictPort: true,
  },
})
