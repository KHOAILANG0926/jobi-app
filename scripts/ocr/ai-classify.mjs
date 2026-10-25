// AI 칸·복리후생 판정 실행기(2026-10-25 Lee 결정). job-ocr-check.yml에서 상세요강 만들기(detail-fill) 앞에 실행.
// ① 단어 규칙이 칸을 못 정한 줄(지난 실행의 detail_fill.unclassified) 중 아직 번호표가 없는 줄 → AI가 01~07 중 고름 → detail_line_kinds에 저장
//    (같은 줄은 다음부터 AI 없이 바로 그 칸. Lee가 정한 줄은 AI가 못 바꿈)
// ② 원문이 바뀐 공고 → AI가 복리후생 번호표 고름(근거는 원문 글자 그대로) → 공고 칸(shuttle_bus·dormitory·meal_provided)·benefit_tags에 "있음"만 기록
//    (없다고 단정하지 않는다: false로 바꾸지 않음)
// AI 답은 aiClassifyGuard.ts가 검사(목록 밖·준 적 없는 줄·원문에 없는 근거·부정 문장 버림). 필요: SUPABASE_DB_URL, ANTHROPIC_API_KEY
import pg from 'pg'
import { createHash } from 'node:crypto'
import { buildPrompt, guardAiResult, lineKey, BENEFIT_CODES } from '../../src/lib/aiClassifyGuard.ts'

const { SUPABASE_DB_URL, ANTHROPIC_API_KEY } = process.env
const MODEL = process.env.CLASSIFY_AI_MODEL || 'claude-sonnet-5-5'
if (!SUPABASE_DB_URL) { console.error('SUPABASE_DB_URL 필요'); process.exit(1) }
if (!ANTHROPIC_API_KEY) { console.log('::warning::ANTHROPIC_API_KEY 없음 — AI 판정 건너뜀'); process.exit(0) }

async function ask(prompt) {
  const r = await fetch('https://api.anthropic.com/v1/messages', {
    method: 'POST',
    headers: { 'x-api-key': ANTHROPIC_API_KEY, 'anthropic-version': '2023-06-01', 'content-type': 'application/json' },
    body: JSON.stringify({ model: MODEL, max_tokens: 3000, temperature: 0, messages: [{ role: 'user', content: prompt }] }),
  })
  if (!r.ok) throw new Error(`AI HTTP ${r.status}: ${(await r.text()).slice(0, 200)}`)
  const j = await r.json()
  const text = (j.content || []).filter((c) => c.type === 'text').map((c) => c.text).join('')
  const m = text.match(/\{[\s\S]*\}/)
  return m ? JSON.parse(m[0]) : {}
}

const FLAG = { shuttle_bus: 'shuttle_bus', dormitory: 'dormitory', meal_provided: 'meal_provided' }
const client = new pg.Client({ connectionString: SUPABASE_DB_URL })
await client.connect()
let kinds = 0, benefits = 0, failed = 0
try {
  const known = new Set((await client.query('select line_key from public.detail_line_kinds')).rows.map((r) => r.line_key))
  const { rows } = await client.query(`
    select id, source_text, ocr_text, shuttle_bus, dormitory, meal_provided, benefit_tags,
           coalesce(ocr_check->'detail_fill'->'unclassified', '[]'::jsonb) as unclassified,
           ocr_check->'benefits_ai'->>'hash' as benefits_hash
    from public.local_jobs
    where origin in ('crawler','admin') and coalesce(source_text, '') <> ''
    order by id`)
  for (const job of rows) {
    const source = [job.source_text, job.ocr_text].filter(Boolean).join('\n')
    const hash = createHash('md5').update(MODEL + '|' + source).digest('hex')
    const lines = job.unclassified.filter((l) => l && !known.has(lineKey(l)))
    const needBenefits = job.benefits_hash !== hash
    if (!lines.length && !needBenefits) continue
    try {
      const g = guardAiResult(await ask(buildPrompt(lines, source)), { lines, source })
      for (const r of g.rejected) console.log(`::warning::#${job.id} AI 답 버림 — ${r}`)
      for (const k of g.kinds) {
        await client.query(
          `insert into public.detail_line_kinds(line_key, section, example, decided_by) values ($1, $2, $3, 'ai')
           on conflict (line_key) do update set section = excluded.section, example = excluded.example, decided_by = 'ai'`,
          [lineKey(k.line), k.section, k.line])
        known.add(lineKey(k.line)); kinds++
      }
      if (needBenefits) {
        const flags = Object.keys(FLAG).filter((c) => g.benefits.some((b) => b.code === c))
        const tags = g.benefits.filter((b) => !(b.code in FLAG)).map((b) => BENEFIT_CODES[b.code].label)
        const sets = flags.map((c) => `${FLAG[c]} = true`)
        await client.query(
          `update public.local_jobs set ${sets.length ? sets.join(', ') + ',' : ''}
             benefit_tags = (select array(select distinct unnest(coalesce(benefit_tags, '{}') || $2::text[]))),
             ocr_check = coalesce(ocr_check, '{}'::jsonb) || jsonb_build_object('benefits_ai', jsonb_build_object('hash', $3::text, 'model', $4::text, 'found', $5::jsonb, 'checked_at', now()))
           where id = $1`,
          [job.id, tags, hash, MODEL, JSON.stringify(g.benefits)])
        benefits += g.benefits.length
      }
      console.log(`#${job.id} 칸 ${g.kinds.length}줄 · 복리후생 ${needBenefits ? g.benefits.map((b) => b.code).join(',') || '없음' : '(그대로)'}`)
    } catch (e) {
      failed++
      console.error(`#${job.id} AI 판정 실패: ${e.message}`)
    }
  }
} finally {
  await client.end()
}
console.log(`AI 판정 완료: 줄 칸 ${kinds} · 복리후생 ${benefits} · 실패 ${failed}`)
