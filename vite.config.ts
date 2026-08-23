import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

export default defineConfig({
  plugins: [react()],
  build: {
    rollupOptions: {
      output: {
        manualChunks(id) {
          if (id.includes('node_modules/html2canvas')) return 'html2canvas'
          if (id.includes('node_modules/jspdf')) return 'jspdf'
          return undefined
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
