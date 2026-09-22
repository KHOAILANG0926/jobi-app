import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

export default defineConfig(({ isSsrBuild }) => ({
  plugins: [react()],
  build: {
    // api/ssr.js가 실제 해시 파일명을 찾을 수 있게 클라이언트 빌드에만
    // manifest.json을 남긴다(SSR 빌드는 Node에서 직접 import하므로 불필요).
    manifest: !isSsrBuild,
    rollupOptions: isSsrBuild
      ? undefined
      : {
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
}))
