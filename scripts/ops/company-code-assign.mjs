// 공개 공고에 회사·지점 코드 붙이기 — 중복 3단계 (Lee 2026-11-06 "기존 공고에도 회사 코드를 붙이라고 했잖아").
// 사용: SUPABASE_DB_URL=… APPLY=0|1 node --experimental-strip-types --import ./scripts/ts-extensionless-register.mjs scripts/ops/company-code-assign.mjs
//  - 대상: 공개 공고 전체(기존 공고 포함 — Lee 지시). 보류·숨김 공고는 뺀다(Lee: 해결될 때까지 놔둠).
//  - 공고 내용·화면·공개 여부는 바꾸지 않는다. 회사 코드표(job_companies·names·phones·branches)와 local_jobs.company_id·company_branch_id만 쓴다.
//  - 규칙은 src/lib/jobIdentity.ts 하나(companyCore·businessKind·kindsCompatible·phoneKeys). 공고 번호 지정 없음.
//  - APPLY=0(기본): 한 트랜잭션으로 해 보고 결과만 찍고 되돌린다. APPLY=1: 적용.
import pg from 'pg'
import { appendFileSync } from 'node:fs'
import { companyCore, businessKind, kindsCompatible, phoneKeys } from '../../src/lib/jobIdentity.ts'

const { SUPABASE_DB_URL } = process.env
if (!SUPABASE_DB_URL) { console.error('SUPABASE_DB_URL 필요'); process.exit(2) }
const APPLY = process.env.APPLY === '1'
const CATEGORY_KEYS = new Set(['am_thuc_do_uong', 'quan_ly_ban_hang', 'dich_vu', 'van_phong', 'cskh_kinh_doanh', 'san_xuat_xay_dung', 'cntt_ky_thuat', 'thiet_ke', 'truyen_thong', 'lai_xe_giao_hang', 'y_te_dieu_duong', 'giao_duc_giang_day', 'khac'])

const client = new pg.Client({ connectionString: SUPABASE_DB_URL })
await client.connect()
const out = [`## 회사 코드 붙이기 (${APPLY ? '적용' : '시험 — 되돌림'})`, '']
let failed = false
try {
  await client.query('begin')
  const { rows: jobs } = await client.query(
    `select id, title, company, category, subcategory, employer_phone, contact_zalo, company_id, company_branch_id
       from public.local_jobs where active and not coalesce(admin_hidden, false) order by id`)
  const stat = { coded: 0, unchanged: 0, newCompany: 0, skipped: 0 }
  for (const j of jobs) {
    const { core, branch } = companyCore(j.company)
    const kind = businessKind(j) || null
    const phones = phoneKeys(j.employer_phone, j.contact_zalo)
    let company = null
    if (core) {
      const { rows } = await client.query('select id, kind from public.job_companies where core = $1 order by id', [core])
      company = rows.find((r) => kindsCompatible(r.kind ?? '', kind ?? '')) ?? null
      if (company && kind && company.kind && company.kind !== kind && CATEGORY_KEYS.has(company.kind) && !CATEGORY_KEYS.has(kind)) {
        // 처음 정한 업종 기억: 큰 분류 → 그 아래 소분류로만 구체화
        await client.query('update public.job_companies set kind = $2, updated_at = now() where id = $1', [company.id, kind])
        company.kind = kind
      }
      if (!company) {
        const { rows: ins } = await client.query('insert into public.job_companies(core, kind) values ($1, $2) returning id, kind', [core, kind])
        company = ins[0]; stat.newCompany++
      }
    } else if (phones.length) {
      const { rows } = await client.query('select c.id, c.kind from public.job_company_phones p join public.job_companies c on c.id = p.company_id where p.phone = any($1) order by c.id limit 1', [phones])
      company = rows[0] ?? null
      if (!company) {
        // 회사 이름 없는 공고: 사장 번호가 곧 회사(Lee 2026-11-06). 핵심 이름 = "p" + 첫 번호.
        const { rows: ins } = await client.query('insert into public.job_companies(core, kind) values ($1, $2) on conflict do nothing returning id, kind', ['p' + phones[0], kind])
        company = ins[0] ?? (await client.query('select id, kind from public.job_companies where core = $1 order by id limit 1', ['p' + phones[0]])).rows[0]
        if (ins[0]) stat.newCompany++
      }
    }
    if (!company) { stat.skipped++; out.push(`- sb-${j.id} 건너뜀: 회사 이름·전화번호 둘 다 없음 (${j.title?.slice(0, 60) ?? ''})`); continue }
    if (String(j.company ?? '').trim()) await client.query('insert into public.job_company_names(company_id, raw_name) values ($1, $2) on conflict do nothing', [company.id, String(j.company).trim()])
    for (const p of phones) await client.query('insert into public.job_company_phones(company_id, phone) values ($1, $2) on conflict do nothing', [company.id, p])
    await client.query('insert into public.job_company_branches(company_id, branch) values ($1, $2) on conflict do nothing', [company.id, branch])
    const { rows: br } = await client.query('select id from public.job_company_branches where company_id = $1 and branch = $2', [company.id, branch])
    const branchId = br[0].id
    if (Number(j.company_id) === Number(company.id) && Number(j.company_branch_id) === Number(branchId)) { stat.unchanged++; continue }
    await client.query('update public.local_jobs set company_id = $2, company_branch_id = $3 where id = $1', [j.id, company.id, branchId])
    stat.coded++
    out.push(`- sb-${j.id} → 회사 #${company.id} ${core || '(번호로 찾음)'} [${company.kind ?? '-'}] / 지점 "${branch || '-'}" | ${j.company ?? ''}`)
  }
  const { rows: [c] } = await client.query('select count(*)::int as n from public.job_companies')
  out.splice(2, 0, `- 공개 공고 ${jobs.length}건: 코드 붙임 ${stat.coded} · 이미 같음 ${stat.unchanged} · 건너뜀 ${stat.skipped} · 새 회사 ${stat.newCompany} (회사 표 전체 ${c.n}곳)`, '')
  await client.query(APPLY ? 'commit' : 'rollback')
} catch (e) {
  failed = true
  await client.query('rollback').catch(() => {})
  out.push(`실패(전부 되돌림): ${String(e.message || e).split('\n')[0]}`)
} finally {
  await client.end()
}
const text = out.join('\n')
console.log(text)
if (process.env.GITHUB_STEP_SUMMARY) appendFileSync(process.env.GITHUB_STEP_SUMMARY, text + '\n')
process.exit(failed ? 1 : 0)
