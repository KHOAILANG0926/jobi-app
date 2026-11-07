-- 운영 점검(읽기 전용): 소개소 표시 칸(Lee 2026-11-07).
do $check$
begin
  if not exists (select 1 from information_schema.columns where table_schema = 'public' and table_name = 'local_jobs'
                 and column_name = 'recruiter_agency' and data_type = 'boolean' and is_nullable = 'NO') then
    raise exception '소개소 표시 칸 없음';
  end if;
  if not has_column_privilege('anon', 'public.local_jobs', 'recruiter_agency', 'select') then raise exception '소개소 표시 칸 공개 조회 안 됨'; end if;
  raise notice 'recruiter_agency production check passed';
end $check$;
