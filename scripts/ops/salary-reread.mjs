// 급여 읽기(src/lib/salaryReader.ts)를 바꿀 때, 자동 보충(detail-fill)이 다시 채울 공고의 "지금 급여 / 새 기준 결과"만 보여 준다.
// Lee 2026-11-07: 읽기 전용 — DB를 바꾸지 않는다. 대상은 detail-fill과 같다(수집 공고·기준 시각 이후, 관리자 공고는 빈칸일 때만).
import pg from 'pg'
import { readSalary } from '../../src/lib/salaryReader.ts'
import { afterCutoff } from './auto-cutoff.mjs'

const { SUPABASE_DB_URL } = process.env
if (!SUPABASE_DB_URL) { console.error('SUPABASE_DB_URL 없음'); process.exit(1) }
const client = new pg.Client({ connectionString: SUPABASE_DB_URL })
await client.connect()
const { rows } = await client.query(`
  select j.id, j.origin, j.active, j.salary, j.source_text,
         case when j.ocr_check->>'reader' = 'ai-v1' then j.ocr_text end as ocr_text
    from public.local_jobs j
   where j.origin in ('crawler','admin') and ${afterCutoff('j')}
   order by j.id`)
await client.end()
let same = 0
const out = []
for (const r of rows) {
  if (r.origin !== 'crawler' && String(r.salary ?? '').trim()) continue
  const got = readSalary(r.source_text, r.ocr_text)
  if (!got || got.salary === r.salary) { same++; continue }
  out.push(`- #${r.id}${r.active ? '' : ' (비공개)'} | 지금: ${r.salary || '(빈칸)'} | 새 기준: ${got.salary} (${got.period ?? '-'}) | 근거 줄: ${got.evidence[0]?.slice(0, 80)}`)
}
console.log(`대상 ${rows.length}건: 바뀌지 않음 ${same} · 바뀜 ${out.length}`)
console.log(out.join('\n'))
