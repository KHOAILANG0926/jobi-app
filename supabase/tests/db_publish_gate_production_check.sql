-- 운영 점검(읽기 전용): 공개 판정 트리거가 있고, 수집·관리자 공고의 판정값이 DB 계산과 같고, 'ok'가 아닌 수집 공고는 공개되지 않았다.
do $check$
declare
  n int;
begin
  if not exists (select 1 from pg_trigger where tgrelid = 'public.local_jobs'::regclass and tgname = 'trg_zz0_publish_gate' and tgenabled <> 'D')
  then raise exception 'trg_zz0_publish_gate 없음 또는 꺼짐'; end if;
  select count(*) into n from public.local_jobs j where origin in ('crawler', 'admin') and publish_gate_reason is distinct from public.job_publish_gate_reason(j);
  if n > 0 then raise exception '판정값이 DB 계산과 다른 공고 %건', n; end if;
  select count(*) into n from public.local_jobs where origin = 'crawler' and active and publish_gate_reason <> 'ok';
  if n > 0 then raise exception 'ok 아닌 수집 공고가 공개 중 %건', n; end if;
  raise notice 'db_publish_gate production check passed';
end $check$;
