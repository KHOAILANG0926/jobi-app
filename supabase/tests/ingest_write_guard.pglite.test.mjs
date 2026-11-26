// 20261126010000_ingest_write_guard.sql 사전 점검(PGlite, 운영 DB 접속 없음). 통합 운영 정상화 J그룹 2순위(Lee 2026-11-26).
// 실행: npm i --no-save @electric-sql/pglite@0.5.8 && node supabase/tests/ingest_write_guard.pglite.test.mjs
// 진짜 운영 ingest_job 본문(20261029010000)을 파일에서 그대로 읽어 만든 뒤 새 migration을 적용하고, 실제로 호출해 본다 —
//  ① 수집 경로가 기업·관리자 공고의 칸을 다시 수집으로 덮어쓰지 못한다(적용 전에는 덮어씀 — 시험이 그 차이를 직접 본다)
//  ② 기업 경로는 source_url을 받지 않아 주소를 선점할 수 없다(적용 전에는 원문 기록에 남음)
//  ③ 수집 공고의 정상 다시 수집은 그대로 된다 / 줄 바꾸기가 본문에 맞지 않으면 RAISE로 멈춘다
// ingest_job이 부르는 private 함수(원문 기록·상태 조회·연결·로그)는 시험용 대역이다 — 이 시험의 대상은 입구 본문의 두 줄과 그 동작이다.
import { PGlite } from '@electric-sql/pglite'
import { readFileSync } from 'node:fs'
import assert from 'node:assert/strict'

const mig = (f) => readFileSync(new URL(`../migrations/${f}`, import.meta.url), 'utf8')
const db = new PGlite()
await db.exec(`
create role anon nologin; create role authenticated nologin; create role service_role nologin bypassrls;
create schema ingest_private;
create function public.is_admin() returns boolean language sql as $$ select false $$;
create function public.job_phone_digits(x text) returns text language sql immutable as $$ select nullif(regexp_replace(coalesce(x,''), '[^0-9]', '', 'g'), '') $$;
create table public.local_jobs (
  id bigint generated always as identity primary key, title text, company text, salary text, source_url text, source_text text, employer_phone text,
  origin text not null default 'crawler', admin_hidden boolean not null default false, active boolean not null default true,
  occupation_code text, publish_gate_reason text, crawler_version text, last_verified_at timestamptz,
  policy_decision text, ocr_text text, ocr_check jsonb, created_at timestamptz default now(), updated_at timestamptz default now());
create table public.job_ingest_raw (id bigint generated always as identity primary key, source_url text, content_hash text not null, job_id bigint references public.local_jobs(id));
create table public.ingest_log (raw_id bigint, stage text, msg text);
-- 새 공고 저장 뒤 입구가 읽는 새 번호(운영은 트리거가 정함)
create function public.t_new_id() returns trigger language plpgsql as $$ begin perform set_config('jobi.ingest_new_id', new.id::text, true); return new; end $$;
create trigger t_new_id after insert on public.local_jobs for each row execute function public.t_new_id();
create function ingest_private.open_raw(ch text, src text, url text, txt text, imgs jsonb, p jsonb, h text) returns bigint language sql as $$
  insert into public.job_ingest_raw(source_url, content_hash) values (url, h) returning id $$;
create function ingest_private.job_state(p_job bigint) returns table(origin text, admin_hidden boolean, active boolean, reason text, occupation_code text) language sql stable as $$
  select j.origin, j.admin_hidden, j.active, j.publish_gate_reason, j.occupation_code from public.local_jobs j where j.id = p_job $$;
create function ingest_private.link(raw bigint, job bigint) returns void language sql as $$ update public.job_ingest_raw set job_id = job where id = raw $$;
create function ingest_private.log(raw bigint, stage text, msg text) returns void language sql as $$ insert into public.ingest_log values (raw, stage, msg) $$;
`)
// 운영 find_existing(6)·ingest_job 본문을 파일에서 그대로
const oneDoor = mig('20261029010000_ingest_one_door.sql')
await db.exec(oneDoor.match(/create function ingest_private\.find_existing[\s\S]*?\n\$\$;/)[0])
await db.exec(oneDoor.match(/create or replace function public\.ingest_job\(p jsonb\)[\s\S]*?\nend \$\$;/)[0])

const ins = async (origin, o = {}) => (await db.query(
  `insert into public.local_jobs(title, company, salary, source_url, source_text, employer_phone, origin) values ($1,$2,$3,$4,$5,$6,$7) returning id`,
  [o.title ?? 't', o.company ?? 'CTY A', o.salary ?? '8 triệu', o.url ?? null, o.text ?? `text-${Math.random()}`, o.phone ?? '0912345678', origin])).rows[0].id
const salary = async (id) => (await db.query(`select salary from public.local_jobs where id = $1`, [id])).rows[0].salary
const call = (p) => db.query(`select public.ingest_job($1::jsonb) as id`, [JSON.stringify(p)])
const logs = async (stage) => (await db.query(`select msg from public.ingest_log where stage = $1 order by msg`, [stage])).rows.map((r) => r.msg)

// ── 적용 전(운영 현재 본문): 두 구멍이 실제로 있음 ──
const emp1 = await ins('employer', { salary: '10 triệu' })
await call({ channel: 'crawler_topcv', source_text: 'x1', job_id: emp1, update_fields: ['salary'], salary: '1 triệu' })
assert.equal(await salary(emp1), '1 triệu', '적용 전: 수집 경로가 기업 공고 급여를 덮어씀(구멍 ①)')
await call({ channel: 'employer', source_text: 'poster text', company: 'CTY Z', source_url: 'https://squat.example/post/1', title: 'tz' })
assert.equal((await db.query(`select count(*)::int c from public.job_ingest_raw where source_url = 'https://squat.example/post/1'`)).rows[0].c, 1, '적용 전: 기업 경로가 원문 주소를 원문 기록에 남김(구멍 ②)')

// ── 새 migration 적용: 줄 바꾸기가 운영 본문에 그대로 맞아야 한다 ──
await db.exec(mig('20261126010000_ingest_write_guard.sql'))
const def = (await db.query(`select pg_get_functiondef('public.ingest_job(jsonb)'::regprocedure) d`)).rows[0].d
assert.ok(def.includes(`if ch = 'employer' then p := p - 'source_url'; end if;`), '기업 경로 source_url 제거 줄')
assert.ok(def.includes(`ch like 'crawler_%' and st.origin is distinct from 'crawler'`), '수집 경로 비수집 공고 보호 줄')
assert.ok(def.includes(`if st.origin is distinct from origin_v or st.admin_hidden then`), '기존 칸 보호 줄은 그대로')
await assert.rejects(db.exec(mig('20261126010000_ingest_write_guard.sql')), /이미 적용됨/, '두 번 적용은 막힘')
await db.exec('rollback') // migration의 begin 안에서 RAISE → 열린 트랜잭션을 닫는다(운영은 파일 하나가 한 트랜잭션이라 전체 취소)

// ── ① 수집 경로는 기업·관리자 공고를 다시 수집으로 덮어쓰지 못한다 ──
const emp2 = await ins('employer', { salary: '10 triệu' })
await call({ channel: 'crawler_topcv', source_text: 'x2', job_id: emp2, update_fields: ['salary'], salary: '1 triệu' })
assert.equal(await salary(emp2), '10 triệu', '수집 경로가 기업 공고 급여를 덮어쓰지 못함')
const adm = await ins('admin', { salary: '12 triệu', url: 'https://src.example/a', text: 'admin text' })
await call({ channel: 'crawler_facebook', source_text: 'admin text', source_url: 'https://src.example/a', refresh: true, salary: '1 triệu', company: 'CTY A', employer_phone: '0912345678' })
assert.equal(await salary(adm), '12 triệu', '다시 수집(refresh)도 관리자 공고를 덮어쓰지 못함')
assert.ok((await logs('dedup')).some((m) => m === 'refresh_skipped:origin:employer'), '건너뛴 갱신이 기록됨(기업)')
assert.ok((await logs('dedup')).some((m) => m === 'refresh_skipped:origin:admin'), '건너뛴 갱신이 기록됨(관리자)')
// 수집 공고의 정상 다시 수집은 그대로
const crw = await ins('crawler', { salary: '8 triệu' })
await call({ channel: 'crawler_topcv', source_text: 'x3', job_id: crw, update_fields: ['salary'], salary: '9 triệu' })
assert.equal(await salary(crw), '9 triệu', '수집 공고의 정상 다시 수집은 그대로 고쳐짐')
// 기업·관리자 경로의 자기 공고 수정은 그대로(경로 무관 칸 갱신은 호출자 권한·기존 트리거가 판단)
await call({ channel: 'admin', source_text: 'x4', job_id: adm, update_fields: ['salary'], salary: '13 triệu' })
assert.equal(await salary(adm), '13 triệu', '관리자 경로는 관리자 공고를 그대로 고침')

// ── ② 기업 경로는 원문 주소를 받지 않는다(선점 차단) ──
await call({ channel: 'employer', source_text: 'poster text 2', company: 'CTY Y', source_url: 'https://squat.example/post/2', title: 'ty' })
assert.equal((await db.query(`select count(*)::int c from public.job_ingest_raw where source_url = 'https://squat.example/post/2'`)).rows[0].c, 0, '기업 경로: 원문 기록에 주소가 남지 않음')
assert.equal((await db.query(`select count(*)::int c from public.local_jobs where source_url = 'https://squat.example/post/2'`)).rows[0].c, 0, '기업 경로: 공고에도 주소가 남지 않음')
// 같은 주소의 수집 공고는 새 공고로 정상 등록(선점으로 중복 처리되지 않음)
const r = await call({ channel: 'crawler_topcv', source_text: 'real crawl text', company: 'CTY Y', source_url: 'https://squat.example/post/2', title: 'real' })
const newId = Number(r.rows[0].id)
assert.equal((await db.query(`select count(*)::int c from public.local_jobs where id = $1 and source_url = 'https://squat.example/post/2'`, [newId])).rows[0].c, 1, '같은 주소의 수집 공고가 새 공고로 등록됨')
// 수집·관리자 경로의 source_url은 그대로 받는다
assert.equal((await db.query(`select count(*)::int c from public.job_ingest_raw where source_url = 'https://squat.example/post/2'`)).rows[0].c, 1, '수집 경로는 source_url을 그대로 남김')

// ── 줄이 본문에 없으면 RAISE(운영 본문이 바뀌었을 때 조용히 지나가지 않음) ──
const d2 = new PGlite()
await d2.exec(`create schema ingest_private; create function public.ingest_job(p jsonb) returns bigint language plpgsql as $f$ begin return 1; end $f$;`)
await assert.rejects(d2.exec(mig('20261126010000_ingest_write_guard.sql')), /origin 줄을 찾지 못함/, '줄이 없으면 전체 취소')
console.log('ingest_write_guard: 운영 본문 대상 시험 통과 (수집 경로 덮어쓰기 차단·기업 경로 source_url 무시·정상 다시 수집 유지·이중 적용/줄 누락 RAISE)')
