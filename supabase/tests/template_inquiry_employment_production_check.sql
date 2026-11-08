-- 운영 점검(읽기 전용): 템플릿 상세모집요강 칸·추가 고용형태 칸·1:1 문의 표와 권한(Lee 2026-11-08).
do $check$
begin
  if not exists (select 1 from information_schema.columns where table_schema = 'public' and table_name = 'local_jobs' and column_name = 'description_html') then
    raise exception '템플릿 상세모집요강 칸 없음';
  end if;
  if not has_column_privilege('anon', 'public.local_jobs', 'description_html', 'select') then raise exception '템플릿 칸 공개 조회 안 됨'; end if;
  if not has_column_privilege('anon', 'public.local_jobs', 'employment_type_extra', 'select') then raise exception '추가 고용형태 칸 없음/비공개'; end if;
  if to_regclass('public.support_inquiries') is null then raise exception '1:1 문의 표 없음'; end if;
  if not (select relrowsecurity from pg_class where oid = 'public.support_inquiries'::regclass) then raise exception '1:1 문의 RLS 꺼짐'; end if;
  if has_table_privilege('anon', 'public.support_inquiries', 'select') then raise exception '1:1 문의를 비회원이 읽을 수 있음'; end if;
  if not has_column_privilege('anon', 'public.support_inquiries', 'message', 'insert') then raise exception '1:1 문의 넣기 권한 없음'; end if;
  if has_column_privilege('anon', 'public.support_inquiries', 'status', 'insert') then raise exception '비회원이 처리 상태를 넣을 수 있음'; end if;
  raise notice 'template_inquiry_employment production check passed';
end $check$;
