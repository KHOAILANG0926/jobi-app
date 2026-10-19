// 상세요강 빠진 줄 자동 보충 실행기(2026-10-20 Lee 결정). GitHub Actions(job-ocr-check.yml)에서 OCR 대조 바로 뒤에 실행.
// 원문(source_text) + AI 판독 포스터 글자(ocr_text, reader=ai-v1만)에 있는데 공고 글(description)에 없는 줄을
// 원문 글자 그대로 맞는 칸에 붙인다. 공개를 막지 않는다. 칸을 못 정한 줄은 07에 넣고 ocr_check.detail_fill.unclassified에 남긴다
// → 매일 예약 점검이 Lee에게 알리고, Lee가 칸을 정하면 KIND_RULES에 새 규정으로 추가한 뒤 이 실행기가 다시 옮긴다.
// 필요 환경변수: SUPABASE_DB_URL
import pg from 'pg'
import { createHash } from 'node:crypto'
import { fillMissingLines, KIND_RULES } from '../../src/lib/jobDetailFill.ts'

const { SUPABASE_DB_URL } = process.env
if (!SUPABASE_DB_URL) { console.error('SUPABASE_DB_URL 필요'); process.exit(1) }
// 규정(KIND_RULES)이 바뀌면 이 값이 저절로 바뀐다 → 모든 공고를 한 번 다시 보고 07에 있던 줄을 정한 칸으로 옮긴다.
export const FILL_VERSION = 'fill-v1:' + createHash('md5').update(JSON.stringify(KIND_RULES.map((r) => [r.id, r.re.source, r.key]))).digest('hex').slice(0, 8)

const HASH = `md5(coalesce(description,'') || '|' || coalesce(source_text,'') || '|' || coalesce(ocr_text,'') || '|${FILL_VERSION}')`
const client = new pg.Client({ connectionString: SUPABASE_DB_URL })
await client.connect()
let changed = 0, same = 0, failed = 0
try {
  const { rows } = await client.query(`
    select j.id, j.title, j.company, j.employer_phone, j.contact_zalo, j.location, j.description, j.source_text, j.ocr_check->'detail_fill'->>'block' as prev_block,
           case when j.ocr_check->>'reader' = 'ai-v1' then j.ocr_text end as ocr_text,
           coalesce((select array_agg(w.raw_address) from public.job_work_locations w where w.job_id = j.id), '{}') as addresses
    from public.local_jobs j
    where j.origin in ('crawler','admin')
      and (jsonb_typeof(j.images) is distinct from 'array' or jsonb_array_length(j.images) = 0 or j.ocr_check->>'status' is not null)
      and (j.ocr_check->'detail_fill'->>'hash') is distinct from ${HASH.replace(/\b(description|source_text|ocr_text)\b/g, 'j.$1')}
    order by j.id limit 200`)
  console.log(`보충 검사 대상 ${rows.length}건`)
  for (const job of rows) {
    try {
      // 예전에 붙인 부분은 떼고 다시 계산한다 → Lee가 새 규정을 정하면(FILL_VERSION 올림) 07에 있던 줄이 정한 칸으로 옮겨진다.
      const current = String(job.description ?? '')
      const base = job.prev_block && current.endsWith(job.prev_block) ? current.slice(0, -job.prev_block.length) : current
      const r = fillMissingLines(base,
        [{ name: 'source_text', text: job.source_text }, { name: 'ocr_text', text: job.ocr_text }],
        { title: job.title, company: job.company, phones: [job.employer_phone, job.contact_zalo], addresses: [job.location, ...job.addresses] })
      const record = { version: FILL_VERSION, checked_at: new Date().toISOString(),
        added: r.added.map(({ line, key, how, rule }) => ({ line, key, how, rule })),
        unclassified: r.unclassified.map((u) => u.line), still_missing: r.stillMissing,
        block: r.description.slice(base.replace(/\s+$/, '').length) }
      const descChanged = r.description !== current
      // hash는 바뀐 description 기준으로 DB에서 계산(다음 실행에서 같은 공고를 다시 붙이지 않도록).
      await client.query(
        `update public.local_jobs set description = $2,
           ocr_check = coalesce(ocr_check, '{}'::jsonb) || jsonb_build_object('detail_fill', $3::jsonb || jsonb_build_object('hash',
             md5(coalesce($2,'') || '|' || coalesce(source_text,'') || '|' || coalesce(ocr_text,'') || '|${FILL_VERSION}')))
         where id = $1`,
        [job.id, descChanged ? r.description : job.description, JSON.stringify(record)])
      if (descChanged) { changed++; console.log(`#${job.id} 보충 ${r.added.length}줄 (새 종류 ${r.unclassified.length})`) } else same++
      if (r.stillMissing.length) console.log(`::warning::#${job.id} 붙인 뒤에도 빠진 줄 ${r.stillMissing.length} — 코드 수정 필요`)
    } catch (e) {
      failed++
      console.error(`#${job.id} 실패: ${e.message}`)
    }
  }
} finally {
  await client.end()
}
console.log(`보충 완료: 붙임 ${changed} · 그대로 ${same} · 실패 ${failed}`)
if (failed) process.exit(2)
