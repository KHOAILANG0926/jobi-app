-- 20261127120000 시험(폐기용 DB): 새 칸이 있고 기존 공고는 null이며, 형식이 틀린 값은 거부되고, 공개 조회만 열려 있고 수정 권한은 없다.
begin;
insert into public.local_jobs(id, company) values (994001, 'Công ty ảnh đại diện CI');
do $t$ declare v text; ok boolean;
begin
  -- 1) 기존 공고(방금 넣은 줄 포함)는 배정 전 = null
  select representative_image_id into v from public.local_jobs where id = 994001;
  if v is not null then raise exception '1: new column must start as null (got %)', v; end if;
  -- 2) 올바른 번호는 저장된다
  update public.local_jobs set representative_image_id = 'dich_vu-salon-001' where id = 994001;
  select representative_image_id into v from public.local_jobs where id = 994001;
  if v <> 'dich_vu-salon-001' then raise exception '2: valid id must be stored (got %)', v; end if;
  -- 3) 모양이 틀린 값(대문자·공백·긴 글)은 거부
  ok := false;
  begin update public.local_jobs set representative_image_id = 'Bad Id!' where id = 994001; exception when check_violation then ok := true; end;
  if not ok then raise exception '3: malformed id must be rejected'; end if;
  ok := false;
  begin update public.local_jobs set representative_image_id = repeat('a', 81) where id = 994001; exception when check_violation then ok := true; end;
  if not ok then raise exception '3b: too long id must be rejected'; end if;
  -- 4) 공개 조회만: anon·authenticated는 읽을 수 있고 고칠 수 없다
  if not has_column_privilege('anon', 'public.local_jobs', 'representative_image_id', 'select') then raise exception '4: anon must read the column'; end if;
  if not has_column_privilege('authenticated', 'public.local_jobs', 'representative_image_id', 'select') then raise exception '4b: authenticated must read the column'; end if;
  if has_column_privilege('anon', 'public.local_jobs', 'representative_image_id', 'update') then raise exception '4c: anon must not update the column'; end if;
  if has_column_privilege('authenticated', 'public.local_jobs', 'representative_image_id', 'update') then raise exception '4d: authenticated must not update the column'; end if;
  raise notice 'representative_image_id local check passed';
end $t$;
rollback;
