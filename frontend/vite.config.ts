import { defineConfig } from 'vite'

export default defineConfig({
  root: '.',
  base: '/chat/',
  build: {
    outDir: '../static',
    emptyOutDir: true,
  },
  server: {
    proxy: {
      '/v1': 'http://localhost:8000',
      '/health': 'http://localhost:8000',
    }
  }
})
