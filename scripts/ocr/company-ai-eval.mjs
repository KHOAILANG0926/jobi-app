// 회사 이름 AI 읽기 평가(Lee 2026-11-17 #884 "기존 Haiku를 재사용하여 약 95건의 실제 평가") — 평가만, DB·운영 반영 없음.
// 입력: ① companyReader.test.ts의 정답 있는 사례 전부 ② Facebook 미리 보기 실제 글(실행 로그 원문, 전화는 로그에서 이미 가려짐).
// 비교: 지금 규칙(readCompany) vs AI(+가드). 가드 = 원문에 글자 그대로 없는 이름 버림 + 지금 규칙의 이름 조건(acceptName) 통과.
// 실행: node --experimental-strip-types --import ./scripts/ts-extensionless-register.mjs scripts/ocr/company-ai-eval.mjs [facebook_posts.json]
import { mkdtempSync, readFileSync, writeFileSync, appendFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join, resolve } from 'node:path'
import { pathToFileURL } from 'node:url'
import { readCompany, acceptName } from '../../src/lib/companyReader.ts'
import { fold } from '../../src/lib/jobIdentity.ts'

const MODEL = process.env.CLASSIFY_AI_MODEL || 'claude-haiku-5-5' // ai-classify.mjs와 같은 모델
const KEY = process.env.ANTHROPIC_API_KEY
if (!KEY) { console.error('ANTHROPIC_API_KEY 없음'); process.exit(1) }

const PROMPT = (text) => `From the Vietnamese job post below, copy the name of the employer (company, shop or brand) exactly as it is written in the text.
Rules:
- Copy characters exactly from the text. Do not translate, correct, shorten, expand, or join words from different places.
- Do not use outside knowledge. If the name is not written in the text, answer null.
- Not a name: job titles, salaries, addresses, place names alone, slogans or greetings, generic words like "cửa hàng", "công ty", "nhà mình".
- If a recruitment agency posts the job, copy the agency's name.
Answer only JSON: {"company": "<exact text>" or null, "line": "<the full line of the text that contains it>" or null}

Post:
"""
${text}
"""`

async function ask(text) {
  const r = await fetch('https://api.anthropic.com/v1/messages', {
    method: 'POST',
    headers: { 'x-api-key': KEY, 'anthropic-version': '2023-06-01', 'content-type': 'application/json' },
    body: JSON.stringify({ model: MODEL, max_tokens: 300, messages: [{ role: 'user', content: PROMPT(text) }] }),
  })
  if (!r.ok) throw new Error(`AI HTTP ${r.status}`)
  const j = await r.json()
  const out = (j.content || []).filter((c) => c.type === 'text').map((c) => c.text).join('')
  const m = out.match(/\{[\s\S]*\}/)
  return m ? JSON.parse(m[0]) : {}
}

const norm = (s) => String(s ?? '').normalize('NFC').replace(/\s+/g, ' ').trim().toLowerCase()
/** 가드: 원문에 글자 그대로(대소문자·공백만 무시) 있고, 지금 규칙의 이름 조건을 통과해야 이름. 아니면 ''와 버린 이유. */
export function guardCompany(ans, text) {
  const c = String(ans?.company ?? '').trim()
  if (!c || c === 'null') return { name: '', reject: '' }
  const src = norm(text)
  if (!src.includes(norm(c))) return { name: '', reject: 'not_in_source' }
  if (ans.line && !src.includes(norm(ans.line))) return { name: '', reject: 'line_not_in_source' }
  const at = src.indexOf(norm(c))
  const exact = String(text).normalize('NFC').replace(/\s+/g, ' ').slice(at, at + norm(c).length) // 원문 표기 그대로 씀
  const v = acceptName(exact)
  return v ? { name: v, reject: '' } : { name: '', reject: 'rule' }
}

// ① 정답 사례: 시험 파일을 그대로 돌리되 readCompany 자리에 기록용 가짜를 넣어 (원문, 정답)을 모은다(시험 파일은 안 고침).
async function labeledCases() {
  const dir = mkdtempSync(join(tmpdir(), 'company-eval-'))
  writeFileSync(join(dir, 'stub.ts'), `export const seen: string[] = []
export function readCompany(t: string) { seen.push(t); return { name: '__X__' + (seen.length - 1), agency: false, fee: false } }
export const hasNameWord = (_: string) => 'H'
export const readWorkplace = (_: string) => 'W'
`)
  const src = readFileSync(resolve('src/lib/companyReader.test.ts'), 'utf8').replace(/from '\.\/companyReader\.ts'/, "from './stub.ts'")
  writeFileSync(join(dir, 'cases.test.ts'), src)
  const stub = await import(pathToFileURL(join(dir, 'stub.ts')).href)
  let msg = ''
  try { await import(pathToFileURL(join(dir, 'cases.test.ts')).href) } catch (e) { msg = String(e.message) }
  const cases = []
  for (const line of msg.split('\n')) {
    const m = line.match(/: "__X__(\d+)" ≠ (".*")$/)
    if (m) cases.push({ text: stub.seen[Number(m[1])], expected: JSON.parse(m[2]) })
  }
  return cases
}

const same = (a, b) => norm(a) === norm(b)
const near = (a, b) => !!a && !!b && (fold(a).includes(fold(b)) || fold(b).includes(fold(a)))

const rows = []
const cases = await labeledCases()
console.log(`정답 사례 ${cases.length}건`)
for (const c of cases) {
  const rule = readCompany(c.text).name
  let ai = { name: '', reject: 'error' }, raw = null
  try { raw = await ask(c.text); ai = guardCompany(raw, c.text) } catch (e) { ai.reject = 'error:' + e.message }
  rows.push({ set: 'labeled', expected: c.expected, rule, ai: ai.name, reject: ai.reject, raw: raw?.company ?? null })
}
const fbPath = process.argv[2]
const posts = fbPath ? JSON.parse(readFileSync(fbPath, 'utf8')) : []
for (const p of posts) {
  const rule = readCompany(p.text).name
  let ai = { name: '', reject: 'error' }, raw = null
  try { raw = await ask(p.text); ai = guardCompany(raw, p.text) } catch (e) { ai.reject = 'error:' + e.message }
  rows.push({ set: 'facebook', key: p.key, expected: null, rule, ai: ai.name, reject: ai.reject, raw: raw?.company ?? null })
}

const L = rows.filter((r) => r.set === 'labeled')
const score = (k) => ({ exact: L.filter((r) => same(r[k], r.expected)).length, near: L.filter((r) => same(r[k], r.expected) || near(r[k], r.expected)).length,
  wrongName: L.filter((r) => r[k] && !same(r[k], r.expected) && !near(r[k], r.expected)).length, missed: L.filter((r) => !r[k] && r.expected).length })
const s = { rule: score('rule'), ai: score('ai'), invented: rows.filter((r) => r.reject === 'not_in_source').length,
  rejectedByRule: rows.filter((r) => r.reject === 'rule').length, errors: rows.filter((r) => r.reject.startsWith('error')).length }
const cell = (v) => String(v ?? '').replace(/\|/g, '/').replace(/\n/g, ' ').slice(0, 60)
const out = [`## 회사 이름 AI 평가 (${MODEL}) — 정답 사례 ${L.length}건 + Facebook 실제 글 ${posts.length}건`, '',
  `| | 정확히 맞음 | 맞음(앞뒤 말 차이 포함) | 다른 이름 | 놓침 |`, '|---|---|---|---|---|',
  `| 지금 규칙 | ${s.rule.exact} | ${s.rule.near} | ${s.rule.wrongName} | ${s.rule.missed} |`,
  `| AI+가드 | ${s.ai.exact} | ${s.ai.near} | ${s.ai.wrongName} | ${s.ai.missed} |`, '',
  `AI가 원문에 없는 이름을 답함(가드가 버림): ${s.invented}건 · 지금 규칙 조건에 걸려 버림: ${s.rejectedByRule}건 · 호출 오류: ${s.errors}건`, '',
  '| 묶음 | 정답 | 지금 규칙 | AI+가드 | AI 원답(버린 이유) |', '|---|---|---|---|---|',
  ...rows.filter((r) => r.set === 'facebook' || !same(r.rule, r.expected) || !same(r.ai, r.expected))
    .map((r) => `| ${r.set === 'facebook' ? 'FB ' + r.key : '정답'} | ${cell(r.expected ?? '—')} | ${cell(r.rule)} | ${cell(r.ai)} | ${cell(r.raw)}${r.reject ? ' (' + r.reject + ')' : ''} |`)]
console.log(out.join('\n'))
if (process.env.GITHUB_STEP_SUMMARY) appendFileSync(process.env.GITHUB_STEP_SUMMARY, out.join('\n') + '\n')
writeFileSync('company-ai-eval.json', JSON.stringify({ summary: s, rows }, null, 1))
