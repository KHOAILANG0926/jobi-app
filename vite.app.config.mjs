// 앱(app.html)만 따로 빌드하는 설정 — 웹 화면 코드 없이 앱이 단독으로 빌드되는지 확인하는 용도.
//   npx vite build -c vite.app.config.mjs   → dist-app/ (배포에는 쓰지 않는다. 독립 배포는 나중, 설계안 '빌드·배포')
import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

export default defineConfig({
  plugins: [react()],
  build: {
    outDir: 'dist-app',
    emptyOutDir: true,
    rollupOptions: { input: { app: 'app.html' } },
  },
})
