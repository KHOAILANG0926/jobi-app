-- 로컬 폐기용 PostgreSQL 전용(운영 접근 없음). 20261029010000_ingest_one_door 적용 뒤 실행.
-- 같은 규칙을 모든 길(게스트·고용주·관리자·크롤러·SQL 파일·DB 소유자 직접)로 시험한다.
-- RLS 정책은 운영 migration(0009·0019·20260920·20261014)의 정의를 그대로 옮겨 둔다(fixture에 없을 때만).
\set ON_ERROR_STOP 1
set client_min_messages = warning;

-- ── 시험 준비: 운영과 같은 RLS·열 권한(없을 때만) ─────────────────────────────
-- 운영 is_admin() 정의(0009) — CI fixture는 false 고정 대역을 쓰므로 여기서 운영 정의로 맞춘다.
create or replace function public.is_admin() returns boolean language sql stable security invoker set search_path = pg_catalog, public as
 $$ select auth.uid() is not null and coalesce(auth.jwt() -> 'app_metadata' ->> 'role', '') = 'admin' $$;
grant execute on function public.is_admin() to anon, authenticated;
do $$ begin
 if to_regclass('public.account_roles') is null then
  create table public.account_roles(user_id uuid primary key, role text not null);
 end if;
 if to_regprocedure('public.is_account_active(uuid)') is null then
  create function public.is_account_active(user_id uuid) returns boolean language sql stable as 'select $1 is not null';
 end if;
 if to_regprocedure('public.local_job_is_visible(boolean,boolean,uuid)') is null then
  create function public.local_job_is_visible(p_active boolean, p_hidden boolean, p_employer uuid) returns boolean language sql stable as
   'select (coalesce($1,false) and not coalesce($2,false)) or ($3 is not null and $3 = auth.uid()) or public.is_admin()';
 end if;
end $$;
grant execute on function public.is_account_active(uuid), public.local_job_is_visible(boolean,boolean,uuid) to anon, authenticated;
grant select on public.account_roles to anon, authenticated;
alter table public.local_jobs enable row level security;
do $$ begin
 if not exists (select 1 from pg_policies where tablename = 'local_jobs' and policyname = 'local_jobs_public_select') then
  create policy local_jobs_public_select on public.local_jobs for select to anon, authenticated
   using (public.local_job_is_visible(active, admin_hidden, employer_id));
 end if;
 if not exists (select 1 from pg_policies where tablename = 'local_jobs' and policyname = 'local_jobs_employer_insert') then
  create policy local_jobs_employer_insert on public.local_jobs for insert to authenticated
   with check (public.is_account_active(auth.uid()) and employer_id = auth.uid() and origin = 'employer' and admin_hidden = false
     and exists (select 1 from public.account_roles ar where ar.user_id = auth.uid() and ar.role = 'employer'));
 end if;
 if not exists (select 1 from pg_policies where tablename = 'local_jobs' and policyname = 'local_jobs_guest_insert') then
  create policy local_jobs_guest_insert on public.local_jobs for insert to anon
   with check (employer_id is null and guest_manage_token is not null and length(guest_manage_token) >= 20);
 end if;
end $$;
grant insert on public.local_jobs to anon, authenticated;
do $$ declare cols text; begin
 select string_agg(quote_ident(column_name), ', ') into cols from information_schema.columns
  where table_schema = 'public' and table_name = 'local_jobs'
    and column_name not in ('source_url', 'source_text', 'ocr_text', 'ocr_check', 'guest_manage_token');
 execute format('grant select (%s) on public.local_jobs to anon, authenticated', cols);
end $$;
insert into auth.users(id) values ('00000000-0000-0000-0000-0000000000e1'), ('00000000-0000-0000-0000-0000000000a1'), ('00000000-0000-0000-0000-0000000000b1')
 on conflict do nothing;
insert into public.account_roles values ('00000000-0000-0000-0000-0000000000e1', 'employer') on conflict do nothing;

-- 시험 도우미: 오류가 나야 하는 문장 (부른 사람 권한 그대로 실행)
create or replace function public.t_expect_error(q text, pat text) returns void language plpgsql as $$
begin
  begin execute q; exception when others then
    if sqlerrm !~ pat then raise exception 'FAIL: 기대한 오류(%) 대신: %', pat, sqlerrm; end if;
    return;
  end;
  raise exception 'FAIL: 오류가 나야 하는데 통과: %', q;
end $$;
grant execute on function public.t_expect_error(text, text) to anon, authenticated, service_role;
create or replace function public.t_raw_steps(p_job bigint) returns text language sql security definer as
 $$select string_agg(l.step || '=' || l.outcome, ' ' order by l.at, l.step) from public.job_ingest_log l
   where l.raw_id = (select max(r.id) from public.job_ingest_raw r where r.job_id = p_job)$$;
grant execute on function public.t_raw_steps(bigint) to anon, authenticated, service_role;

-- ── 1. 입구 밖 직접 등록은 모든 계정에서 거부 ─────────────────────────────────
select public.t_expect_error($q$insert into public.local_jobs(title, company, source_text, source_url) values ('t','c','c 원문','https://x/1')$q$, 'ingest_gateway');
set role service_role;
select public.t_expect_error($q$insert into public.local_jobs(title, company, source_text, source_url) values ('t','c','c 원문','https://x/1')$q$, 'ingest_gateway');
reset role;
set role anon;
select public.t_expect_error($q$insert into public.local_jobs(title, company, guest_manage_token) values ('t','c','gggggggggggggggggggggggg')$q$, 'ingest_gateway');
reset role;

-- ── 2. 크롤러(서버 키) 등록 → 5단계 기록, 같은 공고 재등록은 새 공고 없음 ───────────
set role service_role;
do $$ declare a bigint; b bigint; n int; steps text; begin
  a := public.ingest_job(jsonb_build_object('channel','crawler_topcv','source','topcv','source_url','https://src.example/job/1',
       'title','Công nhân','company','CTY ABC','source_text','CTY ABC tuyển công nhân. LH 0912 345 678','employer_phone','0912 345 678',
       'location','Bắc Ninh','active',false,'ocr_text','가짜 OCR','admin_hidden',true,'policy_decision','approved'));
  steps := public.t_raw_steps(a);
  if steps !~ 'preserve=ok' or steps !~ 'dedup=new' or steps !~ 'occupation=' or steps !~ 'location=save_hook' or steps !~ 'publication=' then
    raise exception 'FAIL 크롤러 단계 기록: %', steps; end if;
  b := public.ingest_job(jsonb_build_object('channel','crawler_topcv','source','topcv','source_url','https://src.example/job/1',
       'title','Công nhân (sửa)','company','CTY ABC','source_text','글자가 달라도 같은 source_url'));
  if a <> b then raise exception 'FAIL 같은 source_url인데 새 공고 % / %', a, b; end if;
  select count(*) into n from public.local_jobs where source_url = 'https://src.example/job/1';
  if n <> 1 then raise exception 'FAIL 공고 수 %', n; end if;
  -- 판정 칸은 입구가 받지 않는다
  if exists (select 1 from public.local_jobs where id = a and (ocr_text is not null or admin_hidden or origin <> 'crawler')) then
    raise exception 'FAIL 판정 칸이 들어감'; end if;
  if (select title from public.local_jobs where id = a) <> 'Công nhân' then raise exception 'FAIL 중복인데 내용이 바뀜'; end if;
end $$;
-- 같은 원문을 고치지 않고 다시 넣으면 여전히 1건, 다른 경로(관리자)로 같은 원문+연락처+회사가 와도 같은 공고
reset role;
do $$ declare a bigint; b bigint; begin
  select id into a from public.local_jobs where source_url = 'https://src.example/job/1';
  b := public.ingest_job(jsonb_build_object('channel','sql_file','title','x','company','CTY ABC',
       'source_text','CTY ABC tuyển công nhân. LH 0912 345 678','employer_phone','0912345678','source_url','https://other/2'));
  if b <> a then raise exception 'FAIL 다른 경로 같은 원문인데 새 공고 % / %', a, b; end if;
end $$;

-- ── 3. 다시 수집(job_id 지정): 바뀐 칸만, 숨김 공고는 공개 칸 안 건드림 ─────────────
set role service_role;
do $$ declare a bigint; begin
  select id into a from public.local_jobs where source_url = 'https://src.example/job/1';
  perform public.ingest_job(jsonb_build_object('channel','crawler_topcv','job_id',a,'source_text','CTY ABC tuyển công nhân. LH 0912 345 678',
          'salary','8 triệu','active',false,'publish_gate_reason','no_application_path'));
  if (select salary from public.local_jobs where id = a) is distinct from '8 triệu' then raise exception 'FAIL 다시 수집 칸 반영 안 됨'; end if;
  if (select publish_gate_reason from public.local_jobs where id = a) is distinct from 'no_application_path' then raise exception 'FAIL 같은 출처 공고 사유 반영 안 됨'; end if;
  if public.t_raw_steps(a) !~ 'dedup=refresh:' then raise exception 'FAIL 다시 수집 기록: %', public.t_raw_steps(a); end if;
  -- 고칠 칸 목록을 주면 그 칸만(원문 칸은 안 바뀌고 원문 기록에만 보존)
  perform public.ingest_job(jsonb_build_object('channel','crawler_topcv','job_id',a,'source_text','CTY ABC 새 원문 글자',
          'salary','9 triệu','hours','8h','update_fields',jsonb_build_array('salary')));
  if exists (select 1 from public.local_jobs where id = a and (salary <> '9 triệu' or hours is not null or source_text <> 'CTY ABC tuyển công nhân. LH 0912 345 678')) then
    raise exception 'FAIL update_fields 밖의 칸이 바뀜'; end if;
end $$;
reset role;
do $$ begin
  if not exists (select 1 from public.job_ingest_raw where source_text = 'CTY ABC 새 원문 글자') then raise exception 'FAIL 다시 수집 원문 보존'; end if;
end $$;
set role service_role;
do $$ begin perform 1; end $$;
reset role;
update public.local_jobs set admin_hidden = true where source_url = 'https://src.example/job/1';
set role service_role;
do $$ declare a bigint; begin
  select id into a from public.local_jobs where source_url = 'https://src.example/job/1';
  perform public.ingest_job(jsonb_build_object('channel','crawler_topcv','job_id',a,'source_text','CTY ABC tuyển công nhân. LH 0912 345 678',
          'active',true,'publish_gate_reason','ok','admin_hidden',false));
  if exists (select 1 from public.local_jobs where id = a and (not admin_hidden or active or publish_gate_reason <> 'no_application_path')) then
    raise exception 'FAIL 관리자 숨김 공고의 공개 칸이 다시 수집으로 바뀜'; end if;
end $$;
reset role;

-- ── 4. 경로 사칭 금지 ─────────────────────────────────────────────────────────
set role anon;
select public.t_expect_error($q$select public.ingest_job('{"channel":"crawler_topcv","title":"t","company":"c","source_text":"c"}')$q$, '수집 경로는 서버만');
select public.t_expect_error($q$select public.ingest_job('{"channel":"admin","title":"t","company":"c","source_text":"c"}')$q$, '관리자 경로는 관리자만');
select public.t_expect_error($q$select public.ingest_job('{"channel":"employer","title":"t","company":"c"}')$q$, '원문');
reset role;
set role service_role;
select public.t_expect_error($q$select public.ingest_job('{"channel":"lee_confirmed","title":"t","company":"c","source_text":"c"}')$q$, 'SQL·Lee 확인');
reset role;

-- ── 5. 게스트(비로그인)·고용주(로그인): RLS 그대로, 원문 보존 ───────────────────
set role anon;
do $$ declare a bigint; begin
  a := public.ingest_job(jsonb_build_object('channel','employer','title','Phụ bếp','company','Quán A','source_text','title: Phụ bếp\ncompany: Quán A',
       'guest_manage_token','guest-token-aaaaaaaaaaaaaaaa','employer_phone','0987654321','origin','crawler'));
  if a is null then raise exception 'FAIL 게스트 등록'; end if;
end $$;
select public.t_expect_error($q$select public.ingest_job('{"channel":"employer","title":"t","company":"c","source_text":"c","guest_manage_token":"short"}')$q$, 'row-level security');
reset role;
do $$ begin
  if not exists (select 1 from public.local_jobs where company = 'Quán A' and origin = 'employer' and employer_id is null) then
    raise exception 'FAIL 게스트 공고 출처(origin)는 경로로만 정해져야 함'; end if;
  if not exists (select 1 from public.job_ingest_raw r join public.local_jobs j on j.id = r.job_id where j.company = 'Quán A' and r.source_text like 'title: Phụ bếp%') then
    raise exception 'FAIL 게스트 원문 보존'; end if;
end $$;
set role authenticated;
select set_config('request.jwt.claim.sub', '00000000-0000-0000-0000-0000000000e1', false);
select set_config('request.jwt.claims', '{"sub":"00000000-0000-0000-0000-0000000000e1"}', false);
select public.ingest_job(jsonb_build_object('channel','employer','title','Thợ may','company','CTY May','source_text','title: Thợ may',
       'employer_id','00000000-0000-0000-0000-0000000000e1')) is not null as employer_ok;
-- 다른 사람 이름으로는 등록 불가(RLS)
select public.t_expect_error($q$select public.ingest_job('{"channel":"employer","title":"t","company":"c","source_text":"c","employer_id":"00000000-0000-0000-0000-0000000000b1"}')$q$, 'row-level security');
-- 옛 관리자 등록 함수는 닫힘
select public.t_expect_error($q$select public.admin_create_job('{"title":"t","company":"c"}')$q$, 'permission denied');
-- 일반 로그인 사용자는 관리자 경로 불가
select public.t_expect_error($q$select public.ingest_job('{"channel":"admin","title":"t","company":"c","source_text":"c"}')$q$, '관리자 경로는 관리자만');

-- ── 6. 관리자: 입구로 등록, 기존 규칙(R3·R5) 그대로 적용, 감사 기록 ───────────────
select set_config('request.jwt.claim.sub', '00000000-0000-0000-0000-0000000000a1', false);
select set_config('request.jwt.claims', '{"sub":"00000000-0000-0000-0000-0000000000a1","app_metadata":{"role":"admin"}}', false);
select public.t_expect_error($q$select public.ingest_job('{"channel":"admin","title":"t","company":"CTY Z","source_text":"CTY Z tuyển"}')$q$, 'job_rule_R3');
select public.t_expect_error($q$select public.ingest_job('{"channel":"admin","title":"t","company":"CTY Khác","source_text":"CTY Z tuyển","source_url":"https://fb/1"}')$q$, 'job_rule_R5');
select public.t_expect_error($q$select public.ingest_job('{"channel":"admin","title":"t","company":"CTY Z","source_text":"CTY Z tuyển","source_url":"https://fb/2","source":"Lee 확인(원문 Facebook, 작성자 A)"}')$q$, 'job_rule_R3');
select public.ingest_job(jsonb_build_object('channel','admin','title','Bảo vệ','company','CTY Z','source_text','CTY Z tuyển bảo vệ','source_url','https://fb/3')) is not null as admin_ok;
reset role;
select set_config('request.jwt.claims', '', false); select set_config('request.jwt.claim.sub', '', false);
do $$ begin
  if not exists (select 1 from public.admin_audit_logs where action = 'job.create' and metadata->>'via' = 'ingest_job') then
    raise exception 'FAIL 관리자 등록 감사 기록 없음'; end if;
end $$;

-- ── 7. DB 소유자(SQL 파일·migration)도 입구만: Lee 확인 기록은 소유자 경로에서만 ─────
do $$ declare a bigint; begin
  a := public.ingest_job(jsonb_build_object('channel','lee_confirmed','title','Phục vụ','company','Quán B','source_text','Quán B tuyển phục vụ',
       'source','Lee 확인(원문 Facebook, 작성자 Ngọc Mai)'));
  if not exists (select 1 from public.local_jobs where id = a and origin = 'admin') then raise exception 'FAIL Lee 확인 등록'; end if;
end $$;
-- 입구 표시는 한 번만: 입구를 부른 뒤 같은 트랜잭션에서 직접 넣으면 거부
begin;
select public.ingest_job(jsonb_build_object('channel','sql_file','title','A','company','Quán C','source_text','Quán C tuyển','source_url','https://s/c')) is not null;
select public.t_expect_error($q$insert into public.local_jobs(title, company, source_text, source_url) values ('t','Quán C','Quán C','https://s/d')$q$, 'ingest_gateway');
select public.t_expect_error($q$select set_config('jobi.ingest_raw', (select max(id)::text from public.job_ingest_raw), true); insert into public.local_jobs(title, company, source_text, source_url) values ('t','Quán C','Quán C','https://s/e')$q$, 'ingest_gateway');
commit;

drop function public.t_expect_error(text, text);
drop function public.t_raw_steps(bigint);
select 'PASS: ingest one-door (모든 길 같은 시험)' as result;
