-- 운영 DB 점검: R8 적용 결과 (읽기 전용). 조건이 틀리면 오류로 중단한다.
do $$
declare n int;
begin
  select count(*) into n from information_schema.columns where table_schema='public' and table_name='local_jobs'
    and column_name in ('occupation_code','occupation_evidence');
  if n <> 2 then raise exception 'R8 칸 % (기대 2)', n; end if;
  if not exists (select 1 from pg_trigger where tgrelid='public.local_jobs'::regclass and tgname='trg_zzz_local_jobs_occupation_r8') then
    raise exception 'R8 트리거 없음'; end if;
  if not has_column_privilege('anon', 'public.local_jobs', 'occupation_code', 'select') then raise exception 'anon 읽기 권한 없음'; end if;
  if has_column_privilege('anon', 'public.local_jobs', 'source_text', 'select') then raise exception 'source_text 공개됨'; end if;
  select count(*) into n from public.local_jobs where occupation_code is not null and (occupation_evidence is null
    or position(lower(normalize(occupation_evidence, NFC)) in lower(normalize(coalesce(title,'')||E'\n'||coalesce(source_text,'')||E'\n'||coalesce(description,''), NFC))) = 0);
  if n <> 0 then raise exception '근거가 원문에 없는 분류 %건', n; end if;
  raise notice 'R8 점검 OK';
end $$;
