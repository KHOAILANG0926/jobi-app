-- 수집 입구(Lee 2026-10-28 "적용"; 설계 docs/plans/2026-10-28-ingest-gateway.md, dry-run supabase/pending/ingest-gateway-20261028).
-- ① 원문 보존·중복·직업분류·위치·공개 순서의 입구 ingest_job(SECURITY INVOKER, 기존 트리거 전부 통과)
-- ② AI는 제안만 저장하는 표(job_ai_suggestions)
-- ③ 위치 결과는 공개 여부를 바꾸지 않는다(위치 못 찾음은 목록에만, 관리자 확인은 선택). 다시 공개 대상 0건 확인(run 40721734466).
begin;
do $$ begin
 if to_regclass('public.local_jobs') is null or to_regclass('public.map_r1_unlocated') is null
    or to_regprocedure('public.map_r1_has_canonical_pin(bigint)') is null or to_regprocedure('public.map_r1_mark_located(bigint)') is null
    or to_regprocedure('public.replace_job_work_locations(bigint,jsonb)') is null or to_regprocedure('public.job_phone_digits(text)') is null then
  raise exception 'ingest gateway preflight: required objects missing';
 end if;
 if to_regclass('public.job_ingest_raw') is not null then raise exception 'ingest gateway preflight: already applied'; end if;
end $$;

-- ① 원문 보존: 들어온 그대로 저장, 고치지 않는다.
create table public.job_ingest_raw (
  id bigint generated always as identity primary key,
  channel text not null check (channel in ('crawler_topcv','crawler_facebook','crawler_muaban','crawler_chotot','crawler_other','admin','employer','sql_file','lee_confirmed')),
  source text,                 -- 출처 이름(소스 멈춤 장치와 같은 값)
  source_url text,             -- 내부 중복 판정용, 공개 조회 금지
  source_text text not null,   -- 원문 글자 그대로
  images jsonb not null default '[]'::jsonb,
  submitted jsonb not null,    -- 경로가 보낸 칸(제목·회사·연락처·주소 …) 그대로
  content_hash text not null,  -- 중복 판정용(연락처 숫자+회사+원문 정규화 해시)
  job_id bigint references public.local_jobs(id) on delete set null,
  received_at timestamptz not null default now()
);
alter table public.job_ingest_raw enable row level security;
revoke all on public.job_ingest_raw from public, anon, authenticated;

-- 단계별 결과(왜 비공개인지 한 줄로 보여 주기 위함)
create table public.job_ingest_log (
  raw_id bigint not null references public.job_ingest_raw(id) on delete cascade,
  step text not null check (step in ('preserve','dedup','occupation','location','publication')),
  outcome text not null,       -- 예: duplicate_of:4982 / unclassified / area_pin / hidden:R3
  at timestamptz not null default now(),
  primary key (raw_id, step)
);
alter table public.job_ingest_log enable row level security;
revoke all on public.job_ingest_log from public, anon, authenticated;

-- AI는 제안만: 공고 칸을 직접 바꾸지 않는다.
create table public.job_ai_suggestions (
  job_id bigint not null references public.local_jobs(id) on delete cascade,
  field text not null,         -- shuttle_bus / dormitory / meal_provided / benefit_tag / line_kind …
  value jsonb not null,
  evidence text not null,      -- 원문 글자 그대로
  role text,                   -- 복수직무면 해당 직무 이름(있으면 공고 전체 칸 반영 금지)
  model text not null,
  status text not null default 'suggested' check (status in ('suggested','applied_by_rule','applied_by_lee','rejected')),
  created_at timestamptz not null default now(),
  primary key (job_id, field, evidence)
);
alter table public.job_ai_suggestions enable row level security;
revoke all on public.job_ai_suggestions from public, anon, authenticated;

-- 입구 함수: 순서 고정(원문 → 중복 → 직업분류 → 위치 → 공개). 경로별 분기 없음.
-- SECURITY INVOKER: 부른 사람 권한 그대로 기존 트리거(R1~R13·정책·직업분류·소스 멈춤)를 모두 거친다.
-- (definer로 만들면 R3·R7의 "기계 계정" 예외를 잘못 얻으므로 금지.)
create function public.ingest_job(p jsonb) returns bigint
language plpgsql security invoker set search_path = pg_catalog, public as $$
declare raw_id bigint; dup bigint; hash text; job public.local_jobs; fields jsonb; origin_v text; rows jsonb; cols text;
begin
  if coalesce(p->>'source_text','') = '' then raise exception 'ingest: source_text(원문) 필요'; end if;
  hash := md5(coalesce(public.job_phone_digits(p->>'employer_phone'),'') || '|' || lower(coalesce(p->>'company','')) || '|' || md5(p->>'source_text'));
  -- ① 원문 보존
  insert into public.job_ingest_raw(channel, source, source_url, source_text, images, submitted, content_hash)
  values (p->>'channel', p->>'source', p->>'source_url', p->>'source_text', coalesce(p->'images','[]'::jsonb), p, hash)
  returning id into raw_id;
  insert into public.job_ingest_log values (raw_id, 'preserve', 'ok');
  -- ② 중복: 같은 해시 또는 같은 source_url이 이미 공고에 연결돼 있으면 새 공고를 만들지 않는다.
  select r.job_id into dup from public.job_ingest_raw r
   where r.id <> raw_id and r.job_id is not null
     and (r.content_hash = hash or (p->>'source_url' is not null and r.source_url = p->>'source_url'))
   order by r.id limit 1;
  if dup is not null then
    update public.job_ingest_raw set job_id = dup where id = raw_id;
    insert into public.job_ingest_log values (raw_id, 'dedup', 'duplicate_of:' || dup);
    return dup;
  end if;
  insert into public.job_ingest_log values (raw_id, 'dedup', 'new');
  -- ③ 직업분류 + ⑤ 공개: 칸은 허용 목록만, 판정 칸(policy_decision·ocr_*·admin_hidden)은 받지 않는다.
  origin_v := case when p->>'channel' like 'crawler_%' then 'crawler' when p->>'channel' = 'employer' then 'employer' else 'admin' end;
  select coalesce(jsonb_object_agg(key, value), '{}'::jsonb) into fields from jsonb_each(p)
   where key in ('title','company','category','subcategory','occupation_code','occupation_evidence','salary','salary_min','salary_max',
                 'salary_period','location','hours','employer_phone','contact_zalo','contact_name','description','source','source_text',
                 'source_url','images','image_url','age_min','age_max','work_period','work_days','num_hires','employer_id','application_deadline');
  fields := fields || jsonb_build_object('origin', origin_v, 'active', coalesce((p->>'active')::boolean, true), 'admin_hidden', false);
  -- 받은 칸만 넣는다(나머지는 표 기본값). 칸 이름은 위 허용 목록에서만 온다.
  select string_agg(quote_ident(key), ',') into cols from jsonb_object_keys(fields) key;
  execute format('insert into public.local_jobs(%s) select %s from jsonb_populate_record(null::public.local_jobs, $1) returning *', cols, cols)
    into job using fields;
  update public.job_ingest_raw set job_id = job.id where id = raw_id;
  insert into public.job_ingest_log values (raw_id, 'occupation', case when job.occupation_code is null then 'unclassified' else 'code:' || job.occupation_code end);
  -- ④ 위치: 원본(job_work_locations)은 canonical writer만. 위치 결과는 공개 여부를 바꾸지 않는다(Lee 2026-10-28 ①).
  rows := coalesce(p->'work_locations', jsonb_build_array(jsonb_build_object('raw_address', job.location)));
  if origin_v = 'crawler' and job.location is not null then
    perform public.replace_job_work_locations(job.id, rows);
    insert into public.job_ingest_log values (raw_id, 'location', 'canonical_writer');
  else
    insert into public.job_ingest_log values (raw_id, 'location', 'save_hook');  -- 기존 저장 훅이 canonical writer로 기록
  end if;
  insert into public.job_ingest_log values (raw_id, 'publication',
    case when job.active then 'public' else 'hidden:' || coalesce(nullif(job.publish_gate_reason,''), nullif(job.policy_decision,''), 'gate') end);
  return job.id;
end $$;
revoke all on function public.ingest_job(jsonb) from public, anon;
revoke all on function public.ingest_job(jsonb) from authenticated;
-- 1단계: 서버 쪽 경로(service_role)만. 관리자·고용주 앱 경로는 전환 단계에서 RLS 정책과 함께 연다.
grant execute on function public.ingest_job(jsonb) to service_role;
grant insert, select, update on public.job_ingest_raw to service_role;
grant insert, select on public.job_ingest_log to service_role;
grant select, insert, update on public.job_ai_suggestions to service_role;
grant usage on sequence public.job_ingest_raw_id_seq to service_role;

-- 1) 앞으로: "위치 못 찾음"은 목록(map_r1_unlocated)에만 기록하고 active를 바꾸지 않는다.
create or replace function public.map_r1_mark_unlocated(p_id bigint, p_reason text) returns void
language plpgsql security invoker set search_path = pg_catalog, public as $$
begin
  if public.map_r1_has_canonical_pin(p_id) then perform public.map_r1_mark_located(p_id); return; end if;
  insert into public.map_r1_unlocated(job_id, prev_active, reason)
  select p_id, coalesce(j.active, false), coalesce(p_reason, 'our_miss') from public.local_jobs j where j.id = p_id
  on conflict (job_id) do update set last_checked = now(), reason = excluded.reason;
end $$;
-- 2) 앞으로: 목록에 있어도 공개를 막지 않는다(관리자 확인은 선택).
drop trigger if exists trg_map_r1_block_unlocated on public.local_jobs;
-- 3) 이미 위치 때문에만 숨겨진 공고(원래 공개였던 것)는 다시 공개 요청. 다른 차단(admin_hidden·직업분류·정책 등)은 트리거가 그대로 막는다.
do $$ declare r record; n int := 0; kept int := 0; begin
  for r in select u.job_id from public.map_r1_unlocated u join public.local_jobs j on j.id = u.job_id
           where u.prev_active and not j.active and not j.admin_hidden order by u.job_id loop
    begin
      update public.local_jobs set active = true where id = r.job_id;
      if (select active from public.local_jobs where id = r.job_id) then n := n + 1; else kept := kept + 1; end if;
    exception when others then kept := kept + 1; end;
  end loop;
  raise notice 'location-never-hides: republished %, kept hidden by other gates %', n, kept;
end $$;
commit;
