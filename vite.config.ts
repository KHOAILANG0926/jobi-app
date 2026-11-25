import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import type { Plugin } from 'vite'

// 앱(/app)은 별도 입구(app.html)다. 배포(vercel.json)와 같은 규칙을 개발·미리보기 서버에도 적용한다.
const APP_PATH = /^\/app(?:\/|$)/
function appEntryRewrite(): Plugin {
  const rewrite = (req: { url?: string }, _res: unknown, next: () => void) => {
    const url = req.url ?? ''
    const pathname = url.split('?')[0]
    if (APP_PATH.test(pathname)) req.url = '/app.html' + url.slice(pathname.length)
    next()
  }
  return {
    name: 'jobi-app-entry-rewrite',
    configureServer(server) { server.middlewares.use(rewrite) },
    configurePreviewServer(server) { server.middlewares.use(rewrite) },
  }
}

export default defineConfig(({ isSsrBuild }) => ({
  plugins: [react(), appEntryRewrite()],
  define: {
    // Map acceptance records are opt-in and never enabled in a Production build.
    'import.meta.env.VITE_MAP_ACCEPTANCE': JSON.stringify(process.env.VERCEL_ENV === 'preview' ? 'true' : 'false'),
  },
  build: {
    // api/ssr.js가 실제 해시 파일명을 찾을 수 있게 클라이언트 빌드에만
    // manifest.json을 남긴다(SSR 빌드는 Node에서 직접 import하므로 불필요).
    manifest: !isSsrBuild,
    rollupOptions: isSsrBuild
      ? undefined
      : {
          // 웹(index.html)과 앱(app.html) 두 입구. 앱은 src/app만 불러온다(경계 검사: src/app/boundary.test.ts).
          input: { main: 'index.html', app: 'app.html' },
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
