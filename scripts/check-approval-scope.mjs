// 결정 0003 강제 장치(2026-11-15 S4 개정): Lee 승인이 필요한 곳은 결정 문서(docs/decisions)와 보안·CI·승인 핵심 파일뿐이어야 한다.
// AI가 승인 대상을 마음대로 늘려 Lee에게 판단할 수 없는 승인을 요구하는 것을 막는다(일반 파일을 넣으면 빨간불). 아울러 0001의 한국어·영어 결정 짝을 검사한다.
// 허용 목록은 검사 장치 파일 목록(scripts/decision-approval-gate.mjs GATE_CODE)과 같은 범위다. 이 목록·CODEOWNERS 변경은 그 자체가 Lee 승인 대상(/.github/, /scripts/check-*.mjs).
import { readFileSync, readdirSync } from 'node:fs'
export const ALLOWED = new Set(['/docs/decisions/', '/.github/', '/scripts/ci/', '/scripts/status/', '/scripts/check-*.mjs', '/scripts/*-gate.mjs', '/scripts/approved-migrations.mjs', '/AGENTS.md'])
export const OWNER = '@KHOAILANG0926'
const fail = (m) => { console.error('APPROVAL_SCOPE: ' + m); process.exit(1) }
export function parseOwners(text) {
  return text.split('\n').map((l) => l.trim()).filter((l) => l && !l.startsWith('#')).map((l) => { const [path, ...owners] = l.split(/\s+/); return { path, owners } })
}
export function problems(text) {
  const out = [], rows = parseOwners(text)
  for (const r of rows) {
    if (!ALLOWED.has(r.path)) out.push(`Lee 승인 대상은 결정 문서와 보안·CI·승인 핵심 파일만 허용(결정 0003). 허용 안 된 항목: ${r.path}`)
    if (r.owners.length !== 1 || r.owners[0] !== OWNER) out.push(`소유자는 ${OWNER} 하나여야 함: ${r.path} → ${r.owners.join(' ') || '(소유자 없음 — 승인 대상을 풀어 줌)'}`)
  }
  for (const p of ALLOWED) if (!rows.some((r) => r.path === p)) out.push(`필수 항목 없음: ${p}`)
  return out
}
if (process.argv[1]?.endsWith('check-approval-scope.mjs')) {
  const text = readFileSync('.github/CODEOWNERS', 'utf8')
  for (const p of problems(text)) fail(p)
  const nums = (dir) => readdirSync(`docs/decisions/${dir}`).filter((f) => /^\d{4}-.*\.md$/.test(f)).map((f) => f.slice(0, 4)).sort().join(',')
  if (nums('ko') !== nums('en')) fail(`한국어·영어 결정 번호가 다름: ko=${nums('ko')} en=${nums('en')}`)
  console.log(`approval scope OK (${parseOwners(text).length} owner lines, decisions ${nums('ko')})`)
}
