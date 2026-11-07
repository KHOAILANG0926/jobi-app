// 이미 올라간 공개 공고의 회사 이름을 새 기준(src/lib/companyReader.ts)으로 다시 읽어 "지금 이름 / 새 기준 결과" 목록만 보여 준다.
// Lee 2026-11-07(1번): 읽기 전용 — DB를 바꾸지 않는다. 고칠지는 Lee가 목록을 보고 정하고, 고치는 것은 승인된 migration으로만.
import pg from 'pg'
import { readCompany } from '../../src/lib/companyReader.ts'
import { fold } from '../../src/lib/jobIdentity.ts'

const { SUPABASE_DB_URL } = process.env
if (!SUPABASE_DB_URL) { console.error('SUPABASE_DB_URL 없음'); process.exit(1) }
const client = new pg.Client({ connectionString: SUPABASE_DB_URL })
await client.connect()
const { rows } = await client.query(`
  select id, company, coalesce(nullif(source_text, ''), description, '') as text
    from public.local_jobs where active and not admin_hidden order by id`)
await client.end()
const norm = (s) => fold(s).replace(/[^a-z0-9]+/g, ' ').trim()
let same = 0, empty = 0, diff = 0
const out = []
for (const r of rows) {
  const text = String(r.text).replace(/^\[source:[a-z]+\]\s*/i, '')
  const now = String(r.company ?? '').trim()
  const got = readCompany(text)
  if (norm(got.name) === norm(now)) { same++; continue }
  if (!got.name) empty++; else diff++
  out.push(`- #${r.id} | 지금: ${now.slice(0, 60) || '(빈칸)'} | 새 기준: ${got.name || '(못 찾음)'}${got.agency ? ' [소개소]' : ''}`)
  // 원문 앞 8줄(시험 사례로 옮기기 위해 — 전화번호는 가림)
  if (process.env.SHOW_TEXT === '1') out.push(text.split('\n').slice(0, 8).map((l) => '    > ' + l.replace(/(?:\+?84|0)[\s.\-]?\d(?:[\s.\-]?\d){7,9}/g, '[전화]').slice(0, 160)).join('\n'))
}
console.log(`공개 공고 ${rows.length}건: 같음 ${same} · 새 기준이 다름 ${diff} · 새 기준으로 못 찾음 ${empty}`)
console.log(out.join('\n'))
