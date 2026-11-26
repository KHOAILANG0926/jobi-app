-- 시험 DB 준비(폐기용): 운영 ingest_job 본문 중 이 migration이 바꾸는 두 줄(origin 판정 줄·갱신 칸 보호 줄)만 가진 대역.
-- 진짜 운영 본문 대상 시험과 실제 동작 시험은 ingest_write_guard.pglite.test.mjs(운영 20261029010000 본문을 파일에서 그대로 읽어 시험)가 한다.
create schema if not exists ingest_private;
create or replace function public.ingest_job(p jsonb) returns bigint language plpgsql as $f$
declare ch text := p->>'channel'; origin_v text; st record; fields jsonb := '{}'::jsonb; raw_id bigint; hash text := 'h';
begin
  raw_id := ingest_private.open_raw(ch, null, null, null, null, p, hash);
  origin_v := case when ch like 'crawler_%' then 'crawler' when ch = 'employer' then 'employer' else 'admin' end;
  if st.origin is distinct from origin_v or st.admin_hidden then
    fields := fields - 'active';
  end if;
  return null;
end $f$;
