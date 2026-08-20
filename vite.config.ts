import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

export default defineConfig({
  plugins: [react()],
  build: {
    rollupOptions: {
      output: {
        manualChunks: {
          html2canvas: ['html2canvas'],
          jspdf: ['jspdf'],
        },
      },
    },
  },
  server: {
    host: true,
    port: process.env.PORT ? Number(process.env.PORT) : 5173,
    strictPort: !!process.env.PORT,
  },
  optimizeDeps: {
    include: ['html2canvas', 'jspdf'],
  },
})
