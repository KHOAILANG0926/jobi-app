-- 운영 점검(읽기 전용): 대표 이미지 고정 배정 칸(Lee 2026-11-27). 칸·모양 검사·공개 조회 권한이 있고 수정 권한은 없다. 데이터는 읽지 않는다.
do $check$
begin
  if not exists (select 1 from information_schema.columns where table_schema = 'public' and table_name = 'local_jobs'
                   and column_name = 'representative_image_id' and data_type = 'text' and is_nullable = 'YES') then
    raise exception '대표 이미지 번호 칸(text, null 허용) 없음';
  end if;
  if not exists (select 1 from pg_constraint where conrelid = 'public.local_jobs'::regclass and conname = 'local_jobs_representative_image_id_shape') then
    raise exception '대표 이미지 번호 모양 검사 없음';
  end if;
  if not has_column_privilege('anon', 'public.local_jobs', 'representative_image_id', 'select') then raise exception '대표 이미지 번호 공개 조회 안 됨'; end if;
  if has_column_privilege('anon', 'public.local_jobs', 'representative_image_id', 'update') then raise exception '비회원이 대표 이미지 번호를 고칠 수 있음'; end if;
  if has_column_privilege('authenticated', 'public.local_jobs', 'representative_image_id', 'update') then raise exception '회원이 대표 이미지 번호를 고칠 수 있음'; end if;
  raise notice 'representative_image_id production check passed';
end $check$;
