-- 운영 점검(읽기 전용): 회사 코드표(Lee 2026-11-06)가 있고 공개 조회에서 막혀 있다.
do $check$
declare
  t text;
begin
  foreach t in array array['job_companies', 'job_company_names', 'job_company_phones', 'job_company_branches'] loop
    if to_regclass('public.' || t) is null then raise exception '회사 코드표 없음: %', t; end if;
    if not (select relrowsecurity from pg_class where oid = ('public.' || t)::regclass) then raise exception 'RLS 꺼짐: %', t; end if;
    if has_table_privilege('anon', 'public.' || t, 'select') or has_table_privilege('authenticated', 'public.' || t, 'select') then
      raise exception '공개 조회 가능: %', t;
    end if;
  end loop;
  if has_column_privilege('anon', 'public.local_jobs', 'company_id', 'select')
     or has_column_privilege('anon', 'public.local_jobs', 'company_branch_id', 'select') then
    raise exception 'local_jobs 회사 연결 칸이 공개 조회에 보임';
  end if;
  raise notice 'job_company_codes production check passed';
end $check$;
