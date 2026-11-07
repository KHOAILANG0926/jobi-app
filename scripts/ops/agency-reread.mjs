// 소개소 표시 칸 확인(Lee 2026-11-07, 읽기 전용 — DB를 바꾸지 않는다).
// 같은 내용을 두 칸(recruitment_type · recruiter_agency)에 적던 것을 원래 칸 하나로 돌리기 전에, 새 칸에만 적힌 공고 수를 본다.
import pg from 'pg'
const { SUPABASE_DB_URL } = process.env
if (!SUPABASE_DB_URL) { console.error('SUPABASE_DB_URL 없음'); process.exit(1) }
const client = new pg.Client({ connectionString: SUPABASE_DB_URL })
await client.connect()
const col = await client.query(`select 1 from information_schema.columns where table_schema='public' and table_name='local_jobs' and column_name='recruiter_agency'`)
if (col.rowCount) {
  const { rows } = await client.query(`select id, active, recruitment_type from public.local_jobs where recruiter_agency order by id`)
  console.log(`recruiter_agency=true 공고 ${rows.length}건` + (rows.length ? ': ' + rows.map((r) => `#${r.id}(${r.active ? '공개' : '비공개'}, 채용 형태 ${r.recruitment_type ?? '빈칸'})`).join(', ') : ''))
} else console.log('recruiter_agency 칸 없음')
const { rows: t } = await client.query(`select coalesce(recruitment_type, '빈칸') as v, count(*)::int as n, count(*) filter (where active)::int as live from public.local_jobs group by 1 order by 1`)
console.log('채용 형태 칸: ' + t.map((r) => `${r.v} ${r.n}건(공개 ${r.live})`).join(' · '))
await client.end()
