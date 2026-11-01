// 업종으로 큰 분류 정하기 실행기 — Lee 2026-11-01 (#5247 Wallace). 규칙: src/lib/businessType.ts
// 대상: 기준 시각 이후 수집 공고 중 직업 코드가 없는 공고(관리자 숨김 제외). 같은 원문으로 이미 시도했으면 다시 하지 않는다.
// 기록: 직업 코드·근거는 ingest_job 한 입구로, 판단 출처(이름/검색 URL·인용문)는 ocr_check.business_type에.
// 필요 환경변수: SUPABASE_DB_URL (검색에는 ANTHROPIC_API_KEY — 없으면 이름 단계만)
import pg from 'pg'
import { businessFromName, buildWebPrompt, guardWebAnswer, streetOf } from '../../src/lib/businessType.ts'
import { afterCutoff } from '../ops/auto-cutoff.mjs'

const { SUPABASE_DB_URL, ANTHROPIC_API_KEY } = process.env
const MODEL = process.env.BUSINESS_AI_MODEL || 'claude-sonnet-5-5'
if (!SUPABASE_DB_URL) { console.error('SUPABASE_DB_URL 필요'); process.exit(1) }

async function webLookup(job) {
  const r = await fetch('https://api.anthropic.com/v1/messages', {
    method: 'POST',
    headers: { 'x-api-key': ANTHROPIC_API_KEY, 'anthropic-version': '2023-06-01', 'content-type': 'application/json' },
    body: JSON.stringify({ model: MODEL, max_tokens: 1500, tools: [{ type: 'web_search_20250305', name: 'web_search', max_uses: 3 }],
      messages: [{ role: 'user', content: buildWebPrompt(job) }] }),
  })
  if (!r.ok) throw new Error(`검색 AI ${r.status}: ${(await r.text()).slice(0, 200)}`)
  const body = await r.json()
  const texts = body.content.filter((b) => b.type === 'text')
  const citations = texts.flatMap((b) => b.citations ?? []).map((c) => ({ url: c.url, cited_text: c.cited_text }))
  const joined = texts.map((b) => b.text).join('')
  const m = joined.match(/\{[\s\S]*\}/)
  let answer = null
  try { answer = m ? JSON.parse(m[0]) : null } catch { answer = null }
  return { answer, citations }
}

const client = new pg.Client({ connectionString: SUPABASE_DB_URL })
await client.connect()
let set = 0, none = 0
try {
  const { rows } = await client.query(`
    select id, title, company, location, source_text, images, md5(coalesce(source_text,'') || '|' || coalesce(company,'') || '|' || coalesce(location,'')) as src_hash,
           ocr_check->'business_type'->>'src_hash' as tried
    from public.local_jobs
    where origin = 'crawler' and not admin_hidden and occupation_code is null and coalesce(source_text,'') <> ''
      and ${afterCutoff()}
    order by id`)
  console.log(`업종 확인 대상 ${rows.length}건`)
  for (const job of rows) {
    if (job.tried === job.src_hash) continue
    let found = businessFromName(job)
    let note = found ? 'name' : 'name:none'
    if (!found && ANTHROPIC_API_KEY && streetOf(job.location)) {
      try {
        const { answer, citations } = await webLookup(job)
        found = guardWebAnswer(job, answer, citations)
        note = found ? 'web' : `web:none(${answer?.type ?? 'no-answer'}, 인용 ${citations.length})`
      } catch (e) { note = 'web:error ' + String(e.message).slice(0, 120) }
    } else if (!found) note += streetOf(job.location) ? ' web:no-key' : ' web:no-street'
    const record = { src_hash: job.src_hash, at: new Date().toISOString(), result: note, ...(found ?? {}) }
    if (found) {
      const payload = { channel: 'crawler_other', job_id: job.id, refresh: true, update_fields: ['occupation_code', 'occupation_evidence'],
        source_text: job.source_text, images: job.images, occupation_code: found.code, occupation_evidence: found.evidence }
      const w = await client.query('select public.ingest_job($1::jsonb) as job_id', [JSON.stringify(payload)])
      if (Number(w.rows[0]?.job_id) !== Number(job.id)) throw new Error('ingest_job returned wrong id')
      set++
    } else none++
    await client.query(`update public.local_jobs set ocr_check = coalesce(ocr_check,'{}'::jsonb) || jsonb_build_object('business_type', $2::jsonb) where id = $1`,
      [job.id, JSON.stringify(record)])
    console.log(`#${job.id} 업종: ${note}${found ? ` → ${found.code} (${found.duty})${found.url ? ' ' + found.url : ''}` : ''}`)
  }
  console.log(`업종 확인: 정함 ${set} · 못 정함 ${none}`)
} finally { await client.end() }
