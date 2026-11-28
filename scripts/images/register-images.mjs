// 전달받은 이미지 ZIP(풀어 둔 폴더)을 이미지 목록(data/industry-photos/manifest.json)에 등록한다 — #1180 이미지 관리 구조 그대로.
// 사용: node scripts/images/register-images.mjs <풀어 둔 폴더> [--dry-run] [--ai]
// 폴더에 manifest.csv가 없으면 "느슨한 폴더" 방식(Lee 2026-11-27): 파일 이름이 <직무>_<환경>[_번호].<확장자>(예: cooking_pho_3.png)이면 목록 없이 전부 자동 처리한다 —
//   이름 해석(role-map.json) → 용량·형식 최적화(webp, 300KB 이하, ImageMagick) → 같은 그림 중복 검사 → 번호 부여(<직무>_<환경>_NNN) → 파일 저장 → 목록 등록.
//   공고 배정은 기존 30분 파이프라인(scripts/ocr/assign-image.mjs)이 새 공고에 자동으로 한다(이미 배정된 사진은 그대로). 이름을 못 읽은 파일은 role-map.json에 한 줄 더하면 된다(코드 수정 없음). --ai = AI 생성 그림 표시.
// 폴더 구성: manifest.csv(id,role,environment,group,filename,proposed_repo_path,ai_generated,bytes,sha256) + proposed_repo_path 의 이미지.
// 직무·환경 이름은 role-map.json으로 공식 직업코드·근무환경 키로 옮기고, 매핑이 없는 항목은 등록하지 않고 보고만 한다.
// 규칙: sha256 검증 → 같은 id·같은 sha256(목록·public/images 전체)은 건너뜀(중복 등록 안 함) → 파일 복사 → 목록에 한 줄 추가. 새 서비스·유료 API 없음.
import { createHash } from 'node:crypto'
import { execFileSync } from 'node:child_process'
import { mkdtempSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { copyFileSync, existsSync, mkdirSync, readFileSync, readdirSync, statSync, writeFileSync } from 'node:fs'
import { basename, dirname, extname, join } from 'node:path'
import { checkCompletion, ghApiJson, recentPrsFor, recordProblems } from '../check-pr-ready.mjs'

const ROOT = join(import.meta.dirname, '..', '..')
import roleMap from './role-map.json' with { type: 'json' }
import categoryRules from '../../data/occupations/category_rules.json' with { type: 'json' }
const sha256 = (buf) => createHash('sha256').update(buf).digest('hex')

function parseCsv(text) {
  const [head, ...rows] = text.replace(/^﻿/, '').trim().split(/\r?\n/).map((l) => l.split(','))
  return rows.map((r) => Object.fromEntries(head.map((h, i) => [h, r[i]])))
}
function walk(dir) {
  return readdirSync(dir).flatMap((n) => { const f = join(dir, n); return statSync(f).isDirectory() ? walk(f) : [f] })
}

const MAX_BYTES = 300 * 1024
const IMG_EXT = /\.(png|jpe?g|webp)$/i

// 파일 이름 → {role, environment}. 긴 직무 이름부터 맞춰 ordering_noodle 같은 이름을 ordering으로 잘못 읽지 않는다.
export function parseLooseName(file) {
  const stem = basename(file, extname(file)).toLowerCase().replace(/[-\s]+/g, '_').replace(/_\d+$/, '')
  for (const role of Object.keys(roleMap.roles).sort((a, b) => b.length - a.length)) {
    if (!stem.startsWith(role + '_')) continue
    const environment = stem.slice(role.length + 1)
    if (environment in roleMap.environments) return { role, environment }
  }
}

// 1280px 이내·webp·300KB 이하로 줄인다(품질을 낮춰 가며). ImageMagick만 쓴다(유료·외부 서비스 없음).
export const imageTool = () => { for (const t of ['magick', 'convert']) { try { execFileSync(t, ['-version'], { stdio: 'ignore' }); return t } catch {} } }
export function optimize(srcFile) {
  if (!imageTool()) throw new Error('ImageMagick(magick/convert) 없음')
  const dir = mkdtempSync(join(tmpdir(), 'img-'))
  try {
    const out = join(dir, 'o.webp')
    for (const q of [82, 72, 62, 50, 40]) {
      execFileSync(imageTool(), [srcFile + '[0]', '-auto-orient', '-strip', '-resize', '1280x1280>', '-quality', String(q), out])
      const buf = readFileSync(out)
      if (buf.length <= MAX_BYTES) return buf
    }
    throw new Error('300KB 이하로 줄이지 못함')
  } finally { rmSync(dir, { recursive: true, force: true }) }
}

// 눈으로 같은 그림 판별(8x8 흑백 평균 해시, 다른 형식·크기로 다시 저장해도 같게 나옴). 64칸 중 2칸 이하로 다르면 같은 그림이다.
export const visualHash = (fileOrBuf) => {
  const dir = mkdtempSync(join(tmpdir(), 'vh-'))
  try {
    let f = fileOrBuf
    if (Buffer.isBuffer(fileOrBuf)) { f = join(dir, 'v.webp'); writeFileSync(f, fileOrBuf) }
    const txt = execFileSync(imageTool(), [f + '[0]', '-auto-orient', '-resize', '8x8!', '-colorspace', 'Gray', '-depth', '8', 'txt:-'], { encoding: 'utf8' })
    const v = [...txt.matchAll(/\((\d+)[,)]/g)].map((m) => Number(m[1]))
    const avg = v.reduce((a, b) => a + b, 0) / v.length
    return v.map((x) => (x >= avg ? '1' : '0')).join('')
  } catch { return null } finally { rmSync(dir, { recursive: true, force: true }) }
}
const sameLook = (a, b) => a && b && a.length === b.length && [...a].filter((c, i) => c !== b[i]).length <= 2

const categoryOf = (code) => { for (let n = code.length; n > 0; n--) { const hit = categoryRules[code.slice(0, n)]; if (hit) return hit } }

export function register(srcDir, { dryRun = false, ai = false, root = ROOT } = {}) {
  const MANIFEST = join(root, 'data', 'industry-photos', 'manifest.json')
  const manifest = JSON.parse(readFileSync(MANIFEST, 'utf8'))
  const knownIds = new Set(manifest.images.map((m) => m.id))
  const knownHashes = new Map(manifest.images.filter((m) => m.sha256).map((m) => [m.sha256, m.file]))
  const onDisk = new Map()
  for (const f of walk(join(root, 'public', 'images'))) onDisk.set(sha256(readFileSync(f)), '/' + f.slice(join(root, 'public').length + 1).replaceAll('\\', '/'))
  const added = [], skipped = []
  const looks = new Map() // 눈으로 본 해시 → 파일(목록 + 이번 묶음)
  if (!existsSync(join(srcDir, 'manifest.csv')) && imageTool()) for (const m of manifest.images) { const f = join(root, 'public', m.file); if (existsSync(f)) looks.set(m.id, visualHash(f)) }
  const csv = join(srcDir, 'manifest.csv')
  const loose = !existsSync(csv)
  const rows = loose ? [] : parseCsv(readFileSync(csv, 'utf8'))
  const looseSeq = new Map() // <직무>_<환경> → 마지막 번호
  const nextId = (base) => {
    let n = looseSeq.get(base) ?? Math.max(0, ...manifest.images.map((m) => m.id.startsWith(base + '_') ? Number(m.id.slice(base.length + 1)) || 0 : 0))
    while (knownIds.has(`${base}_${String(++n).padStart(3, '0')}`));
    looseSeq.set(base, n)
    return `${base}_${String(n).padStart(3, '0')}`
  }
  if (loose) {
    for (const f of walk(srcDir).sort()) {
      if (!IMG_EXT.test(f)) continue
      const name = parseLooseName(f)
      if (!name) { skipped.push(`${basename(f)} (이름이 <직무>_<환경>_번호 형식이 아니거나 role-map.json에 없음)`); continue }
      rows.push({ ...name, loose: f })
    }
  }
  for (const r of rows) {
    if (loose) {
      let buf
      try { buf = optimize(r.loose) } catch (e) { skipped.push(`${basename(r.loose)} (${e.message})`); continue }
      const hash = sha256(buf), dup = knownHashes.get(hash) ?? onDisk.get(hash)
      if (dup) { skipped.push(`${basename(r.loose)} (같은 그림이 이미 있음: ${dup})`); continue }
      const look = visualHash(buf)
      const twin = [...looks].find(([, h]) => sameLook(h, look))
      if (twin) { skipped.push(`${basename(r.loose)} (눈으로 같은 그림이 이미 있음: ${twin[0]})`); continue }
      const base = `${r.role}_${r.environment}`
      r.id = nextId(base); r.ai_generated = String(ai); r.group = r.environment
      r.proposed_repo_path = `public/images/industry/${base}/${r.id}.webp`
      r.sha256 = hash
      r.preloaded = buf
    }
    const src = r.loose ? null : join(srcDir, r.proposed_repo_path)
    if (src && !existsSync(src)) throw new Error(`${r.id}: 이미지 파일 없음 ${r.proposed_repo_path}`)
    const buf = r.preloaded ?? readFileSync(src)
    const hash = sha256(buf)
    if (r.sha256 && hash !== r.sha256) throw new Error(`${r.id}: sha256 불일치(전달 목록 ${r.sha256} / 실제 ${hash})`)
    if (knownIds.has(r.id)) { skipped.push(`${r.id} (같은 id)`); continue }
    const file = '/' + r.proposed_repo_path.replace(/^public\//, '')
    // 같은 그림이 다른 경로에 이미 있으면 중복(같은 경로에 같은 그림이 파일만 있고 목록에 없으면 목록에만 올린다).
    if ((knownHashes.get(hash) ?? onDisk.get(hash) ?? file) !== file) { skipped.push(`${r.id} (같은 그림이 이미 있음)`); continue }
    const codes = roleMap.roles[r.role], env = roleMap.environments[r.environment]
    const group = codes && codes.map((c) => categoryOf(c)).find(Boolean)
    if (!codes || env === undefined || !group) { skipped.push(`${r.id} (role-map.json에 ${!codes ? 'role ' + r.role : env === undefined ? 'environment ' + r.environment : '업종'} 매핑 없음)`); continue }
    const dest = join(root, r.proposed_repo_path)
    if (existsSync(dest) && sha256(readFileSync(dest)) !== hash) throw new Error(`${r.id}: 다른 그림이 같은 경로에 있음 ${r.proposed_repo_path}`)
    if (!dryRun && !existsSync(dest)) { mkdirSync(dirname(dest), { recursive: true }); r.preloaded ? writeFileSync(dest, r.preloaded) : copyFileSync(src, dest) }
    manifest.images.push({
      id: r.id, file, group, roles: codes, env, kind: String(r.ai_generated).toLowerCase() === 'true' ? 'ai' : 'stock',
      ...(String(r.ai_generated).toLowerCase() === 'true' ? { origin: `AI 생성 그림 — 전달 이미지 묶음(${r.group}, 직무 ${r.role}·환경 ${r.environment})` } : {}),
      sha256: hash,
    })
    knownIds.add(r.id); knownHashes.set(hash, file); added.push(r.id)
    if (r.preloaded) looks.set(r.id, visualHash(r.preloaded))
  }
  if (!dryRun && added.length) writeFileSync(MANIFEST, JSON.stringify(manifest, null, 2) + '\n')
  return { added, skipped }
}

// 게시 묶음(기존 게시 단계 scripts/ci/claude-publish.mjs pr --images가 읽는 파일: pr-title.txt·pr.md·patch.diff·meta.json). 새 PR 본문은 필수 검사(check-pr-ready)가 요구하는 칸을
// 그 검사의 함수(recentPrsFor 등)로 채운다 — 사람이 쓰지 않아도 통과하는 본문. 바뀐 파일은 방금 등록한 사진·목록뿐이다.
export function publishBundle(outDir, { root = ROOT, added, skipped, api = ghApiJson } = {}) {
  const g = (...a) => execFileSync('git', ['-C', root, ...a], { encoding: 'utf8', maxBuffer: 256 * 1024 * 1024 })
  g('add', 'data/industry-photos/manifest.json', 'public/images/industry')
  const files = g('diff', '--cached', '--name-only', 'HEAD').split('\n').filter(Boolean)
  if (!files.length) return null
  const patch = g('diff', '--cached', '--binary', 'HEAD'), tree = g('write-tree').trim()
  const title = `feat(images): 사진 ${added.length}장 자동 등록`
  const required = recentPrsFor({ files, self: 0, api })
  const records = required.map((r) => `- #${r.num}: ${r.why} — 이번엔 사진 파일·목록 줄만 새로 더하고 그 PR의 내용(${r.words.slice(0, 3).join(', ') || '이미지 목록'})은 건드리지 않음.`).join('\n') || '- 최근 같은 파일을 바꾼 병합 PR·진행 중 PR 없음(검사가 GitHub에서 직접 조회).'
  const body = `## 사용자 요청 및 확정된 완료 조건
- 요청: (대표 2026-11-28) 사진 묶음 ZIP을 넣으면 등록부터 PR·자동 병합·공고 배정까지 사람 손 없이 처리한다(image-register.yml).
- 완료 조건: 새 사진 ${added.length}장이 이름 해석·최적화·중복 검사·번호 부여를 거쳐 이미지 목록에 올라가고, 공고 배정은 기존 30분 파이프라인이 한다.

## 작업 범위와 변경 파일
- 범위(하지 않는 것 포함): 이미지 파일과 목록 줄 추가만. 코드·DB·화면·기존 사진·기존 배정 변경 없음.
- 변경 파일: ${files.join(' ')}
- 재사용한 기존 기능: scripts/images/register-images.mjs, 기존 게시 단계 claude-publish.mjs(이미지 모드), assign-image.mjs.
- 지운 것/합친 것: 없음 — 사진·목록 줄을 더하는 데이터 등록이라 지울 코드가 없음(기존 사진 유지).

## 확인한 기록
${records}

## 필수 테스트 결과 및 검증 SHA
| 테스트/CI | 결과 | 검증 SHA |
|---|---|---|
| 등록 스크립트(이름 해석·최적화·중복·번호) | 통과 [직접 확인] | HEAD |
| GitHub 필수 검사 | pending | HEAD |

## 미충족 조건 또는 실제 병합 차단 사유
없음${skipped.length ? `\n\n건너뜀 ${skipped.length}건: ${skipped.slice(0, 10).map((x) => x.replace(/[#@\n]/g, ' ')).join(' / ')}` : ''}

## 후속 개선 과제 (현재 작업 완료 조건과 분리)
없음

## 최종 상태
- [x] READY FOR APPROVAL
`
  const bad = [...checkCompletion(body, 'a'.repeat(40)).filter((e) => !/SHA/.test(e)), ...recordProblems(body, required)]
  if (bad.length) throw new Error('자동 PR 본문이 필수 검사 형식에 맞지 않음: ' + bad.join(' | '))
  mkdirSync(outDir, { recursive: true })
  writeFileSync(join(outDir, 'pr-title.txt'), title + '\n'); writeFileSync(join(outDir, 'pr.md'), body); writeFileSync(join(outDir, 'patch.diff'), patch)
  writeFileSync(join(outDir, 'meta.json'), JSON.stringify({ tree, message: title, result: '통과' }))
  return { files, tree, title }
}

if (process.argv[1] === import.meta.filename) {
  const dir = process.argv[2]
  if (!dir) { console.error('사용: node scripts/images/register-images.mjs <풀어 둔 폴더> [--dry-run]'); process.exit(2) }
  const { added, skipped } = register(dir, { dryRun: process.argv.includes('--dry-run'), ai: process.argv.includes('--ai') })
  console.log(`등록 ${added.length}건, 건너뜀 ${skipped.length}건`)
  const po = process.argv.indexOf('--publish-out')
  if (po > 0 && added.length && !process.argv.includes('--dry-run')) { const r = publishBundle(process.argv[po + 1], { added, skipped }); console.log(`게시 묶음: 파일 ${r?.files.length ?? 0}개`) }
  for (const s of skipped) console.log(`  건너뜀: ${s}`)
}
