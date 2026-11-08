-- 20261108130000 운영 점검 실패 후속(Lee 2026-11-08 "진행"): Supabase 기본 권한 때문에 support_inquiries에 anon·authenticated가
-- 모든 권한(읽기 포함)을 받아 '비회원이 읽을 수 있음' 점검에 걸렸다(RLS로 실제 행은 0건). 표 단위 권한을 걷고 필요한 것만 다시 준다.
do $pre$
begin
  if to_regclass('public.support_inquiries') is null then raise exception 'support_inquiries_privileges: 표 없음'; end if;
end $pre$;

revoke all on table public.support_inquiries from anon, authenticated;
grant insert (audience, category, name, contact, message) on public.support_inquiries to anon, authenticated;
grant select on public.support_inquiries to authenticated;          -- 실제로는 RLS로 관리자만
grant update (status, admin_note) on public.support_inquiries to authenticated;  -- 실제로는 RLS로 관리자만
