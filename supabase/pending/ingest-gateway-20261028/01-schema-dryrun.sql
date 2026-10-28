-- DRY-RUN ONLY (Lee 승인 전 적용 금지). 2026-10-28 수집 입구 설계 — docs/plans/2026-10-28-ingest-gateway.md
-- 운영 적용은 승인 후 supabase/migrations/ + *_production_check.sql 정상 경로로만.
-- 이 파일은 트랜잭션 끝에서 ROLLBACK 한다(로컬 폐기용 DB 시험 전용).
begin;

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

-- 입구 함수 뼈대: 순서 고정(원문 → 중복 → 직업분류 → 위치 → 공개). 경로별 분기 없음.
create function public.ingest_job(p jsonb) returns bigint
language plpgsql security definer set search_path = pg_catalog, public as $$
declare raw_id bigint; dup bigint;
begin
  insert into public.job_ingest_raw(channel, source, source_url, source_text, images, submitted, content_hash)
  values (p->>'channel', p->>'source', p->>'source_url', p->>'source_text', coalesce(p->'images','[]'::jsonb), p,
          md5(coalesce(public.job_phone_digits(p->>'employer_phone'),'') || '|' || lower(coalesce(p->>'company','')) || '|' || md5(coalesce(p->>'source_text',''))))
  returning id into raw_id;
  insert into public.job_ingest_log values (raw_id, 'preserve', 'ok');
  -- ② 중복: 같은 해시 또는 같은 source_url이 이미 공고와 연결돼 있으면 새 공고를 만들지 않는다.
  select r.job_id into dup from public.job_ingest_raw r
   where r.id <> raw_id and r.job_id is not null
     and (r.content_hash = (select content_hash from public.job_ingest_raw where id = raw_id)
          or (p->>'source_url' is not null and r.source_url = p->>'source_url'))
   limit 1;
  if dup is not null then
    update public.job_ingest_raw set job_id = dup where id = raw_id;
    insert into public.job_ingest_log values (raw_id, 'dedup', 'duplicate_of:' || dup);
    return dup;
  end if;
  insert into public.job_ingest_log values (raw_id, 'dedup', 'new');
  -- ③~⑤는 구현 단계에서 기존 함수 재사용: 직업분류(occupation_master 규칙), 위치(location_private.write_location),
  --   공개 판정(기존 트리거 R1~R13·정책·직업분류). 위치 결과는 active를 바꾸지 않는다.
  raise exception 'dry-run skeleton: steps 3-5 not implemented';
end $$;
revoke all on function public.ingest_job(jsonb) from public, anon, authenticated;

rollback;
