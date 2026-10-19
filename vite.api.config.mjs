// 서버 함수(api/)용 묶음 빌드 — 2026-10-20: Vercel 서버 함수가 src/의 .ts 파일(확장자 없는 import)을 직접 못 읽어
// api/location-hook·admin-auto-location이 시작부터 실패(FUNCTION_INVOCATION_FAILED)하던 문제를 고친다.
// src 코드를 하나의 .js로 묶어 dist/api-lib/에 둔다(npm 패키지는 묶지 않음).
import { defineConfig } from 'vite'
export default defineConfig({
  publicDir: false,
  build: { ssr: 'api/_lib/auto-location-runtime.mjs', outDir: 'dist/api-lib', emptyOutDir: true, minify: false },
})
