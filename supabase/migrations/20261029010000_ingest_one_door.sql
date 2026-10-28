-- 수집 입구 2단계 — 공고 등록은 ingest_job 하나만 (Lee 2026-10-29 "ok": 길마다 따로 고치지 않고 구조로 막기).
-- 설계: docs/plans/2026-10-28-ingest-gateway.md §5-2·5-5.
-- ① 입구는 계속 SECURITY INVOKER: 부른 사람(anon·authenticated·service_role·DB 소유자) 권한 그대로 RLS·R1~R13·정책·직업분류·소스 멈춤을 모두 거친다.
--    (definer로 바꾸면 R3·R7의 "DB 소유자=기계" 예외를 잘못 얻는다.)
-- ② 입구가 이번 트랜잭션에 막 연 원문 기록(job_ingest_raw)이 없는 local_jobs INSERT는 DB가 거부한다.
--    서버 키·DB 소유자 계정·SQL 파일·migration도 예외 없음. 새 등록 경로가 생겨도 입구를 거치지 않으면 저장되지 않는다.
-- ③ 입구가 받는 칸 = local_jobs의 모든 칸 - 판정 칸(origin·admin_hidden·policy_decision·ocr_*·id·시각). 새 칸이 생겨도 빠뜨리지 않는다.
-- ④ 중복: 입구 기록 + 기존 공고(source_url, 연락처 숫자+회사+원문)까지 본다. 같은 공고면 새로 만들지 않는다.
--    다시 수집(refresh 또는 job_id 지정)이면 받은 칸 중 바뀐 칸만 고친다(update_fields를 주면 그 칸만). 공개·숨김 판정 칸은 받지 않고,
--    active·publish_gate_reason·crawler_version·last_verified_at은 같은 출처(origin)이며 관리자 숨김이 아닌 공고에만 반영.
-- ⑤ 경로 이름(channel)은 기록용. 단 부른 사람이 그 경로를 쓸 수 있는지만 확인(수집 경로 사칭 금지).
-- ⑥ 옛 관리자 등록 함수(admin_create_job, 소유자 권한으로 돌아 R3·R7 예외를 얻던 길)는 실행 권한 회수.
begin;
do $$ begin
 if to_regprocedure('public.ingest_job(jsonb)') is null or to_regclass('public.job_ingest_raw') is null
    or to_regclass('public.job_ingest_log') is null or to_regprocedure('public.is_admin()') is null
    or to_regprocedure('public.job_phone_digits(text)') is null or to_regclass('public.admin_audit_logs') is null
    or to_regprocedure('public.admin_create_job(jsonb)') is null then
  raise exception 'ingest one-door preflight: required objects missing';
 end if;
 if to_regnamespace('ingest_private') is not null then raise exception 'ingest one-door preflight: already applied'; end if;
end $$;

-- 비공개 도우미(REST에 노출되지 않는 스키마). 입구 함수 안에서만 쓴다.
create schema ingest_private;
revoke all on schema ingest_private from public;
grant usage on schema ingest_private to anon, authenticated, service_role;

-- 원문 기록이 "이번 트랜잭션"에 열렸는지 확인하기 위한 칸
alter table public.job_ingest_raw add column xact bigint not null default txid_current();

create function ingest_private.open_raw(p_channel text, p_source text, p_source_url text, p_source_text text,
  p_images jsonb, p_submitted jsonb, p_hash text) returns bigint
language plpgsql security definer set search_path = pg_catalog, public as $$
declare v bigint;
begin
  insert into public.job_ingest_raw(channel, source, source_url, source_text, images, submitted, content_hash)
  values (p_channel, p_source, p_source_url, p_source_text, coalesce(p_images, '[]'::jsonb), p_submitted, p_hash)
  returning id into v;
  insert into public.job_ingest_log values (v, 'preserve', 'ok');
  return v;
end $$;

create function ingest_private.log(p_raw bigint, p_step text, p_outcome text) returns void
language sql security definer set search_path = pg_catalog, public as $$
  insert into public.job_ingest_log(raw_id, step, outcome) values (p_raw, p_step, p_outcome)
  on conflict (raw_id, step) do update set outcome = excluded.outcome, at = now();
$$;

create function ingest_private.link(p_raw bigint, p_job bigint) returns void
language sql security definer set search_path = pg_catalog, public as $$
  update public.job_ingest_raw set job_id = p_job where id = p_raw;
$$;

-- 같은 공고 찾기: 입구 기록 → 기존 공고 source_url → 기존 공고 연락처 숫자+회사+원문(경로와 무관)
create function ingest_private.find_existing(p_raw bigint, p_hash text, p_source_url text, p_phone text, p_company text, p_source_text text)
returns bigint language sql stable security definer set search_path = pg_catalog, public as $$
  select coalesce(
    (select r.job_id from public.job_ingest_raw r join public.local_jobs j on j.id = r.job_id
      where r.id <> p_raw and (r.content_hash = p_hash or (nullif(p_source_url, '') is not null and r.source_url = p_source_url))
      order by r.id limit 1),
    (select j.id from public.local_jobs j where nullif(p_source_url, '') is not null and j.source_url = p_source_url order by j.id limit 1),
    (select j.id from public.local_jobs j
      where nullif(trim(p_source_text), '') is not null and j.source_text is not null and md5(j.source_text) = md5(p_source_text)
        and coalesce(public.job_phone_digits(j.employer_phone), '') = coalesce(public.job_phone_digits(p_phone), '')
        and lower(coalesce(j.company, '')) = lower(coalesce(p_company, ''))
      order by j.id limit 1));
$$;

-- 부른 사람에게 안 보이는 공고(게스트의 보류 공고 등)도 입구가 결과를 기록할 수 있게 상태만 읽는다(번호·출처·숨김·공개·사유·직업코드).
create function ingest_private.job_state(p_job bigint, out origin text, out admin_hidden boolean, out active boolean, out reason text, out occupation_code text)
language sql stable security definer set search_path = pg_catalog, public as $$
  select j.origin, j.admin_hidden, j.active, coalesce(nullif(j.publish_gate_reason, ''), nullif(j.policy_decision, '')), j.occupation_code
    from public.local_jobs j where j.id = p_job;
$$;

create function ingest_private.audit_admin_create(p_job bigint, p_title text) returns void
language plpgsql security definer set search_path = pg_catalog, public as $$
begin
  if auth.uid() is null or not public.is_admin() then return; end if;
  insert into public.admin_audit_logs(admin_user_id, action, target_type, target_id, metadata)
  values (auth.uid(), 'job.create', 'job', p_job::text, jsonb_build_object('title', p_title, 'origin', 'admin', 'via', 'ingest_job'));
end $$;

revoke all on function ingest_private.open_raw(text,text,text,text,jsonb,jsonb,text), ingest_private.log(bigint,text,text),
  ingest_private.link(bigint,bigint), ingest_private.find_existing(bigint,text,text,text,text,text),
  ingest_private.job_state(bigint), ingest_private.audit_admin_create(bigint,text) from public;
grant execute on function ingest_private.open_raw(text,text,text,text,jsonb,jsonb,text), ingest_private.log(bigint,text,text),
  ingest_private.link(bigint,bigint), ingest_private.find_existing(bigint,text,text,text,text,text),
  ingest_private.job_state(bigint), ingest_private.audit_admin_create(bigint,text) to anon, authenticated, service_role;

-- 입구를 거치지 않은 등록 거부(모든 계정). 표시는 입구가 이번 트랜잭션에 연 원문 기록 번호.
create function ingest_private.enforce_gateway_insert() returns trigger
language plpgsql security definer set search_path = pg_catalog, public as $$
declare raw bigint := nullif(current_setting('jobi.ingest_raw', true), '')::bigint;
begin
  if raw is not null and exists (select 1 from public.job_ingest_raw r where r.id = raw and r.job_id is null and r.xact = txid_current()) then
    -- 새 공고 번호를 입구에 넘긴다(RETURNING은 부른 사람에게 안 보이는 행이면 RLS에 걸리므로 쓰지 않음). 한 번 쓰면 표시 해제.
    perform set_config('jobi.ingest_new_id', NEW.id::text, true);
    perform set_config('jobi.ingest_raw', '', true);
    return NEW;
  end if;
  raise exception 'ingest_gateway: 공고 등록은 public.ingest_job(원문 묶음)으로만 가능' using errcode = 'insufficient_privilege';
end $$;
revoke all on function ingest_private.enforce_gateway_insert() from public;
create trigger trg_00_ingest_gateway_only before insert on public.local_jobs
  for each row execute function ingest_private.enforce_gateway_insert();

-- 관리자도 입구로 등록(부른 사람 권한). 옛 소유자 권한 함수 대신.
create policy local_jobs_admin_insert on public.local_jobs for insert to authenticated
  with check (public.is_admin() and origin = 'admin');
revoke execute on function public.admin_create_job(jsonb) from authenticated, anon, public;

create or replace function public.ingest_job(p jsonb) returns bigint
language plpgsql security invoker set search_path = pg_catalog, public as $$
declare
  ch text := p->>'channel';
  caller text := current_user;
  owner_roles text[] := array['postgres', 'supabase_admin'];
  origin_v text; hash text; raw_id bigint; target bigint; fields jsonb; cols text; n int;
  st record; new_id bigint; new_active boolean; new_occ text; new_reason text;
begin
  if coalesce(trim(p->>'source_text'), '') = '' then
    raise exception 'ingest: source_text(원문) 필요' using errcode = 'check_violation';
  end if;
  if ch is null or ch not in ('crawler_topcv','crawler_facebook','crawler_muaban','crawler_chotot','crawler_other','admin','employer','sql_file','lee_confirmed') then
    raise exception 'ingest: 알 수 없는 경로 %', coalesce(ch, '(없음)') using errcode = 'check_violation';
  end if;
  -- 경로 사칭 금지(처리 순서·기준은 경로와 무관)
  if ch like 'crawler_%' and not (caller = 'service_role' or caller = any(owner_roles)) then
    raise exception 'ingest: 수집 경로는 서버만 사용' using errcode = 'insufficient_privilege';
  end if;
  if ch in ('sql_file', 'lee_confirmed') and not (caller = any(owner_roles)) then
    raise exception 'ingest: SQL·Lee 확인 경로는 승인된 DB 작업만' using errcode = 'insufficient_privilege';
  end if;
  if ch = 'admin' and not (caller = 'service_role' or caller = any(owner_roles) or (caller = 'authenticated' and public.is_admin())) then
    raise exception 'ingest: 관리자 경로는 관리자만' using errcode = 'insufficient_privilege';
  end if;
  origin_v := case when ch like 'crawler_%' then 'crawler' when ch = 'employer' then 'employer' else 'admin' end;

  -- ① 원문 보존
  hash := md5(coalesce(public.job_phone_digits(p->>'employer_phone'), '') || '|' || lower(coalesce(p->>'company', '')) || '|' || md5(p->>'source_text'));
  raw_id := ingest_private.open_raw(ch, p->>'source', p->>'source_url', p->>'source_text', p->'images', p, hash);

  -- 받는 칸: local_jobs의 실제 칸 - 판정 칸
  select coalesce(jsonb_object_agg(e.key, e.value), '{}'::jsonb) into fields
    from jsonb_each(p) e
   where e.key in (select a.attname from pg_attribute a where a.attrelid = 'public.local_jobs'::regclass and a.attnum > 0 and not a.attisdropped)
     and e.key not in ('id', 'origin', 'admin_hidden', 'policy_decision', 'ocr_text', 'ocr_check', 'created_at', 'updated_at');

  -- ② 중복 / 다시 수집
  target := nullif(p->>'job_id', '')::bigint;
  if target is null then
    target := ingest_private.find_existing(raw_id, hash, p->>'source_url', p->>'employer_phone', p->>'company', p->>'source_text');
  else
    perform 1 from ingest_private.job_state(target) s where s.origin is not null;
    if not found then raise exception 'ingest: 다시 수집 대상 공고 % 없음', target using errcode = 'check_violation'; end if;
  end if;
  if target is not null then
    perform ingest_private.link(raw_id, target);
    if coalesce((p->>'refresh')::boolean, false) or p ? 'job_id' then
      select * into st from ingest_private.job_state(target);
      -- 고칠 칸 목록(update_fields)을 주면 그 칸만 고친다(원문은 항상 원문 기록에 보존).
      if jsonb_typeof(p->'update_fields') = 'array' then
        select coalesce(jsonb_object_agg(e.key, e.value), '{}'::jsonb) into fields from jsonb_each(fields) e
         where e.key in (select jsonb_array_elements_text(p->'update_fields'));
      end if;
      if st.origin is distinct from origin_v or st.admin_hidden then
        fields := fields - 'active' - 'publish_gate_reason' - 'crawler_version' - 'last_verified_at';
      end if;
      n := 0;
      if fields <> '{}'::jsonb then
        select string_agg(quote_ident(k), ',' order by k) into cols from jsonb_object_keys(fields) k;
        execute format('update public.local_jobs j set (%1$s) = (select %1$s from jsonb_populate_record(null::public.local_jobs, $1)) '
                       'where j.id = $2 and row(%2$s) is distinct from (select row(%1$s) from jsonb_populate_record(null::public.local_jobs, $1))',
                       cols, (select string_agg('j.' || quote_ident(k), ',' order by k) from jsonb_object_keys(fields) k))
          using fields, target;
        get diagnostics n = row_count;
      end if;
      perform ingest_private.log(raw_id, 'dedup', 'refresh:' || target || case when n > 0 then ':changed' else ':unchanged' end);
    else
      perform ingest_private.log(raw_id, 'dedup', 'duplicate_of:' || target);
      return target;
    end if;
    new_id := target;
  else
    perform ingest_private.log(raw_id, 'dedup', 'new');
    -- ③ 직업분류 + ⑤ 공개: 기존 DB 트리거가 판단(입구는 판정 칸을 받지 않음)
    fields := fields || jsonb_build_object('origin', origin_v, 'admin_hidden', false, 'active', coalesce((p->>'active')::boolean, true));
    select string_agg(quote_ident(k), ',') into cols from jsonb_object_keys(fields) k;
    perform set_config('jobi.ingest_new_id', '', true);
    perform set_config('jobi.ingest_raw', raw_id::text, true);
    execute format('insert into public.local_jobs(%1$s) select %1$s from jsonb_populate_record(null::public.local_jobs, $1)', cols) using fields;
    perform set_config('jobi.ingest_raw', '', true);
    new_id := nullif(current_setting('jobi.ingest_new_id', true), '')::bigint;
    perform set_config('jobi.ingest_new_id', '', true);
    if new_id is null or not exists (select 1 from ingest_private.job_state(new_id) s where s.origin is not null) then
      perform ingest_private.log(raw_id, 'publication', 'not_saved');
      raise exception 'ingest: 공고가 저장되지 않음(규칙이 건너뜀)' using errcode = 'check_violation';
    end if;
    perform ingest_private.link(raw_id, new_id);
  end if;
  select s.active, s.reason, s.occupation_code into new_active, new_reason, new_occ from ingest_private.job_state(new_id) s;
  perform ingest_private.log(raw_id, 'occupation', case when new_occ is null then 'unclassified' else 'code:' || new_occ end);

  -- ④ 위치: 보낸 근무지가 있으면 canonical writer(권한은 부른 사람 그대로), 없으면 기존 저장 훅. 경로와 무관.
  if jsonb_typeof(p->'work_locations') = 'array' then
    perform public.replace_job_work_locations(new_id, p->'work_locations');
    perform ingest_private.log(raw_id, 'location', 'canonical_writer');
  else
    perform ingest_private.log(raw_id, 'location', 'save_hook');
  end if;
  if ch = 'admin' and target is null then perform ingest_private.audit_admin_create(new_id, p->>'title'); end if;
  perform ingest_private.log(raw_id, 'publication', case when new_active then 'public' else 'hidden:' || coalesce(new_reason, 'gate') end);
  return new_id;
end $$;
revoke all on function public.ingest_job(jsonb) from public;
grant execute on function public.ingest_job(jsonb) to anon, authenticated, service_role;
commit;
