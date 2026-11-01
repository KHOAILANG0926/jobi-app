// 자동 수리 실행기(2026-11-01 Lee). 검사표 실패 칸 중 고칠 수 있는 칸(company·salary)만 AI가 원문에서 값을 찾아 제안,
// src/lib/jobRepair.ts가 원문 글자 그대로인지 확인한 값만 고친다. 고치면 다음 검사(job-inspect)가 다시 판정한다.
// REPAIR_MODE=preview: 아무것도 쓰지 않고 제안만 출력(Lee 확인용). apply: 고침 + ocr_check.repair 기록.
// 필요: SUPABASE_DB_URL, ANTHROPIC_API_KEY
import pg from 'pg'
import { appendFileSync } from 'node:fs'
import { REPAIRABLE, buildRepairPrompt, guardRepair } from '../../src/lib/jobRepair.ts'

const { SUPABASE_DB_URL, ANTHROPIC_API_KEY, GITHUB_STEP_SUMMARY } = process.env
const MODE = process.env.REPAIR_MODE === 'apply' ? 'apply' : 'preview'
const MODEL = process.env.REPAIR_AI_MODEL || 'claude-sonnet-5-5'
if (!SUPABASE_DB_URL) { console.error('SUPABASE_DB_URL 필요'); process.exit(1) }
if (!ANTHROPIC_API_KEY) { console.log('::warning::ANTHROPIC_API_KEY 없음 — 자동 수리 건너뜀'); process.exit(0) }

async function ask(prompt) {
  const r = await fetch('https://api.anthropic.com/v1/messages', {
    method: 'POST',
    headers: { 'x-api-key': ANTHROPIC_API_KEY, 'anthropic-version': '2023-06-01', 'content-type': 'application/json' },
    body: JSON.stringify({ model: MODEL, max_tokens: 800, messages: [{ role: 'user', content: prompt }] }),
  })
  if (!r.ok) throw new Error(`AI HTTP ${r.status}: ${(await r.text()).slice(0, 200)}`)
  const text = ((await r.json()).content || []).filter((c) => c.type === 'text').map((c) => c.text).join('')
  const m = text.match(/\{[\s\S]*\}/)
  return m ? JSON.parse(m[0]) : {}
}

const client = new pg.Client({ connectionString: SUPABASE_DB_URL })
await client.connect()
const report = [`## 자동 수리 (${MODE === 'preview' ? '미리 보기 — 아무것도 바꾸지 않음' : '적용'})`, '', '| 공고 | 칸 | 지금 값 | 고칠 값 | 근거(원문) |', '|---|---|---|---|---|']
let fixed = 0, failed = 0
try {
  const { rows } = await client.query(`
    select id, title, company, salary, source_text, ocr_text,
           (select array_agg(i->>'key') from jsonb_array_elements(coalesce(ocr_check->'inspect'->'items','[]'::jsonb)) i
            where not (i->>'ok')::boolean) as failed_keys,
           ocr_check->'repair'->>'source_hash' as prev_hash, md5(coalesce(source_text,'') || coalesce(ocr_text,'')) as source_hash
    from public.local_jobs
    where origin in ('crawler','admin') and not admin_hidden and coalesce(source_text,'') <> ''
    order by id`)
  for (const job of rows) {
    const fields = [...new Set((job.failed_keys ?? []).map((k) => REPAIRABLE[k]).filter(Boolean))]
    if (!fields.length) continue
    if (MODE === 'apply' && job.prev_hash === job.source_hash) continue   // 같은 원문으로 이미 시도함(실패면 관리자 확인으로)
    try {
      const g = guardRepair(job, fields, await ask(buildRepairPrompt(job, fields)))
      for (const r of g.rejected) { console.log(`#${job.id} 버림 — ${r}`); report.push(`| #${job.id} | ${r.split(':')[0]} | — | (못 고침) | ${r} |`) }
      for (const p of g.proposals) report.push(`| #${job.id} | ${p.field} | ${p.from || '(비어 있음)'} | ${p.to} | ${p.evidence} |`)
      if (MODE === 'apply') {
        const set = Object.fromEntries(g.proposals.map((p) => [p.field, p.to]))
        const record = { source_hash: job.source_hash, at: new Date().toISOString(), model: MODEL, proposals: g.proposals, rejected: g.rejected }
        await client.query(`update public.local_jobs set
            company = coalesce($2, company), salary = coalesce($3, salary),
            ocr_check = coalesce(ocr_check,'{}'::jsonb) || jsonb_build_object('repair', $4::jsonb)
          where id = $1`, [job.id, set.company ?? null, set.salary ?? null, JSON.stringify(record)])
        fixed += g.proposals.length
      }
      console.log(`#${job.id} 제안 ${g.proposals.length} · 버림 ${g.rejected.length}`)
    } catch (e) { failed++; console.error(`#${job.id} 실패: ${e.message}`) }
  }
} finally { await client.end() }
if (report.length === 4) report.push('| — | — | — | 고칠 공고 없음 | — |')
console.log(report.join('\n'))
if (GITHUB_STEP_SUMMARY) appendFileSync(GITHUB_STEP_SUMMARY, report.join('\n') + '\n')
console.log(`자동 수리 ${MODE}: 고침 ${fixed} · 실패 ${failed}`)
