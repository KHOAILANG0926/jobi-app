-- 운영 점검(읽기 전용): 1:1 문의 표 권한(Lee 2026-11-08).
do $check$
begin
  if has_table_privilege('anon', 'public.support_inquiries', 'select') then raise exception '1:1 문의를 비회원이 읽을 수 있음'; end if;
  if has_table_privilege('anon', 'public.support_inquiries', 'update') or has_table_privilege('anon', 'public.support_inquiries', 'delete') then raise exception '비회원이 문의를 고치거나 지울 수 있음'; end if;
  if has_table_privilege('authenticated', 'public.support_inquiries', 'delete') then raise exception '회원이 문의를 지울 수 있음'; end if;
  if has_column_privilege('anon', 'public.support_inquiries', 'status', 'insert') then raise exception '비회원이 처리 상태를 넣을 수 있음'; end if;
  if not has_column_privilege('anon', 'public.support_inquiries', 'message', 'insert') then raise exception '1:1 문의 넣기 권한 없음'; end if;
  raise notice 'support_inquiries_privileges production check passed';
end $check$;
