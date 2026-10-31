// R7 실행기: images가 있는데 아직 OCR 대조를 안 했거나 images가 바뀐 공고를 찾아
// Supabase Storage에서 이미지를 받아 독립 AI 판독자(ai-reader.mjs, 결정 0004)로 읽고, ocr_text·ocr_check를 쓰고, 어긋나면 그 공고만 active=false(보류).
// GitHub Actions(.github/workflows/job-ocr-check.yml)에서만 실행. PC에 이미지·키를 저장하지 않는다(임시 폴더만 사용).
// 필요 환경변수: SUPABASE_DB_URL, SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY(비공개 bucket 다운로드용)
import pg from 'pg'
import { createHash } from 'node:crypto'
import { mkdtempSync, writeFileSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { compareWithOcr, canRepublish } from './ocr-compare.mjs'
import { readImageAI, READER_ID } from './ai-reader.mjs'

const { SUPABASE_DB_URL, SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY } = process.env
if (!SUPABASE_DB_URL || !SUPABASE_URL) { console.error('SUPABASE_DB_URL / SUPABASE_URL 필요'); process.exit(1) }
const BUCKET = 'job-images'

function imageUrls(images) {
  if (!Array.isArray(images)) return []
  return images.map((x) => (typeof x === 'string' ? x : x?.url ?? x?.path ?? null)).filter(Boolean).map((u) =>
    /^https?:\/\//.test(u) ? u : `${SUPABASE_URL.replace(/\/$/, '')}/storage/v1/object/${BUCKET}/${u.replace(/^\/+/, '')}`)
}

async function download(url) {
  const headers = SUPABASE_SERVICE_ROLE_KEY && url.startsWith(SUPABASE_URL) ? { Authorization: `Bearer ${SUPABASE_SERVICE_ROLE_KEY}` } : {}
  const r = await fetch(url, { headers })
  if (!r.ok) throw new Error(`이미지 다운로드 HTTP ${r.status}`)
  return Buffer.from(await r.arrayBuffer())
}

const client = new pg.Client({ connectionString: SUPABASE_DB_URL })
await client.connect()
const { rows } = await client.query(`
  select id, images, employer_phone, contact_zalo, salary, contact_name, company, age_min, age_max, active,
    occupation_code, occupation_evidence, source_text,
    origin, publish_gate_reason, admin_hidden, created_at, application_deadline
  from public.local_jobs
  where origin in ('crawler','admin') and jsonb_typeof(images) = 'array' and jsonb_array_length(images) > 0
    and (created_at >= '2026-10-13' or active = false)   -- 기존 공개 공고를 일괄 보류하지 않는다
    and (ocr_check is null or ocr_check->>'images_hash' is distinct from md5(images::text)
         -- 판독자가 바뀌면(결정 0004: AI 독립 판독 ai-v1) 예전 판독자로 보류된 공고를 한 번 다시 읽는다
         or (ocr_check->>'status' in ('mismatch','unreadable') and ocr_check->>'reader' is distinct from 'ai-v1')
         or ocr_check->>'compared_hash' is distinct from md5(to_jsonb(array[
           employer_phone, contact_zalo, salary, contact_name, company,
           age_min::text, age_max::text
         ])::text))
  order by id limit 50`)
console.log(`OCR 대상 ${rows.length}건`)

const dir = mkdtempSync(join(tmpdir(), 'ocr-'))
let ok = 0, held = 0, failed = 0
try {
  for (const job of rows) {
    try {
      const texts = []
      for (const [i, url] of imageUrls(job.images).entries()) {
        const f = join(dir, `${job.id}-${i}`)
        writeFileSync(f, await download(url))
        texts.push(await readImageAI(f))   // 독립 AI 판독(결정 0004). 입력값은 보내지 않는다
      }
      const text = texts.join('\n')
      const res = compareWithOcr(job, text)
      const check = { status: res.status, reader: READER_ID, checked_at: new Date().toISOString(), images_hash: createHash('md5').update(JSON.stringify(job.images)).digest('hex'), mismatches: res.mismatches }
      // images_hash는 DB의 md5(images::text)와 같아야 재처리 루프가 생기지 않으므로 DB에서 계산한다.
      const hold = res.status === 'mismatch'
      await client.query(
        `update public.local_jobs set ocr_text = $2, ocr_check = jsonb_set(
          jsonb_set($3::jsonb, '{images_hash}', to_jsonb(md5(images::text))),
          '{compared_hash}', to_jsonb(md5(to_jsonb(array[
            employer_phone, contact_zalo, salary, contact_name, company,
            age_min::text, age_max::text
          ])::text))) ${hold ? ', active = false' : ''} where id = $1`,
        [job.id, text, JSON.stringify(check)])
      if (hold) { held++; console.log(`보류 #${job.id}: ${res.mismatches.map((m) => m.field).join(', ')}`); console.log(`::warning title=R7 보류 #${job.id}::불일치 항목 ${res.mismatches.map((m) => m.field).join(', ')}`) } else ok++
      // OCR 'ok' → OCR 단계에서 공개로 되돌린다(기존 공개 조건 통과분만). 정책 판정(R4)은 DB 트리거가 강제:
      // 제외 대상이면 저장이 거부되고, 검토 대상이면 active=false로 남는다 → 어느 쪽이든 비공개 유지.
      if (res.status === 'ok' && !job.active && canRepublish(job)) {
        let note
        try {
          const r = await client.query('update public.local_jobs set active = true where id = $1 returning active', [job.id])
          note = r.rows[0].active ? 'published' : 'kept_hidden_by_trigger'
        } catch (e) {
          note = /job_posting_policy_excluded/.test(e.message) ? 'kept_hidden_policy_excluded' : /job_rule_/.test(e.message) ? 'kept_hidden_rule_violation' : 'kept_hidden_error'
        }
        await client.query(`update public.local_jobs set ocr_check = ocr_check || jsonb_build_object('publish', $2::text) where id = $1`, [job.id, note])
        console.log(`재공개 판정 #${job.id}: ${note}`)
      }
    } catch (e) {
      failed++
      console.error(`#${job.id} 실패: ${e.message}`)   // 다음 실행에서 다시 시도한다(ocr_check를 쓰지 않음)
    }
  }
} finally {
  rmSync(dir, { recursive: true, force: true })
  await client.end()
}
console.log(`OCR 완료: 통과/읽기불가 ${ok} · 보류 ${held} · 실패 ${failed}`)
if (failed) process.exit(2)
