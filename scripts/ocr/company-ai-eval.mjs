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

const PROMPT_V1 = (text) => `From the Vietnamese job post below, copy the name of the employer (company, shop or brand) exactly as it is written in the text.
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

// 2차(#887 Lee 2026-11-17): 1차가 원문에 분명한 이름("HIGHLANDS COFFEE", "Nhà hàng Seoseo Galbi")까지 null로 답함.
// 원인 = '일반 낱말(cửa hàng·công ty)은 이름 아님' 줄이 그 낱말이 든 이름 전체를 버리게 했고, 'null' 조건이 넓어 애매하면 null로 기움.
// 고친 것(지시문만): 업종 낱말이 이름의 일부면 그대로 포함, null은 '특정 이름이 아예 없을 때만', 고용주와 근무지·고객사·홍보 문구 구별.
const PROMPT_V2 = (text) => `From the Vietnamese job post below, copy the name of the employer exactly as it is written in the text.
The employer is the company, shop, brand or recruitment agency that is hiring (if an agency posts, the agency).
Rules:
- Copy characters exactly from the text. Do not translate, correct, expand, or join words from different places. Do not use outside knowledge.
- If a business-type word is written as part of the name, keep it as written (e.g. "Nhà hàng Seoseo Galbi", "Công ty EAGLEON", "HIGHLANDS COFFEE").
- Do not answer: a workplace location only (a mall, supermarket chain building, industrial park, street address) when the post does not say that place is the employer; a client or partner the employer works for; a slogan, greeting, headline or job title; salary words.
- Answer null only if no specific employer name is written anywhere in the text.
Answer only JSON: {"company": "<exact text>" or null, "line": "<the full line of the text that contains it>" or null}

Post:
"""
${text}
"""`
// 3차(#887 Lee 2026-11-17): 답에서 원문 줄을 빼고 이름 또는 null만(잘림 원인 제거). 예시 이름은 평가 사례에서 가져오지 않은 지어낸 이름(과적합 방지).
// 근무지·고객사·홍보 문구 구별은 2차 그대로.
const PROMPT_V3 = (text) => `From the Vietnamese job post below, copy the name of the employer exactly as it is written in the text.
The employer is the company, shop, brand or recruitment agency that is hiring (if an agency posts, the agency).
Rules:
- Copy characters exactly from the text. Do not translate, correct, expand, or join words from different places. Do not use outside knowledge.
- If a business-type word is written as part of the name, keep it as written (e.g. "Nhà hàng Hoa Sen", "Công ty ABC Vina").
- Do not answer: a workplace location only (a mall, industrial park, street address) when the post does not say that place is the employer; a client or partner the employer works for; a slogan, greeting, headline or job title; salary words.
- Answer null only if no specific employer name is written anywhere in the text.
Answer only JSON: {"company": "<exact text>" or null}

Post:
"""
${text}
"""`
const PROMPTS = { v1: PROMPT_V1, v2: PROMPT_V2, v3: PROMPT_V3 }
const REPEATS = Number(process.env.EVAL_REPEATS || 1)

// 최소 가드(3차 비교안): 원문 일치 + 길이 2~60 + 명백한 문장(!/? 끝) 제외만. 지금 규칙의 낱말 목록(hasNameWord)은 쓰지 않는다
// — 접은 글자에서 "an(ăn)·minh(mình)·anh·cafe"가 구인 낱말 목록과 겹쳐 "AN café", "Minh Anh"를 버렸다(직접 확인).
export function guardMinimal(ans, text) {
  const c = String(ans?.company ?? '').trim()
  if (!c || c === 'null') return { name: '', reject: '' }
  const flat = String(text ?? '').normalize('NFC').replace(/\s+/g, ' ').trim()
  const esc = String(c).normalize('NFC').replace(/\s+/g, ' ').trim().replace(/[.*+?^${}()|[\]\\]/g, '\\$&').replace(/ /g, '\\s')
  const hit = flat.match(new RegExp(esc, 'iu'))
  if (!hit) return { name: '', reject: 'not_in_source' }
  const v = hit[0].replace(/^[\s\-–•*:|\[\]]+|[\s\-–•*:|,.\[\]]+$/g, '').trim()
  if (v.length < 2 || v.length > 60 || /[!?]$/.test(v)) return { name: '', reject: 'min_rule' }
  return { name: v, reject: '' }
}

async function ask(text, version) {
  const r = await fetch('https://api.anthropic.com/v1/messages', {
    method: 'POST',
    headers: { 'x-api-key': KEY, 'anthropic-version': '2023-06-01', 'content-type': 'application/json' },
    body: JSON.stringify({ model: MODEL, max_tokens: Number(process.env.EVAL_MAX_TOKENS || 1024), messages: [{ role: 'user', content: PROMPTS[version](text) }] }),
  })
  if (!r.ok) throw new Error(`AI HTTP ${r.status}`)
  const j = await r.json()
  const out = (j.content || []).filter((c) => c.type === 'text').map((c) => c.text).join('')
  // 답이 잘리거나(JSON 끝 없음) 형식이 틀리면 조용히 '없음'이 되지 않게 오류로 센다(2차 원인 분석).
  if (j.stop_reason === 'max_tokens') throw new Error('cut_off')
  const m = out.match(/\{[\s\S]*\}/)
  if (!m) throw new Error('no_json')
  try { return JSON.parse(m[0]) } catch { throw new Error('bad_json') }
}

const norm = (s) => String(s ?? '').normalize('NFC').replace(/\s+/g, ' ').trim().toLowerCase()
/** 가드: 원문에 글자 그대로(대소문자·공백만 무시) 있고, 지금 규칙의 이름 조건을 통과해야 이름. 아니면 ''와 버린 이유. */
export function guardCompany(ans, text) {
  const c = String(ans?.company ?? '').trim()
  if (!c || c === 'null') return { name: '', reject: '' }
  const flat = String(text ?? '').normalize('NFC').replace(/\s+/g, ' ').trim()
  const esc = (v) => String(v).normalize('NFC').replace(/\s+/g, ' ').trim().replace(/[.*+?^${}()|[\]\\]/g, '\\$&').replace(/ /g, '\\s')
  const hit = flat.match(new RegExp(esc(c), 'iu')) // 대소문자만 무시, 원문 글자 그대로 찾고 그 부분을 원문 표기로 씀(#887 검토)
  if (!hit) return { name: '', reject: 'not_in_source' }
  if (ans.line && !new RegExp(esc(ans.line), 'iu').test(flat)) return { name: '', reject: 'line_not_in_source' }
  const exact = hit[0]
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

const VERSIONS = (process.env.PROMPT_VERSIONS || 'v1,v2').split(',')
const cases = await labeledCases()
console.log(`정답 사례 ${cases.length}건`)
// 묶음: labeled(정답 있음) / facebook(1차 평가 20건) / holdout(평가에 안 쓴 다른 날 실제 글, 정답 없음)
const sets = [['labeled', cases.map((c) => ({ text: c.text, expected: c.expected }))]]
for (const arg of process.argv.slice(2)) {
  const [name, path] = arg.split('=')
  sets.push([name, JSON.parse(readFileSync(path, 'utf8')).map((p) => ({ key: p.key, text: p.text, expected: null }))])
}
const rows = []
for (const [set, items] of sets) for (const it of items) {
  const row = { set, key: it.key, expected: it.expected, rule: readCompany(it.text).name }
  for (const v of VERSIONS) for (let rep = 1; rep <= (v === 'v3' ? REPEATS : 1); rep++) {
    const tag = v === 'v3' && REPEATS > 1 ? `${v}r${rep}` : v
    // 오류(잘림·형식·호출 실패)는 '없음'과 따로 센다. 한 번 다시 묻고(재시도), 그래도 오류면 보류(error)로 남긴다.
    let raw = null, firstError = '', err = ''
    for (let attempt = 0; attempt < 2; attempt++) {
      try { raw = await ask(it.text, v); err = ''; break } catch (e) { err = e.message; if (!attempt) firstError = e.message }
    }
    const g = err ? { name: '', reject: 'error:' + err } : guardCompany(raw, it.text)
    const m = err ? { name: '', reject: 'error:' + err } : guardMinimal(raw, it.text)
    row[tag] = g.name; row[tag + '_reject'] = g.reject; row[tag + '_min'] = m.name; row[tag + '_min_reject'] = m.reject
    row[tag + '_raw'] = raw?.company ?? null; row[tag + '_first_error'] = firstError
  }
  rows.push(row)
}

const TAGS = VERSIONS.flatMap((v) => v === 'v3' && REPEATS > 1 ? Array.from({ length: REPEATS }, (_, i) => `${v}r${i + 1}`) : [v])
const L = rows.filter((r) => r.set === 'labeled')
const score = (k) => ({ exact: L.filter((r) => same(r[k], r.expected)).length, near: L.filter((r) => same(r[k], r.expected) || near(r[k], r.expected)).length,
  wrongName: L.filter((r) => r[k] && r.expected && !same(r[k], r.expected) && !near(r[k], r.expected)).length,
  nameOnEmpty: L.filter((r) => r[k] && !r.expected).length, missed: L.filter((r) => !r[k] && r.expected && !String(r[k + '_reject'] ?? '').startsWith('error')).length,
  error: L.filter((r) => String(r[k + '_reject'] ?? r[k.replace(/_min$/, '') + '_reject'] ?? '').startsWith('error')).length })
const cell = (v) => String(v ?? '').replace(/\|/g, '/').replace(/\n/g, ' ').slice(0, 45)
const cols = ['rule', ...TAGS.flatMap((t) => [t, t + '_min'])]
const errs = (t) => ({ first: rows.filter((r) => r[t + '_first_error']).length, final: rows.filter((r) => String(r[t + '_reject']).startsWith('error')).length,
  kinds: [...new Set(rows.map((r) => r[t + '_first_error']).filter(Boolean))].join(',') })
const varies = (r) => new Set(TAGS.map((t) => fold(r[t + '_min'] || '∅'))).size > 1
const out = [`## 회사 이름 AI 평가 (${MODEL}) — ${sets.map(([n, i]) => `${n} ${i.length}건`).join(' · ')} · 지시문 ${VERSIONS.join(',')} · 반복 ${REPEATS}`, '',
  '### 정답 사례(정답표 있음)', '| 방식(가드) | 정확히 맞음 | 앞뒤 말 차이 포함 | 다른 이름 | 이름 없는 글에 이름 | 놓침 | 오류(보류) |', '|---|---|---|---|---|---|---|',
  ...cols.map((k) => { const x = score(k); return `| ${k.replace(/_min$/, ' (최소 가드)')} | ${x.exact} | ${x.near} | ${x.wrongName} | ${x.nameOnEmpty} | ${x.missed} | ${x.error} |` }), '',
  '### 오류·재시도', ...TAGS.map((t) => { const e = errs(t); return `- ${t}: 첫 시도 오류 ${e.first}건(${e.kinds || '-'}) → 재시도 뒤 남은 오류 ${e.final}건` }),
  `- 가드가 원문에 없다고 버린 답: ${TAGS.map((t) => `${t} ${rows.filter((r) => r[t + '_reject'] === 'not_in_source').length}`).join(', ')}`,
  `- 지금 규칙 가드가 버린 답(최소 가드는 통과): ${TAGS.map((t) => `${t} ${rows.filter((r) => r[t + '_reject'] === 'rule').length}`).join(', ')}`, '',
  '### 반복 실행 편차(최소 가드 기준, 같은 글에 다른 답)', ...sets.map(([n]) => `- ${n}: ${rows.filter((r) => r.set === n && varies(r)).length}건`), '',
  '### 정답표 없는 글(facebook·holdout) — 판단은 추정', `| 묶음 | 지금 규칙 | ${TAGS.map((t) => t + ' 최소 가드').join(' | ')} | 편차 |`, `|---|---|${TAGS.map(() => '---').join('|')}|---|`,
  ...rows.filter((r) => r.set !== 'labeled').map((r) => `| ${r.set} ${String(r.key).slice(-6)} | ${cell(r.rule)} | ${TAGS.map((t) => cell(r[t + '_min']) + (r[t + '_min_reject'] ? ` (${r[t + '_min_reject']})` : '')).join(' | ')} | ${varies(r) ? '다름' : ''} |`), '',
  '### 정답 사례 중 AI가 정답과 다른 것', `| 정답 | 지금 규칙 | ${TAGS.map((t) => t + ' 최소 가드').join(' | ')} |`, `|---|---|${TAGS.map(() => '---').join('|')}|`,
  ...L.filter((r) => TAGS.some((t) => !same(r[t + '_min'], r.expected))).map((r) => `| ${cell(r.expected) || '(없음)'} | ${cell(r.rule)} | ${TAGS.map((t) => cell(r[t + '_min']) + (r[t + '_min_reject'] ? ` (${r[t + '_min_reject']})` : '')).join(' | ')} |`)]
console.log(out.join('\n'))
if (process.env.GITHUB_STEP_SUMMARY) appendFileSync(process.env.GITHUB_STEP_SUMMARY, out.join('\n') + '\n')
writeFileSync('company-ai-eval.json', JSON.stringify({ rows }, null, 1))
