-- DRY-RUN ONLY (Lee 승인 전 적용 금지). 2026-10-28 수집 입구 설계 — docs/plans/2026-10-28-ingest-gateway.md
-- 운영 적용은 승인 후 supabase/migrations/ + *_production_check.sql 정상 경로로만.
-- 트랜잭션 제어 없음: 시험 실행기(run-local.sh)가 begin … rollback 안에서 읽는다.

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
