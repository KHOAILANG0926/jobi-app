-- 운영 점검(읽기 전용): R8 함수가 10-18 규칙(1~5단계 허용)이고 트리거가 켜져 있다(2026-11-03, 옛 정의 덮어쓰기 재발 감시).
do $check$
declare
  def text := pg_get_functiondef('public.local_jobs_occupation_r8()'::regprocedure);
begin
  if position('4·5단계만 허용' in def) > 0 or position('code_level' in def) > 0 then
    raise exception 'local_jobs_occupation_r8()이 옛 정의(4·5단계만 허용)로 돌아가 있음';
  end if;
  if not exists (select 1 from pg_trigger where tgrelid = 'public.local_jobs'::regclass and tgname = 'trg_zzz_local_jobs_occupation_r8' and tgenabled <> 'D') then
    raise exception 'trg_zzz_local_jobs_occupation_r8 트리거 없음 또는 꺼짐';
  end if;
  raise notice 'r8_any_level_restore production check passed';
end $check$;
