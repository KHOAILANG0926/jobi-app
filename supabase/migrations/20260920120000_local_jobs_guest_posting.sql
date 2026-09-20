-- 게스트(비로그인) 공고 등록 지원.
-- 2026-09-20 사용자 지시("가입 자체가 너무 귀찮다는 의견이 많아" — 등록
-- 없이도 채용공고를 올릴 수 있게) — 여러 라운드 논의 끝에 확정된 설계:
--   1. 완전 익명 INSERT는 절대 허용하지 않는다(누구나 스팸 공고를 무제한
--      올릴 수 있게 됨) — 대신 클라이언트가 미리 만든 무작위 관리 토큰을
--      같이 넣어야만 INSERT가 허용된다. 그 토큰을 아는 사람만 나중에 그
--      공고를 고치거나 내릴 수 있다("관리 링크"의 정체).
--   2. employer_id는 게스트 공고에서 항상 NULL — 이미 크롤링 공고가 쓰고
--      있는 패턴 그대로(0004_local_jobs_employer_id.sql부터 employer_id는
--      nullable). 기존 "본인 소유 판정(employer_id = auth.uid())" 로직과
--      전혀 안 겹친다.
--   3. 관리 링크를 잃어버려도 관리자는 기존 is_admin() 우회 경로로 항상
--      개입 가능(이 마이그레이션은 그 경로를 전혀 건드리지 않음) — 그리고
--      게스트 공고도 다른 공고와 동일하게 application_deadline이 지나면
--      자연히 "마감" 처리된다(PostJob.tsx가 게스트 경로엔 7일 기본값을
--      쓰도록 프론트에서만 처리 — DB 제약 아님).
--   4. guest_manage_token 컬럼은 비밀값이라 일반 브라우징 SELECT(공개
--      목록 조회)에서 절대 응답에 실리면 안 된다 — fetchJobs()/rowToJob()
--      쪽 select 컬럼 목록에 이 컬럼을 추가하지 않는 것으로 애초에
--      막혀있고(프론트 코드 컨벤션), 이 마이그레이션에서도 컬럼 단위
--      REVOKE로 한 번 더 막는다(방어적 이중 장치 — 둘 중 하나만 있어도
--      막히지만 둘 다 건다).

begin;

-- 1) 게스트 공고 관리 토큰 컬럼 — nullable, 게스트 공고에만 값이 있음
--    (기업 계정 공고/크롤링 공고는 항상 NULL로 남는다).
alter table public.local_jobs
  add column if not exists guest_manage_token text;

comment on column public.local_jobs.guest_manage_token is
  '비로그인 게스트가 올린 공고의 관리 토큰(무작위, 클라이언트가 생성). 이 값을 아는 사람만 get_guest_job()/update_guest_job()으로 그 공고를 조회·수정할 수 있다. employer_id가 NULL인 공고에만 값이 있다. 일반 조회(fetchJobs 등)에는 절대 노출하지 않는다.';

-- 방어적 이중 장치 — 앱 코드가 이 컬럼을 select 목록에 절대 안 넣는 것과
-- 별개로, 컬럼 단위 권한 자체를 막아 혹시 모를 select('*') 실수로도
-- 값이 새어나가지 않게 한다.
revoke select (guest_manage_token) on public.local_jobs from anon, authenticated;

-- 2) 비로그인(anon) INSERT 허용 — employer_id는 반드시 NULL, 관리 토큰은
--    반드시 함께 와야 한다(토큰 없이 게스트로 등록하는 길 자체를 안 열어둠
--    — "토큰을 잃어버려도 아무도 못 고친다"가 아니라 애초에 토큰 없는
--    게스트 공고 자체가 생기지 않는다).
create policy local_jobs_guest_insert on public.local_jobs
  for insert to anon
  with check (
    employer_id is null
    and guest_manage_token is not null
    and length(guest_manage_token) >= 20
  );

grant insert on public.local_jobs to anon;

-- 3) 관리 링크로 들어온 게스트 본인이 자기 공고를 조회하는 함수.
--    SECURITY DEFINER로 테이블 소유자 권한으로 실행되므로 RLS/컬럼 REVOKE를
--    내부적으로 우회하지만, 함수 자체가 토큰이 정확히 일치할 때만 행을
--    돌려주므로 안전하다(토큰을 모르면 절대 조회 불가).
create or replace function public.get_guest_job(p_job_id bigint, p_token text)
returns table (
  id bigint,
  title text,
  company text,
  category text,
  salary text,
  location text,
  hours text,
  employer_phone text,
  application_deadline date,
  description text,
  active boolean,
  posted_at date
)
language sql
stable
security definer
set search_path = public
as $$
  select
    l.id, l.title, l.company, l.category, l.salary, l.location, l.hours,
    l.employer_phone, l.application_deadline, l.description, l.active, l.posted_at
  from public.local_jobs l
  where l.id = p_job_id
    and l.employer_id is null
    and l.guest_manage_token is not null
    and l.guest_manage_token = p_token;
$$;

revoke all on function public.get_guest_job(bigint, text) from public;
grant execute on function public.get_guest_job(bigint, text) to anon, authenticated;

-- 4) 관리 링크로 들어온 게스트 본인이 자기 공고를 수정(또는 active=false로
--    마감 처리)하는 함수 — 기존 employer용 UPDATE 권한(0005 migration)이
--    허용하는 컬럼 중 게스트 셀프서비스에 실제로 필요한 항목만 좁혀서
--    받는다. p_* 인자가 NULL이면 그 컬럼은 그대로 둔다(부분 수정).
create or replace function public.update_guest_job(
  p_job_id bigint,
  p_token text,
  p_title text default null,
  p_company text default null,
  p_salary text default null,
  p_location text default null,
  p_hours text default null,
  p_employer_phone text default null,
  p_application_deadline date default null,
  p_description text default null,
  p_active boolean default null
)
returns table (
  id bigint,
  title text,
  active boolean
)
language plpgsql
security definer
set search_path = public
as $$
begin
  return query
  update public.local_jobs l
  set
    title = coalesce(p_title, l.title),
    company = coalesce(p_company, l.company),
    salary = coalesce(p_salary, l.salary),
    location = coalesce(p_location, l.location),
    hours = coalesce(p_hours, l.hours),
    employer_phone = coalesce(p_employer_phone, l.employer_phone),
    application_deadline = coalesce(p_application_deadline, l.application_deadline),
    description = coalesce(p_description, l.description),
    active = coalesce(p_active, l.active)
  where l.id = p_job_id
    and l.employer_id is null
    and l.guest_manage_token is not null
    and l.guest_manage_token = p_token
  returning l.id, l.title, l.active;
end;
$$;

revoke all on function public.update_guest_job(bigint, text, text, text, text, text, text, text, date, text, boolean) from public;
grant execute on function public.update_guest_job(bigint, text, text, text, text, text, text, text, date, text, boolean) to anon, authenticated;

commit;
