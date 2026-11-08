// AI 비용 줄이기 비교 시험 (Lee 2026-11-08 "진행하자"): 같은 공고를 비싼 AI(Sonnet)와 싼 AI(Haiku)로 판정해 결과를 비교한다.
// 운영 DB는 읽기 전용 트랜잭션으로만 연다(쓰기 0). 결과는 표(markdown)로 출력한다.
// 대상: 기준 시각 이후 최근 공고 N건(칸·복리후생 판정) + 그중 회사·도로가 있는 공고 M건(업종 인터넷 검색).
// 필요: SUPABASE_DB_URL, ANTHROPIC_API_KEY. 선택: COMPARE_JOBS(기본 10), COMPARE_WEB(기본 5), OUT(결과 파일)
import pg from 'pg'
import { writeFileSync } from 'node:fs'
import { buildPrompt, guardAiResult } from '../../src/lib/aiClassifyGuard.ts'
import { buildWebPrompt, guardWebAnswer, streetOf } from '../../src/lib/businessType.ts'
import { afterCutoff } from './auto-cutoff.mjs'

const { SUPABASE_DB_URL, ANTHROPIC_API_KEY } = process.env
const N = Number(process.env.COMPARE_JOBS || 10), M = Number(process.env.COMPARE_WEB || 5)
const A = 'claude-sonnet-5-5', B = 'claude-haiku-5-5'
// 1M 토큰당 달러(입력, 출력) — 외부 가격표 기준. 실제 청구는 Claude Console이 기준.
const PRICE = { [A]: [2, 10], [B]: [0.1, 0.5] }
const SEARCH_USD = 0.01
if (!SUPABASE_DB_URL || !ANTHROPIC_API_KEY) { console.error('SUPABASE_DB_URL, ANTHROPIC_API_KEY 필요'); process.exit(1) }

const cost = { [A]: 0, [B]: 0 }
async function call(model, body) {
  const r = await fetch('https://api.anthropic.com/v1/messages', {
    method: 'POST',
    headers: { 'x-api-key': ANTHROPIC_API_KEY, 'anthropic-version': '2023-06-01', 'content-type': 'application/json' },
    body: JSON.stringify({ model, ...body }),
  })
  if (!r.ok) throw new Error(`${model} HTTP ${r.status}: ${(await r.text()).slice(0, 200)}`)
  const j = await r.json()
  const u = j.usage || {}
  cost[model] += ((u.input_tokens || 0) * PRICE[model][0] + (u.output_tokens || 0) * PRICE[model][1]) / 1e6
    + (u.server_tool_use?.web_search_requests || 0) * SEARCH_USD
  return j
}
const textOf = (j) => (j.content || []).filter((c) => c.type === 'text').map((c) => c.text).join('')

async function classify(model, lines, source) {
  const j = await call(model, { max_tokens: 3000, messages: [{ role: 'user', content: buildPrompt(lines, source) }] })
  const m = textOf(j).match(/\{[\s\S]*\}/)
  let raw = {}
  try { raw = m ? JSON.parse(m[0]) : {} } catch { raw = {} }
  return guardAiResult(raw, { lines, source })
}
async function web(model, job) {
  const j = await call(model, { max_tokens: 1500, tools: [{ type: 'web_search_20250305', name: 'web_search', max_uses: 3 }],
    messages: [{ role: 'user', content: buildWebPrompt(job) }] })
  const texts = (j.content || []).filter((b) => b.type === 'text')
  const citations = texts.flatMap((b) => b.citations ?? []).map((c) => ({ url: c.url, cited_text: c.cited_text }))
  const m = texts.map((b) => b.text).join('').match(/\{[^{}]*\}(?![\s\S]*\{)/)
  let answer = null
  try { answer = m ? JSON.parse(m[0]) : null } catch { answer = null }
  const found = guardWebAnswer(job, answer, citations)
  return found ? `${found.kind ?? ''}/${found.code}` : `없음(${answer?.type ?? '-'})`
}

const client = new pg.Client({ connectionString: SUPABASE_DB_URL })
await client.connect()
let rows
try {
  await client.query('begin read only')
  rows = (await client.query(`
    select id, title, company, location, images, source_text, ocr_text,
           coalesce(ocr_check->'detail_fill'->'unclassified', '[]'::jsonb) as unclassified
    from public.local_jobs
    where origin in ('crawler','admin') and coalesce(source_text,'') <> '' and ${afterCutoff()}
    order by created_at desc limit $1`, [N])).rows
  await client.query('rollback')
} finally { await client.end() }

const out = [`## AI 비교 시험: Sonnet(지금) vs Haiku(싼 것) — 공고 ${rows.length}건`, '',
  '### ① 복리후생·칸 판정', '| 공고 | 복리후생 Sonnet | 복리후생 Haiku | 칸 판정 일치 | 결과 |', '|---|---|---|---|---|']
let same = 0, total = 0
for (const job of rows) {
  const source = [job.source_text, job.ocr_text].filter(Boolean).join('\n')
  const lines = (job.unclassified || []).filter(Boolean)
  try {
    const [a, b] = await Promise.all([classify(A, lines, source), classify(B, lines, source)])
    const ba = a.benefits.map((x) => x.code).sort(), bb = b.benefits.map((x) => x.code).sort()
    const ka = new Map(a.kinds.map((k) => [k.line, k.section]))
    const kSame = b.kinds.filter((k) => ka.get(k.line) === k.section).length
    const kTotal = Math.max(a.kinds.length, b.kinds.length)
    const ok = ba.join() === bb.join() && kSame === kTotal
    total++; if (ok) same++
    out.push(`| #${job.id} | ${ba.join(', ') || '-'} | ${bb.join(', ') || '-'} | ${kTotal ? `${kSame}/${kTotal}` : '줄 없음'} | ${ok ? '같음' : '**다름**'} |`)
  } catch (e) { out.push(`| #${job.id} | 오류 | ${String(e.message).slice(0, 80)} | | |`) }
}
out.push('', `같음 ${same}/${total}`, '', '### ② 회사 업종 인터넷 검색', '| 공고 | 회사 | Sonnet | Haiku | 결과 |', '|---|---|---|---|---|')
let wSame = 0, wTotal = 0
for (const job of rows.filter((j) => j.company && streetOf(j.location)).slice(0, M)) {
  try {
    const [a, b] = await Promise.all([web(A, job), web(B, job)])
    wTotal++; if (a === b) wSame++
    out.push(`| #${job.id} | ${String(job.company).slice(0, 30)} | ${a} | ${b} | ${a === b ? '같음' : '**다름**'} |`)
  } catch (e) { out.push(`| #${job.id} | 오류 | ${String(e.message).slice(0, 80)} | | |`) }
}
out.push('', `같음 ${wSame}/${wTotal}`, '',
  `### 이번 시험 비용 (토큰 사용량 × 외부 가격표, 추정)`,
  `- Sonnet: $${cost[A].toFixed(4)} / Haiku: $${cost[B].toFixed(4)}`,
  `- 공고 1건당 Sonnet: $${(cost[A] / Math.max(1, total)).toFixed(4)} / Haiku: $${(cost[B] / Math.max(1, total)).toFixed(4)}`,
  '', '운영 DB 쓰기 없음(읽기 전용 트랜잭션).')
const md = out.join('\n')
console.log(md)
if (process.env.OUT) writeFileSync(process.env.OUT, md)
