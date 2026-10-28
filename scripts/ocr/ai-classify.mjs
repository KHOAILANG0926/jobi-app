// AI 칸·복리후생 판정 실행기(2026-10-25 Lee 결정). job-ocr-check.yml에서 상세요강 만들기(detail-fill) 앞에 실행.
// ① 단어 규칙이 칸을 못 정한 줄(지난 실행의 detail_fill.unclassified) 중 아직 번호표가 없는 줄 → AI가 01~07 중 고름 → detail_line_kinds에 저장
//    (같은 줄은 다음부터 AI 없이 바로 그 칸. Lee가 정한 줄은 AI가 못 바꿈)
// ② 원문이 바뀐 공고 → AI가 복리후생 번호표 고름(근거는 원문 글자 그대로) → job_ai_suggestions에 제안 저장, 원문 규칙도 같은 뜻인 칸만 공고에 "있음" 기록(Lee 2026-10-28)
//    (없다고 단정하지 않는다: false로 바꾸지 않음)
// AI 답은 aiClassifyGuard.ts가 검사(목록 밖·준 적 없는 줄·원문에 없는 근거·부정 문장 버림). 필요: SUPABASE_DB_URL, ANTHROPIC_API_KEY
import pg from 'pg'
import { createHash } from 'node:crypto'
import { buildPrompt, guardAiResult, lineKey, BENEFIT_CODES, ruleConfirmedFlags } from '../../src/lib/aiClassifyGuard.ts'

const { SUPABASE_DB_URL, ANTHROPIC_API_KEY } = process.env
const MODEL = process.env.CLASSIFY_AI_MODEL || 'claude-sonnet-5-5'
if (!SUPABASE_DB_URL) { console.error('SUPABASE_DB_URL 필요'); process.exit(1) }
if (!ANTHROPIC_API_KEY) { console.log('::warning::ANTHROPIC_API_KEY 없음 — AI 판정 건너뜀'); process.exit(0) }

async function ask(prompt) {
  const r = await fetch('https://api.anthropic.com/v1/messages', {
    method: 'POST',
    headers: { 'x-api-key': ANTHROPIC_API_KEY, 'anthropic-version': '2023-06-01', 'content-type': 'application/json' },
    body: JSON.stringify({ model: MODEL, max_tokens: 3000, messages: [{ role: 'user', content: prompt }] }),
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
    select id, source_text, ocr_text, description, shuttle_bus, dormitory, meal_provided, benefit_tags,
           coalesce(ocr_check->'detail_fill'->'unclassified', '[]'::jsonb) as unclassified,
           ocr_check->'benefits_ai'->>'hash' as benefits_hash
    from public.local_jobs
    where origin in ('crawler','admin') and coalesce(source_text, '') <> ''
    order by id`)
  for (const job of rows) {
    const source = [job.source_text, job.ocr_text].filter(Boolean).join('\n')
    const hash = createHash('md5').update(MODEL + '|' + JSON.stringify(BENEFIT_CODES) + '|' + source).digest('hex')
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
        // 수집 입구 결정(Lee 2026-10-28 ②): AI 판정은 job_ai_suggestions에 제안으로 저장한다.
        // 공고 칸은 원문 단어 규칙도 같은 뜻으로 읽은 3개 칸(셔틀·기숙사·식사)만 켜고, 복수직무 식사는 켜지 않는다.
        // 번호표만 있는 복리후생(benefit_tags)은 제안으로만 남긴다(Lee 선택 시 반영).
        const flags = ruleConfirmedFlags(g.benefits, job.description)
        const roles = new Set(String(job.description ?? '').split(/\r?\n/).map((l) => (l.match(/^(.+\s+(?:full|part)[ -]?time)\s+—/i) || [])[1]).filter(Boolean))
        for (const b of g.benefits) {
          const applied = flags.includes(b.code)
          await client.query(
            `insert into public.job_ai_suggestions(job_id, field, value, evidence, role, model, status)
             values ($1, $2, 'true'::jsonb, $3, $4, $5, $6)
             on conflict (job_id, field, evidence) do update set model = excluded.model, status = excluded.status, created_at = now()`,
            [job.id, b.code, b.evidence, roles.size >= 2 ? 'multi_role' : null, MODEL, applied ? 'applied_by_rule' : 'suggested'])
        }
        const sets = flags.map((c) => `${FLAG[c]} = true`)
        await client.query(
          `update public.local_jobs set ${sets.length ? sets.join(', ') + ',' : ''}
             ocr_check = coalesce(ocr_check, '{}'::jsonb) || jsonb_build_object('benefits_ai', jsonb_build_object('hash', $2::text, 'model', $3::text, 'found', $4::jsonb, 'applied', $5::jsonb, 'checked_at', now()))
           where id = $1`,
          [job.id, hash, MODEL, JSON.stringify(g.benefits), JSON.stringify(flags)])
        benefits += g.benefits.length
      }
      console.log(`#${job.id} 칸 ${g.kinds.length}줄 · 복리후생 ${needBenefits ? g.benefits.map((b) => b.code).join(',') || '없음' : '(그대로)'}`)
    } catch (e) {
      failed++
      console.log(`::warning::#${job.id} AI 판정 실패: ${String(e.message).slice(0, 300)}`)
    }
  }
} finally {
  await client.end()
}
console.log(`::notice::AI 판정 완료: 줄 칸 ${kinds} · 복리후생 ${benefits} · 실패 ${failed}`)
