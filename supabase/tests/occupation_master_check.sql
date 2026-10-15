-- 운영 DB 점검: occupation_master 적용 결과 (읽기 전용). 조건이 틀리면 오류로 중단한다.
do $$
declare n int;
begin
  select count(*) into n from public.occupation_master;            if n <> 1505 then raise exception 'occupation_master % (기대 1505)', n; end if;
  select count(*) into n from public.occupation_descriptions;      if n <> 603  then raise exception 'occupation_descriptions % (기대 603)', n; end if;
  select count(*) into n from public.occupation_aliases;           if n <> 21   then raise exception 'occupation_aliases % (기대 21)', n; end if;
  select count(*) into n from public.occupation_master c left join public.occupation_master p on p.code = c.parent_code
    where c.level > 1 and p.code is null;                          if n <> 0 then raise exception '부모 누락 %', n; end if;
  if (select string_agg(cnt::text, '/' order by level) from (select level, count(*) cnt from public.occupation_master group by level) t)
     <> '10/48/152/509/786' then raise exception '단계별 건수 불일치'; end if;
  if not has_table_privilege('anon', 'public.occupation_master', 'select') then raise exception 'anon 읽기 권한 없음'; end if;
  if has_table_privilege('anon', 'public.occupation_master', 'insert') then raise exception 'anon 쓰기 권한 있음'; end if;
  raise notice 'occupation_master 점검 OK';
end $$;
