// 20261126020000_job_apply_and_contact_gate.sql 사전 점검(PGlite, 운영 DB 접속 없음). 통합 운영 정상화 J그룹 2순위(Lee 2026-11-26).
// 실행: npm i --no-save @electric-sql/pglite@0.5.8 && node supabase/tests/job_apply_and_contact_gate.pglite.test.mjs
// 운영 공개 판정 함수(20261101190000: job_publish_gate_reason·enforce_job_publish_gate)를 파일에서 그대로 읽어 만든 뒤 새 migration을 적용하고 실제로 저장해 본다 —
//  ① 마감·숨김·마감일 지난 공고에는 새 지원이 거부되고, 열린 공고(마감 당일 포함)·기존 지원 내역은 그대로
//  ② 공개 중인 기업 공고의 연락처·주소 글자를 없애는 수정만 거부 / 새 공고·옛 빈 공고·닫는 수정·무관한 수정·관리자·수집 공고는 그대로
// 한계: 동시(두 연결) 요청은 PGlite 단일 연결로 재현할 수 없다 — 행 잠금(FOR SHARE) 줄 존재와 순차 판정만 확인한다.
import { PGlite } from '@electric-sql/pglite'
import { readFileSync } from 'node:fs'
import assert from 'node:assert/strict'

const mig = (f) => readFileSync(new URL(`../migrations/${f}`, import.meta.url), 'utf8')
const db = new PGlite()
await db.exec(`
create role anon nologin; create role authenticated nologin; create role service_role nologin bypassrls;
create table public.local_jobs (
  id bigint generated always as identity primary key, title text, origin text not null default 'employer', employer_phone text, contact_zalo text, location text,
  recruitment_regions jsonb, active boolean not null default true, admin_hidden boolean not null default false, application_deadline date, urgent boolean default false, publish_gate_reason text);
create table public.job_work_locations (id bigint generated always as identity primary key, job_id bigint not null references public.local_jobs(id), raw_address text);
create table public.applications (id bigint generated always as identity primary key, job_id bigint not null references public.local_jobs(id), seeker_id uuid not null default gen_random_uuid(), status text default 'submitted', unique (job_id, seeker_id));
`)
const gate = mig('20261101190000_db_publish_gate.sql')
await db.exec(gate.match(/create or replace function public\.job_publish_gate_reason[\s\S]*?\n\$\$;/)[0])
await db.exec(gate.match(/create or replace function public\.enforce_job_publish_gate[\s\S]*?\nend \$\$;/)[0])
await db.exec(`create trigger trg_zz0_publish_gate before insert or update on public.local_jobs for each row execute function public.enforce_job_publish_gate();`)

const job = async (o = {}) => (await db.query(
  `insert into public.local_jobs(title, origin, employer_phone, location, active, admin_hidden, application_deadline) values ($1,$2,$3,$4,$5,$6,$7) returning id`,
  ['t', o.origin ?? 'employer', 'phone' in o ? o.phone : '0912345678', 'loc' in o ? o.loc : 'Bắc Ninh', o.active ?? true, o.hidden ?? false, o.deadline ?? null])).rows[0].id
const apply = (id) => db.query(`insert into public.applications(job_id) values ($1)`, [id])
const vnToday = (await db.query(`select (now() at time zone 'Asia/Ho_Chi_Minh')::date::text d`)).rows[0].d
const addDays = async (n) => (await db.query(`select ($1::date + $2::int)::text d`, [vnToday, n])).rows[0].d

// ── 적용 전: 마감·숨김 공고에도 지원이 저장된다(구멍) ──
const closedBefore = await job({ active: false })
await apply(closedBefore)
assert.equal((await db.query(`select count(*)::int c from public.applications where job_id = $1`, [closedBefore])).rows[0].c, 1, '적용 전: 닫힌 공고에도 지원이 저장됨(구멍)')
const phoneJob0 = await job()
await db.query(`update public.local_jobs set employer_phone = '' where id = $1`, [phoneJob0])
assert.equal((await db.query(`select employer_phone p from public.local_jobs where id = $1`, [phoneJob0])).rows[0].p, '', '적용 전: 공개 중인 기업 공고의 연락처를 비울 수 있음(구멍)')

// ── 새 migration 적용 ──
const m = mig('20261126020000_job_apply_and_contact_gate.sql')
await db.exec(m)
await assert.rejects(db.exec(m), /이미 적용됨/, '두 번 적용은 막힘'); await db.exec('rollback')
const fdef = (await db.query(`select pg_get_functiondef('public.applications_job_open_gate()'::regprocedure) d`)).rows[0].d
assert.ok(/for share/i.test(fdef) && /security definer/i.test(fdef), '지원 판정은 공고 행을 잠그고(FOR SHARE) 서버 권한으로 읽음')

// ── ① 지원 ──
await assert.rejects(apply(await job({ active: false })), /마감·숨김 공고/, '닫힌(active=false) 공고는 새 지원 거부')
await assert.rejects(apply(await job({ hidden: true })), /마감·숨김 공고/, '숨김 공고는 새 지원 거부')
await assert.rejects(apply(await job({ deadline: await addDays(-1) })), /마감·숨김 공고/, '마감일이 베트남 어제면 거부')
await apply(await job({ deadline: vnToday }))   // 마감 당일은 열림
await apply(await job({ deadline: await addDays(3) }))
await apply(await job())                         // 마감일 없음
await assert.rejects(db.query(`insert into public.applications(job_id) values (999999)`), /foreign key|마감·숨김/, '없는 공고는 거부')
// 기존 지원 내역은 공고가 닫혀도 그대로
const keep = await job()
await apply(keep)
await db.query(`update public.local_jobs set active = false where id = $1`, [keep])
assert.equal((await db.query(`select count(*)::int c from public.applications where job_id = $1`, [keep])).rows[0].c, 1, '공고가 닫혀도 기존 지원 내역은 보존')
assert.equal((await db.query(`select count(*)::int c from public.applications where job_id = $1`, [closedBefore])).rows[0].c, 1, '적용 전에 있던 닫힌 공고 지원 내역도 보존')
// 지원 거부는 공고를 잠그는 순서: 닫는 수정 뒤 지원은 거부(순차)
const racing = await job(); await db.query(`update public.local_jobs set active = false where id = $1`, [racing])
await assert.rejects(apply(racing), /마감·숨김 공고/, '닫은 직후 지원은 거부')

// ── ② 연락처·주소 ──
const emp = await job({ phone: '0912345678' })
await assert.rejects(db.query(`update public.local_jobs set employer_phone = '' where id = $1`, [emp]), /연락처·주소를 없앨 수 없음\(no_application_path\)/, '공개 중인 기업 공고의 연락처 비우기는 거부')
await db.query(`update public.local_jobs set contact_zalo = '0988777666', employer_phone = '' where id = $1`, [emp])   // Zalo가 남으면 통과
await assert.rejects(db.query(`update public.local_jobs set contact_zalo = '' where id = $1`, [emp]), /no_application_path/, '전화·Zalo가 모두 없어지면 거부')
const emp2 = await job({ phone: '0912345678', loc: 'Hà Nội' })
await assert.rejects(db.query(`update public.local_jobs set location = null where id = $1`, [emp2]), /no_address_text/, '공개 중인 공고의 주소 글자를 모두 없애면 거부')
await db.query(`insert into public.job_work_locations(job_id, raw_address) values ($1, 'KCN A')`, [emp2])
await db.query(`update public.local_jobs set location = null where id = $1`, [emp2])   // 근무지 행이 있으면 주소 있음
await db.query(`update public.local_jobs set active = false, employer_phone = '' where id = $1`, [emp])  // 닫는 수정은 통과
// 대상이 아닌 것
const legacy = await job({ phone: null, loc: 'Bắc Ninh' })   // 이미 연락처 없는 옛 공고
await db.query(`update public.local_jobs set urgent = true where id = $1`, [legacy])
assert.equal((await db.query(`select active a from public.local_jobs where id = $1`, [legacy])).rows[0].a, true, '이미 비어 있던 옛 공고는 무관한 수정으로 숨지 않음(새 공개 차단 없음)')
const fresh = await job({ phone: null })
assert.equal((await db.query(`select publish_gate_reason r, active a from public.local_jobs where id = $1`, [fresh])).rows[0].r, 'no_application_path', '새 기업 공고는 계산값만 기록(공개 안 막음)')
assert.equal((await db.query(`select active a from public.local_jobs where id = $1`, [fresh])).rows[0].a, true)
const adm = await job({ origin: 'admin' }); await db.query(`update public.local_jobs set employer_phone = '' where id = $1`, [adm])   // 관리자: 기존 결정 A 그대로(막지 않음)
const crw = await job({ origin: 'crawler', phone: '0912345678' }); await db.query(`update public.local_jobs set employer_phone = '' where id = $1`, [crw])
assert.equal((await db.query(`select active a from public.local_jobs where id = $1`, [crw])).rows[0].a, false, '수집 공고는 기존대로 연락처가 없어지면 비공개')

// ── 줄이 본문에 없으면 RAISE ──
const d2 = new PGlite()
await d2.exec(`create role anon nologin; create role authenticated nologin; create function public.enforce_job_publish_gate() returns trigger language plpgsql as $f$ begin return new; end $f$; create table public.applications(id int); create table public.local_jobs(id int);`)
await assert.rejects(d2.exec(m), /대상 줄을 찾지 못함/, '줄이 없으면 전체 취소')
console.log('job_apply_and_contact_gate: 운영 공개 판정 본문 대상 시험 통과 (마감·숨김 지원 거부·기존 지원 보존·공개 중 연락처/주소 제거 거부·새 공고·옛 공고·관리자·수집 공고 그대로·이중 적용/줄 누락 RAISE)')
