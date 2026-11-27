import manifest from '../../data/industry-photos/manifest.json' with { type: 'json' }
import { managedPhoto } from './cardPhoto.ts'

// node:fs·crypto는 src/ tsconfig(브라우저 타입)에 타입이 없어 동적 import로 불러온다(jobAlerts.test.ts와 같은 방식).
const load = (name: string) => import(/* @vite-ignore */ 'node:' + name)
const { readFileSync, existsSync } = (await load('fs')) as { readFileSync: (p: URL) => Uint8Array; existsSync: (p: URL) => boolean }
const { createHash } = (await load('crypto')) as { createHash: (a: string) => { update: (b: Uint8Array) => { digest: (e: string) => string } } }

// 이미지 목록(manifest.json) 무결성: 파일이 있고, 등록된 sha256이 실제와 같고, id·그림이 중복되지 않는다(#1180 이미지 관리, 2026-11-27).
const eq = (a: unknown, b: unknown, note: string) => { if (JSON.stringify(a) !== JSON.stringify(b)) throw new Error(`${note}: ${JSON.stringify(a)} !== ${JSON.stringify(b)}`) }
const images = (manifest as { images: { id: string; file: string; group: string; role?: string; environment?: string; kind: string; sha256?: string }[] }).images
eq(new Set(images.map((m) => m.id)).size, images.length, 'ids are unique')
eq(new Set(images.map((m) => m.file)).size, images.length, 'files are unique')
const hashes = images.map((m) => m.sha256).filter(Boolean)
eq(new Set(hashes).size, hashes.length, 'no duplicate picture')
for (const m of images) {
  const path = new URL(`../../public${m.file}`, import.meta.url)
  eq(existsSync(path), true, `${m.id} file exists`)
  if (m.sha256) eq(createHash('sha256').update(readFileSync(path)).digest('hex'), m.sha256, `${m.id} sha256`)
  if (m.sha256) { eq(!!m.role && !!m.environment, true, `${m.id} keeps role+environment`); eq(m.kind, 'ai', `${m.id} keeps AI info`) }
}
// 등록만 된 이미지는 업종과 같은 group이 아니라 사진 선택(기존 분류·화면)에 영향이 없다.
eq(managedPhoto('am_thuc_do_uong', '5131', 1), undefined, 'registered images do not change selection')
eq(managedPhoto('san_xuat_xay_dung', '8', 1), undefined, 'registered images do not change factory selection')
console.log('managedImages: manifest integrity checks passed')
