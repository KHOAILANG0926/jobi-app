// 이 PC에 이미 쌓인 scripts/research/out/ · backups/ 파일을 Supabase 비공개 테이블로 옮긴다(1회용).
//   node scripts/research/migrate_out_to_private_store.mjs            # 업로드 + 되읽어 sha256 대조만 (로컬 파일은 그대로)
//   node scripts/research/migrate_out_to_private_store.mjs --delete-local   # 대조가 모두 일치한 파일만 로컬에서 삭제
// 규칙: PC에 수집·검토 데이터/백업을 두지 않는다. 업로드·대조가 끝나기 전에는 아무것도 지우지 않는다.
// out/ → kind=bn_research, name=<파일명> / backups/<ts>/<파일> → kind=backup, name=legacy/<ts>/<파일>
// 텍스트(JSON이 아닌 csv/sql 등)는 { text } 로 감싼다. 인증: 관리자 로그인(저장 안 함) 또는 ADMIN_ACCESS_TOKEN.
import crypto from 'node:crypto'
import fs from 'node:fs'
import path from 'node:path'
import { loadArtifact, saveArtifact } from './lib/privateStore.mjs'

const del = process.argv.includes('--delete-local')
const ROOT = path.resolve(import.meta.dirname, '..', '..')
const sha = (buf) => crypto.createHash('sha256').update(buf).digest('hex')
// jsonb는 객체 키 순서를 바꿔 돌려주므로, 대조는 키를 정렬한 표준 형태로 한다.
const canon = (v) => JSON.stringify(v, (_k, x) => (x && typeof x === 'object' && !Array.isArray(x) ? Object.fromEntries(Object.entries(x).sort(([a], [b]) => (a < b ? -1 : a > b ? 1 : 0))) : x))

const items = []
const outDir = path.join(ROOT, 'scripts', 'research', 'out')
if (fs.existsSync(outDir)) for (const f of fs.readdirSync(outDir)) if (fs.statSync(path.join(outDir, f)).isFile()) items.push({ file: path.join(outDir, f), kind: 'bn_research', name: f })
const bkDir = path.join(ROOT, 'backups')
if (fs.existsSync(bkDir)) for (const d of fs.readdirSync(bkDir)) {
  const dir = path.join(bkDir, d)
  if (fs.statSync(dir).isDirectory()) for (const f of fs.readdirSync(dir)) items.push({ file: path.join(dir, f), kind: 'backup', name: `legacy/${d}/${f}` })
}
if (items.length === 0) { console.log('옮길 로컬 파일 없음(scripts/research/out, backups).'); process.exit(0) }

const verified = []
for (const it of items) {
  const buf = fs.readFileSync(it.file)
  const text = buf.toString('utf8')
  let payload
  try { payload = JSON.parse(text) } catch { payload = { text } }
  const expect = sha(canon(payload))
  await saveArtifact(it.kind, it.name, payload, { bytes: buf.length, sha256: sha(buf), migratedFrom: 'local-file' })
  const back = await loadArtifact(it.kind, it.name)
  const ok = back != null && sha(canon(back)) === expect
  console.log(`${ok ? '일치' : '불일치'}  ${it.kind}/${it.name} (${buf.length} bytes)`)
  if (ok) verified.push(it.file)
}
console.log(`업로드·대조 ${verified.length}/${items.length}건 일치`)
if (!del) { console.log('로컬 파일은 지우지 않았습니다. 확인 후 --delete-local 로 다시 실행하세요.'); process.exit(verified.length === items.length ? 0 : 1) }
if (verified.length !== items.length) { console.error('일치하지 않는 파일이 있어 로컬 삭제를 건너뜁니다.'); process.exit(1) }
for (const f of verified) fs.rmSync(f)
for (const d of [path.join(bkDir)]) if (fs.existsSync(d)) for (const sub of fs.readdirSync(d)) { const p = path.join(d, sub); if (fs.statSync(p).isDirectory() && fs.readdirSync(p).length === 0) fs.rmdirSync(p) }
console.log(`로컬 파일 ${verified.length}개 삭제 완료.`)
