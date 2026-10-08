import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'

const rootDir = path.dirname(fileURLToPath(import.meta.url))

export default defineConfig({
  plugins: [react(), tailwindcss()],
  resolve: {
    alias: {
      '@': path.resolve(rootDir, './src'),
    },
    // Prevent dexie-react-hooks / sdk from resolving a second React copy (blank screen).
    dedupe: ['react', 'react-dom'],
  },
  optimizeDeps: {
    include: ['react', 'react-dom', 'dexie-react-hooks', 'dexie'],
  },
  build: {
    target: 'es2020',
  },
  server: {
    port: 5173,
    host: '127.0.0.1',
  },
})
