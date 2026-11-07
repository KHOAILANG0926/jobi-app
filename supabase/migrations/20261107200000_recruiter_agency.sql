-- 소개소(인력 회사) 표시(Lee 2026-11-07 "소개소를 회사로 쓰고 표시"): 회사 칸에 소개소 이름을 쓰고 이 칸으로 "소개소"를 표시한다.
-- 값은 등록 입구의 회사 이름 읽기 한 곳(src/lib/companyReader.ts, 위치 확인 서버)이 정한다. 화면 표시는 Lee가 글 모형을 정한 뒤.
do $pre$
begin
  if to_regclass('public.local_jobs') is null then raise exception 'recruiter_agency: local_jobs 없음'; end if;
  if exists (select 1 from information_schema.columns where table_schema = 'public' and table_name = 'local_jobs' and column_name = 'recruiter_agency') then
    raise exception 'recruiter_agency: 이미 적용됨';
  end if;
end $pre$;

alter table public.local_jobs add column recruiter_agency boolean not null default false;
comment on column public.local_jobs.recruiter_agency is '소개소(인력 회사)가 올린 공고 — 회사 칸은 소개소 이름(Lee 2026-11-07).';
grant select (recruiter_agency) on public.local_jobs to anon, authenticated;
