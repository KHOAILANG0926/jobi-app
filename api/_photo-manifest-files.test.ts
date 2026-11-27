import { existsSync, statSync, readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'

// 대표 이미지 목록의 파일 확인(2026-11-27 Lee): 목록에 적힌 파일이 public/images에 실제로 있고, 전송량 상한(Vercel·Supabase 사용량 개선)을 넘지 않는다.
// src 시험은 tsconfig에 node 형식이 없어 파일 시스템을 못 쓰므로 api 시험으로 둔다(photoManifest.test.ts가 나머지 무결성을 본다).
const MAX_BYTES = 300_000
const manifestPath = fileURLToPath(new URL('../data/industry-photos/manifest.json', import.meta.url))
const images = JSON.parse(readFileSync(manifestPath, 'utf8')).images as Array<{ id: string; file: string }>
for (const m of images) {
  const path = fileURLToPath(new URL(`../public${m.file}`, import.meta.url))
  if (!existsSync(path)) throw new Error(`${m.id}: missing file ${m.file}`)
  const size = statSync(path).size
  if (size > MAX_BYTES) throw new Error(`${m.id}: ${m.file} is ${size} bytes (> ${MAX_BYTES}) — resize before adding`)
}
console.log(`photo manifest files: ${images.length} files exist and are within ${MAX_BYTES} bytes`)
