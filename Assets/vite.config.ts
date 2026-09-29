import { defineConfig } from 'vitest/config'
import react from '@vitejs/plugin-react'

// https://vite.dev/config/
export default defineConfig({
  plugins: [react()],
  test: { include: ['src/**/*.test.ts'] },
  server: {
    proxy: { '/api': { target: `http://127.0.0.1:${process.env.API_PORT || '8787'}`, changeOrigin: false } },
  },
  preview: {
    proxy: { '/api': { target: `http://127.0.0.1:${process.env.API_PORT || '8787'}`, changeOrigin: false } },
  },
})
