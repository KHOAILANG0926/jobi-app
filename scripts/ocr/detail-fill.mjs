// 상세요강 빠진 줄 자동 보충 실행기(2026-10-20 Lee 결정). GitHub Actions(job-ocr-check.yml)에서 OCR 대조 바로 뒤에 실행.
// 원문(source_text) + AI 판독 포스터 글자(ocr_text, reader=ai-v1만)에 있는데 공고 글(description)에 없는 줄을
// 원문 글자 그대로 맞는 칸에 붙인다. 공개를 막지 않는다. 칸을 못 정한 줄은 07에 넣고 ocr_check.detail_fill.unclassified에 남긴다
// → 매일 예약 점검이 Lee에게 알리고, Lee가 칸을 정하면 KIND_RULES에 새 규정으로 추가한 뒤 이 실행기가 다시 옮긴다.
// 필요 환경변수: SUPABASE_DB_URL
import pg from 'pg'
import { createHash } from 'node:crypto'
import { readFileSync } from 'node:fs'
import { fillMissingLines, KIND_RULES } from '../../src/lib/jobDetailFill.ts'
import { buildDescriptionFromSources } from '../../src/lib/jobDescriptionBuild.ts'
import { salaryFromSource } from '../../src/lib/sourceSalary.ts'

const { SUPABASE_DB_URL } = process.env
if (!SUPABASE_DB_URL) { console.error('SUPABASE_DB_URL 필요'); process.exit(1) }
// 규정(KIND_RULES)이 바뀌면 이 값이 저절로 바뀐다 → 모든 공고를 한 번 다시 보고 07에 있던 줄을 정한 칸으로 옮긴다.
// 2026-10-25: 원문이 있는 공고는 상세요강을 원문에서 기계가 다시 만든다(jobDescriptionBuild.ts) — 규칙 파일이 바뀌면 값이 바뀌어 전부 다시 만든다.
const RULE_FILES = ['jobDescriptionBuild.ts', 'jobDetailFill.ts', 'jobDetailSections.ts'].map((f) => readFileSync(new URL(`../../src/lib/${f}`, import.meta.url), 'utf8'))
const RULE_HASH = JSON.stringify(KIND_RULES.map((r) => [r.id, r.re.source, r.key])) + RULE_FILES.join('\n')
const BACKUP_REASON = 'rebuild-from-source-20261025'

const client = new pg.Client({ connectionString: SUPABASE_DB_URL })
await client.connect()
// 저장된 줄 번호표(AI·Lee가 정한 칸). 바뀌면 FILL_VERSION이 바뀌어 전부 다시 만든다.
const kindRows = await client.query('select line_key, section, decided_by from public.detail_line_kinds order by line_key').then((r) => r.rows, () => [])
const LINE_KINDS = Object.fromEntries(kindRows.map((r) => [r.line_key, { section: r.section, by: r.decided_by }]))
export const FILL_VERSION = 'fill-v3:' + createHash('md5').update(RULE_HASH + JSON.stringify(kindRows)).digest('hex').slice(0, 8)
const HASH = `md5(coalesce(description,'') || '|' || coalesce(source_text,'') || '|' || coalesce(ocr_text,'') || '|${FILL_VERSION}')`
let changed = 0, same = 0, failed = 0
try {
  const { rows } = await client.query(`
    select j.id, j.title, j.company, j.salary, j.salary_period, j.age_requirement, j.gender_requirement, j.education, j.preference, j.num_hires, j.language_requirement, j.required_documents, j.hours, j.work_days, j.employer_phone, j.contact_zalo, j.location, j.description, j.source_text, j.ocr_check->'detail_fill'->>'block' as prev_block,
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
      // 2026-10-25: 위쪽 급여 칸이 비어 있으면 원문 급여를 글자 그대로 채운다(#4879). 계산·추정 없음.
      if (!String(job.salary ?? '').trim()) {
        const sal = salaryFromSource(job.source_text)
        if (sal) {
          await client.query(`update public.local_jobs set salary = $2, salary_period = coalesce(salary_period, $3) where id = $1`, [job.id, sal.salary, sal.period])
          job.salary = sal.salary
          console.log(`#${job.id} 급여 칸 채움(원문): ${sal.salary}`)
        }
      }
      const current = String(job.description ?? '')
      const ctx = { title: job.title, company: job.company, salary: job.salary,
        values: [job.age_requirement, job.gender_requirement, job.education, job.preference, job.num_hires, job.language_requirement, job.required_documents],
        valueGroups: [[job.hours, job.work_days]], lineKinds: LINE_KINDS, phones: [job.employer_phone, job.contact_zalo], addresses: [job.location, ...job.addresses] }
      const sources = [{ name: 'source_text', text: job.source_text }, { name: 'ocr_text', text: job.ocr_text }]
      let next = current, record
      if (String(job.source_text ?? '').trim()) {
        // 원문이 있으면: AI가 쓴 글을 쓰지 않고 원문에서 다시 만든다(글자 그대로, 화면 글자·중복·위쪽 정보 반복 제거).
        const b = buildDescriptionFromSources(sources, ctx)
        if (b.description.trim()) next = b.description
        record = { mode: 'rebuild', version: FILL_VERSION, checked_at: new Date().toISOString(),
          unclassified: b.unclassified.map((u) => u.line), still_missing: [],
          dropped: b.dropped.map(({ line, reason }) => ({ line, reason })) }
        if (next !== current) {
          // 처음 한 번만 원래 글을 보관(되돌릴 수 있게). 공개 접근 없는 백업 표.
          await client.query(
            `insert into public.local_jobs_description_backup(job_id, description, reason)
             select $1, $2, $3 where not exists (select 1 from public.local_jobs_description_backup where job_id = $1 and reason = $3)`,
            [job.id, current, BACKUP_REASON])
        }
      } else {
        // 원문이 없으면(직접 등록 공고): 예전처럼 빠진 줄만 보충. 예전에 붙인 부분은 떼고 다시 계산한다.
        const base = job.prev_block && current.endsWith(job.prev_block) ? current.slice(0, -job.prev_block.length) : current
        const r = fillMissingLines(base, sources, ctx)
        next = r.description
        record = { mode: 'fill', version: FILL_VERSION, checked_at: new Date().toISOString(),
          added: r.added.map(({ line, key, how, rule }) => ({ line, key, how, rule })),
          unclassified: r.unclassified.map((u) => u.line), still_missing: r.stillMissing,
          block: r.description.slice(base.replace(/\s+$/, '').length) }
        if (r.stillMissing.length) console.log(`::warning::#${job.id} 붙인 뒤에도 빠진 줄 ${r.stillMissing.length} — 코드 수정 필요`)
      }
      const descChanged = next !== current
      // hash는 바뀐 description 기준으로 DB에서 계산(다음 실행에서 같은 공고를 다시 처리하지 않도록). AI가 글을 다시 고치면 hash가 달라져 다시 만든다.
      await client.query(
        `update public.local_jobs set description = $2,
           ocr_check = coalesce(ocr_check, '{}'::jsonb) || jsonb_build_object('detail_fill', $3::jsonb || jsonb_build_object('hash',
             md5(coalesce($2,'') || '|' || coalesce(source_text,'') || '|' || coalesce(ocr_text,'') || '|${FILL_VERSION}')))
         where id = $1`,
        [job.id, next, JSON.stringify(record)])
      if (descChanged) { changed++; console.log(`#${job.id} ${record.mode === 'rebuild' ? '원문에서 다시 만듦' : '빠진 줄 보충'} (새 종류 ${record.unclassified.length})`) } else same++
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
