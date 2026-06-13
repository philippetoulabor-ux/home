import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

const appRoot = path.dirname(fileURLToPath(import.meta.url))

// Monorepo root hoists archive deps (React 18, older three). Home needs its own copies.
function localPkg(name) {
  return path.join(appRoot, 'node_modules', name)
}

// https://vite.dev/config/
export default defineConfig({
  base: '/home/',
  plugins: [react()],
  resolve: {
    dedupe: ['react', 'react-dom', 'three'],
    alias: {
      react: localPkg('react'),
      'react-dom': localPkg('react-dom'),
      three: localPkg('three'),
    },
  },
  server: {
    port: Number(process.env.VITE_DEV_PORT) || 5173,
    strictPort: true,
  },
})
