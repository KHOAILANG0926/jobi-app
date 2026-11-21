// VietMap style 사본 만들기(Lee 2026-11-21, #950·#946 MAP-1): 배포 빌드 직전(vercel-deploy.yml)에 VietMap 원본 style을 받아
// 열쇠 값을 비운 사본을 public/vietmap/styles/<tm|hm>.json에 쓴다. 화면은 이 사본을 먼저 쓰고, 없거나 실패할 때만 원본을 받는다
// (src/components/home/map/vietMapStyle.ts loadVietMapStyle — 판정·변환 함수도 그 파일 한 곳).
// 원본을 못 받으면 저장소에 있는 사본을 그대로 두고 경고만 낸다(배포를 막지 않음 — 화면에는 원본 받기 예비 경로가 있다).
// 열쇠는 출력하지 않는다. 쓰기 전에 사본 안에 열쇠 글자가 남아 있으면 쓰지 않는다.
// 사용: node --experimental-strip-types scripts/ops/vietmap-style-copy.mjs [--env-file .vercel/.env.production.local]
import { existsSync, readFileSync, writeFileSync, mkdirSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { createVietMapStyleUrl, isVietMapStyle, stripStyleKey, STYLE_KINDS, stylePathName, styleCopyPath } from '../../src/components/home/map/vietMapStyle.ts'

const root = join(import.meta.dirname, '..', '..')
const args = process.argv.slice(2)
const envFile = args.includes('--env-file') ? args[args.indexOf('--env-file') + 1] : ''
if (envFile && existsSync(envFile)) process.loadEnvFile(envFile)
const key = (process.env.VITE_VIETMAP_TILEMAP_KEY ?? '').trim()
const SITE = 'https://viecganban.vn/'  // 열쇠가 사이트 주소로 묶여 있을 수 있어(VietMap Console) 운영 사이트를 출처로 보낸다
const ATTEMPTS_MS = [15_000, 20_000]

const warn = (m) => console.log(`::warning title=VietMap 스타일 사본 갱신 실패::${m} — 저장소 사본 그대로`)

async function fetchStyle(url) {
  let last = null
  for (const limit of ATTEMPTS_MS) {
    try {
      const res = await fetch(url, { headers: { Referer: SITE, Origin: SITE.replace(/\/$/, '') }, signal: AbortSignal.timeout(limit) })
      if (!res.ok) throw new Error(`HTTP ${res.status}`)
      return await res.json()
    } catch (error) {
      last = error
      if (/^HTTP \d+$/.test(error?.message ?? '')) break
    }
  }
  throw last ?? new Error('timeout')
}

if (!key) {
  warn('VITE_VIETMAP_TILEMAP_KEY 없음')
} else {
  for (const kind of STYLE_KINDS) {
    const name = stylePathName(kind)
    try {
      const style = await fetchStyle(createVietMapStyleUrl(key, kind))
      if (!isVietMapStyle(style)) throw new Error('style 형식 아님(version 8·sources·layers)')
      const text = JSON.stringify(stripStyleKey(style))
      if (text.includes(key) || text.includes(encodeURIComponent(key))) throw new Error('열쇠가 주소 칸 밖에도 있음 — 쓰지 않음')
      const out = join(root, 'public', styleCopyPath(kind))
      mkdirSync(dirname(out), { recursive: true })
      const before = existsSync(out) ? readFileSync(out, 'utf8') : ''
      writeFileSync(out, text + '\n')
      const tiles = Object.values(style.sources).flatMap((s) => (Array.isArray(s?.tiles) ? s.tiles : [])).map((u) => String(u).replace(/\?.*$/, '').replace(/\/\{z\}.*$/, ''))
      console.log(`VietMap 스타일 사본 ${name}: ${before.trim() === text ? '바뀐 것 없음' : '새로 씀'} (타일 ${[...new Set(tiles)].join(', ')})`)
    } catch (error) {
      warn(`${name}: ${String(error?.message ?? error).replaceAll(key, '***').slice(0, 200)}`)
    }
  }
}
