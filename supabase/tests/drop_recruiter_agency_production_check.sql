-- 운영 점검(읽기 전용): 소개소 표시는 원래 '채용 형태' 칸 하나(Lee 2026-11-07). 따로 만든 칸이 없어야 한다.
do $check$
begin
  if exists (select 1 from information_schema.columns where table_schema = 'public' and table_name = 'local_jobs' and column_name = 'recruiter_agency') then
    raise exception '소개소 표시 칸이 두 개(recruiter_agency 남아 있음)';
  end if;
  if not exists (select 1 from information_schema.columns where table_schema = 'public' and table_name = 'local_jobs' and column_name = 'recruitment_type') then
    raise exception '원래 채용 형태 칸(recruitment_type) 없음';
  end if;
  raise notice 'drop_recruiter_agency production check passed';
end $check$;
