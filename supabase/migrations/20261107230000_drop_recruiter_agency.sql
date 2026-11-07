-- 소개소 표시를 원래 '채용 형태' 칸(recruitment_type='agency') 하나로 되돌린다(Lee 2026-11-07 "같은 내용을 두 번 적는 게 맞아? 원래대로").
-- 20261107200000_recruiter_agency.sql이 같은 내용을 적는 칸을 따로 만들었다(기존 칸 확인 누락). 수집 입구는 이제 recruitment_type에 적는다.
-- 이 칸에 소개소로 적힌 공고가 있으면 내용이 없어지므로 지우지 않고 멈춘다(읽기 전용 확인 run 42387154011: 0건).
do $pre$
begin
  if not exists (select 1 from information_schema.columns where table_schema = 'public' and table_name = 'local_jobs' and column_name = 'recruiter_agency') then
    raise exception 'drop_recruiter_agency: 칸이 이미 없음';
  end if;
  if exists (select 1 from public.local_jobs where recruiter_agency) then
    raise exception 'drop_recruiter_agency: 이 칸에만 소개소로 적힌 공고가 있음 — 원래 칸으로 옮긴 뒤 지운다';
  end if;
end $pre$;

alter table public.local_jobs drop column recruiter_agency;
