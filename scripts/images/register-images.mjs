// 전달받은 이미지 ZIP(풀어 둔 폴더)을 이미지 목록(data/industry-photos/manifest.json)에 등록한다 — #1180 이미지 관리 구조 그대로.
// 사용: node scripts/images/register-images.mjs <풀어 둔 폴더> [--dry-run]
// 폴더 구성: manifest.csv(id,role,environment,group,filename,proposed_repo_path,ai_generated,bytes,sha256) + proposed_repo_path 의 이미지.
// 규칙: sha256 검증 → 같은 id·같은 sha256(목록·public/images 전체)은 건너뜀(중복 등록 안 함) → 파일 복사 → 목록에 한 줄 추가. 새 서비스·유료 API 없음.
import { createHash } from 'node:crypto'
import { copyFileSync, existsSync, mkdirSync, readFileSync, readdirSync, statSync, writeFileSync } from 'node:fs'
import { dirname, join } from 'node:path'

const ROOT = join(import.meta.dirname, '..', '..')
const MANIFEST = join(ROOT, 'data', 'industry-photos', 'manifest.json')
const sha256 = (buf) => createHash('sha256').update(buf).digest('hex')

function parseCsv(text) {
  const [head, ...rows] = text.replace(/^﻿/, '').trim().split(/\r?\n/).map((l) => l.split(','))
  return rows.map((r) => Object.fromEntries(head.map((h, i) => [h, r[i]])))
}
function walk(dir) {
  return readdirSync(dir).flatMap((n) => { const f = join(dir, n); return statSync(f).isDirectory() ? walk(f) : [f] })
}

export function register(srcDir, { dryRun = false } = {}) {
  const manifest = JSON.parse(readFileSync(MANIFEST, 'utf8'))
  const knownIds = new Set(manifest.images.map((m) => m.id))
  const knownHashes = new Set(manifest.images.map((m) => m.sha256).filter(Boolean))
  for (const f of walk(join(ROOT, 'public', 'images'))) knownHashes.add(sha256(readFileSync(f)))
  const added = [], skipped = []
  for (const r of parseCsv(readFileSync(join(srcDir, 'manifest.csv'), 'utf8'))) {
    const src = join(srcDir, r.proposed_repo_path)
    if (!existsSync(src)) throw new Error(`${r.id}: 이미지 파일 없음 ${r.proposed_repo_path}`)
    const buf = readFileSync(src)
    const hash = sha256(buf)
    if (r.sha256 && hash !== r.sha256) throw new Error(`${r.id}: sha256 불일치(전달 목록 ${r.sha256} / 실제 ${hash})`)
    if (knownIds.has(r.id)) { skipped.push(`${r.id} (같은 id)`); continue }
    if (knownHashes.has(hash)) { skipped.push(`${r.id} (같은 그림이 이미 있음)`); continue }
    const dest = join(ROOT, r.proposed_repo_path)
    if (existsSync(dest)) throw new Error(`${r.id}: 다른 그림이 같은 경로에 있음 ${r.proposed_repo_path}`)
    if (!dryRun) { mkdirSync(dirname(dest), { recursive: true }); copyFileSync(src, dest) }
    // group·role·environment는 전달받은 값 그대로. 업종(category) 연결·직무 코드(roles)는 대표 승인 3단계에서 채우므로 여기서 짓지 않는다.
    manifest.images.push({
      id: r.id, file: '/' + r.proposed_repo_path.replace(/^public\//, ''), group: r.group, role: r.role, environment: r.environment,
      kind: String(r.ai_generated).toLowerCase() === 'true' ? 'ai' : 'stock', sha256: hash,
    })
    knownIds.add(r.id); knownHashes.add(hash); added.push(r.id)
  }
  if (!dryRun && added.length) writeFileSync(MANIFEST, JSON.stringify(manifest, null, 2) + '\n')
  return { added, skipped }
}

if (process.argv[1] === import.meta.filename) {
  const dir = process.argv[2]
  if (!dir) { console.error('사용: node scripts/images/register-images.mjs <풀어 둔 폴더> [--dry-run]'); process.exit(2) }
  const { added, skipped } = register(dir, { dryRun: process.argv.includes('--dry-run') })
  console.log(`등록 ${added.length}건, 건너뜀 ${skipped.length}건`)
  for (const s of skipped) console.log(`  건너뜀: ${s}`)
}
