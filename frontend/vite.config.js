import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// Configuração básica do Vite para suporte ao React
export default defineConfig({
  plugins: [react()],
  server: {
    port: 5173,
    proxy: {
      // Redireciona chamadas /api para o backend Python na porta 8000
      '/api': {
        target: 'http://localhost:8000',
        changeOrigin: true,
      }
    }
  }
})