-- 운영 점검(읽기 전용): 소개소 공고 실제 근무 공장·공단 칸과 중복 판정(Lee 2026-11-07).
do $check$
begin
  if not exists (select 1 from information_schema.columns where table_schema = 'public' and table_name = 'local_jobs' and column_name = 'agency_workplace_key') then
    raise exception '소개소 근무 공장 칸 없음';
  end if;
  if has_column_privilege('anon', 'public.local_jobs', 'agency_workplace_key', 'select') then raise exception '소개소 근무 공장 칸이 공개 조회됨'; end if;
  if position('agency_workplace_key' in pg_get_functiondef('dedupe_private.verdict(bigint)'::regprocedure)) = 0 then
    raise exception '중복 판정이 근무 공장을 비교하지 않음';
  end if;
  raise notice 'agency_workplace_dedup production check passed';
end $check$;
