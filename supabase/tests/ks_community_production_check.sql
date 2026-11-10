-- 운영 점검(읽기 전용): 한국 사이트 표가 있고, 잠금(RLS)이 켜져 있고, 손님 쓰기·성별 보기가 막혀 있다.
do $check$
declare t text;
begin
  foreach t in array array['ks_profiles','ks_posts','ks_comments','ks_companies','ks_reviews'] loop
    if to_regclass('public.' || t) is null then raise exception '% 표 없음', t; end if;
    if not (select relrowsecurity from pg_class where oid = ('public.' || t)::regclass) then raise exception '% 잠금(RLS) 꺼짐', t; end if;
    if has_table_privilege('anon', 'public.' || t, 'insert') or has_table_privilege('anon', 'public.' || t, 'update') or has_table_privilege('anon', 'public.' || t, 'delete') then
      raise exception '% 손님 쓰기 열림', t;
    end if;
    if has_table_privilege('authenticated', 'public.' || t, 'delete') then raise exception '% 지우기 열림', t; end if;
  end loop;
  if has_column_privilege('anon', 'public.ks_profiles', 'gender', 'select') or has_column_privilege('authenticated', 'public.ks_profiles', 'nationality', 'select') then
    raise exception '성별·국적이 남에게 보임';
  end if;
  if has_function_privilege('anon', 'public.ks_add_review(text, text, text, int, text, boolean, int, text)', 'execute') then raise exception '손님이 후기를 씀'; end if;
end $check$;
