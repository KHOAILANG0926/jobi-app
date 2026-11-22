// job_posting_rules 마이그레이션 + supabase/tests/job_posting_rules_test.sql 를 PGlite에서 사전 점검한다.
// 실행: npm i --no-save @electric-sql/pglite@0.5.8 && node supabase/tests/job_posting_rules.pglite.test.mjs
// 한계: 시험용 DB(PGlite)다 — 운영 DB에는 시험 공고를 넣지 않는다(#858, 2026-11-16). CI: occupation-publication-check.yml(publication-gate).
// 범위(정확히): 규칙 R1~R7·U2를 구현한 함수(enforce_job_posting_policy·enforce_job_posting_rules·job_occupation_publish_reason 등)는 이후 migration이 다시 정의한 마지막 판까지 올린다(10-28 lee_verified_sources = R3 원문 근거 보호 포함, 2026-11-16 grep 확인).
// 이 시험이 다루지 않는 것: 위치 판정(map_r1·location_single_source·area_pin — 이름이 비슷한 별도 '위치 R1')과 10-29 입구 트리거(직접 insert 거부) — 각각 자기 운영 점검(ingest_gateway_production_check 등)·시험이 맡는다.
// 운영 쪽은 읽기 전용 운영 점검(rule_check_refs_production_check.sql 등: 규칙 표·트리거 존재)이 migrations-apply마다 확인한다.
import { PGlite } from '@electric-sql/pglite'
import { unaccent } from '@electric-sql/pglite/contrib/unaccent'
import { readFileSync } from 'node:fs'
const f = (p) => readFileSync(new URL(p, import.meta.url), 'utf8')
const db = new PGlite({ extensions: { unaccent } })
await db.exec(`
create extension unaccent;
create role anon nologin; create role authenticated nologin; create role service_role nologin;
create schema auth;
create function auth.uid() returns uuid language sql stable as $$ select null::uuid $$;
create function auth.jwt() returns jsonb language sql stable as $$ select '{}'::jsonb $$;
create function public.is_admin() returns boolean language sql stable as $$ select false $$;
create table public.local_jobs (id bigint generated always as identity primary key, title text not null, company text not null,
  category text default 'other', salary text, employer_phone text, description text, active boolean default true,
  origin text not null default 'legacy', admin_hidden boolean not null default false, source_url text, images jsonb,
  contact_zalo text, policy_decision text, source text); -- source: 운영에 있는 출처 칸(10-28 규칙 함수가 읽음, lee_source.pglite.test.mjs와 같음)
grant all on public.local_jobs to service_role; grant usage on schema public to service_role;
`)
await db.exec(f('../migrations/20261012153000_job_posting_policy_db_enforcement.sql'))
await db.exec(f('../migrations/20261013100000_job_posting_rules.sql'))
await db.exec(f('../migrations/20261013100000_job_posting_rules.sql')) // 멱등성
// 2026-11-16(#858): 시험 SQL이 10-15 뒤 직업분류 공개 조건(원문 근거 있는 공식 코드)을 전제로 쓰므로(R7 공개 대조·U2), 운영과 같은 순서로 직업분류 migration을 올린다
// (supabase/tests/occupation_publication.pglite.test.mjs와 같은 5개). 운영 DB 시험(job-rules-apply)은 10-29 입구 트리거(직접 insert 거부) 뒤 모든 시험 insert가 막혀 전부 '실패'로 보였으므로 이 시험이 그 역할을 맡는다.
for (const m of ['20261015100000_occupation_master.sql', '20261015100100_occupation_master_seed.sql', '20261015120000_local_jobs_occupation_r8.sql',
  '20261017070517_occupation_publication_gate.sql', '20261018090000_occupation_code_any_level.sql']) await db.exec(f(`../migrations/${m}`))
// 규칙 트리거 함수(public.enforce_job_posting_rules)를 다시 정의한 이후 migration — 지금 운영 규칙(R3 원문 근거 보호, Lee 확인 출처)으로 같은 시험을 돈다.
// (함수를 다시 정의한 migration은 이것 하나: grep 'function public.enforce_job_posting_rules' supabase/migrations, 2026-11-16 확인)
await db.exec(f('../migrations/20261028034009_lee_verified_sources.sql'))
await db.exec(f('./job_posting_rules_test.sql'))
const rows = (await db.query('select rule_key,last_test_result from job_posting_rules order by id')).rows
console.table(rows)
const left = (await db.query("select count(*)::int n from local_jobs where title like '[RULE-TEST%'")).rows[0].n
// 시험한 규칙 = 시험 SQL이 결과를 쓰는 규칙 이름(res || jsonb_build_object('…')) — STATUS 9절(#868)과 같은 방식으로 읽어 하나라도 '통과'가 아니면 실패.
const tested = [...new Set([...f('./job_posting_rules_test.sql').matchAll(/res \|\| jsonb_build_object\('([A-Za-z0-9_]+)'/g)].map((m) => m[1]))]
if (tested.length < 7) { console.error('FAIL 시험 규칙 목록을 읽지 못함', tested); process.exit(1) }
const bad = tested.map((k) => rows.find((r) => r.rule_key === k) ?? { rule_key: k, last_test_result: '규칙 표에 없음' }).filter((r) => r.last_test_result !== '통과')
if (bad.length || left) { console.error('FAIL', bad, left); process.exit(1) }
// 1-B(F1, Lee 2026-11-22): 정책 판정기 3벌(Python·JS·SQL)이 같은 입력에 같은 판정을 내는지 — 고정 사례 57개 + 고정 씨앗 무작위 조합 2,000건.
// 1-A 측정(4,057건)에서 불일치 0건이었다. 평가기를 하나로 합치거나 생성하지 않고 이 일치 시험으로만 묶는다(각 85줄 안팎, 분기가 늘면 이 시험이 먼저 깨진다).
// 규칙 데이터(policy/job-posting-rules.json)만 바꾸고 SQL(job_policy_rules)을 안 바꾸거나 한쪽 분기만 고치면 여기서 실패한다. 운영 DB는 쓰지 않는다.
{
  const { execFileSync } = await import('node:child_process')
  const { evaluateJobPostingPolicy } = await import('../../src/lib/jobPostingPolicy.mjs')
  const fixtures = JSON.parse(f('../../policy/job-posting-fixtures.json'))
  let seed = 12345
  const rnd = () => ((seed = (seed * 1664525 + 1013904223) >>> 0) / 4294967296)
  const vocab = [...new Set(fixtures.flatMap((x) => Object.values(x.input).flatMap((v) => String(v).split(/\s+/))).filter(Boolean))]
  const pick = (n) => Array.from({ length: n }, () => vocab[Math.floor(rnd() * vocab.length)]).join(' ')
  const cases = fixtures.map((x) => ({ input: x.input, expected: x.expected }))
  for (let i = 0; i < 2000; i++) cases.push({ input: { title: pick(1 + Math.floor(rnd() * 5)), company: pick(1 + Math.floor(rnd() * 3)), description: pick(2 + Math.floor(rnd() * 14)), category: rnd() < 0.5 ? '' : pick(1), salary: pick(Math.floor(rnd() * 4)) } })
  const js = cases.map((c) => { const r = evaluateJobPostingPolicy(c.input); return r.decision + ':' + r.reason })
  const py = JSON.parse(execFileSync('python3', ['-I', '-c', `
import json, sys
sys.path.insert(0, ${JSON.stringify(new URL('../../crawler', import.meta.url).pathname)})
from job_posting_policy import evaluate_job_posting_policy as e
print(json.dumps([(lambda r: r['decision'] + ':' + r['reason'])(e(c['input'])) for c in json.load(sys.stdin)]))
`], { input: JSON.stringify(cases), encoding: 'utf8' }))
  const mismatches = []
  for (let i = 0; i < cases.length; i++) {
    const i0 = cases[i].input
    const sql = (await db.query('select public.job_policy_decision($1,$2,$3,$4,$5) d', [i0.title ?? '', i0.company ?? '', i0.description ?? '', i0.category ?? '', i0.salary ?? ''])).rows[0].d.replace(/@.*$/, '')
    if (!(js[i] === py[i] && py[i] === sql) || (cases[i].expected && js[i].split(':')[0] !== cases[i].expected)) mismatches.push({ i, js: js[i], py: py[i], sql, expected: cases[i].expected })
  }
  if (mismatches.length) { console.error('FAIL 정책 판정기 3벌 불일치', mismatches.slice(0, 10)); process.exit(1) }
  console.log('정책 판정기 일치(Python·JS·SQL):', cases.length, '건 불일치 0')
}
console.log('PASS')
