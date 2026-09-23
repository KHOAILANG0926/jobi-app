-- 커뮤니티 게시글 조회수. 비로그인 사용자도 볼 수 있으므로 anon도 증가시킬 수
-- 있어야 하고, 그렇다고 아무나 community_posts를 직접 UPDATE하게 둘 수는
-- 없으므로 조회수 1 증가만 하는 전용 함수로 좁힌다.

begin;

alter table public.community_posts
  add column if not exists views_count integer not null default 0;

create or replace function public.community_increment_views(p_post_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  update public.community_posts
  set views_count = views_count + 1
  where id = p_post_id;
end;
$$;

revoke execute on function public.community_increment_views(uuid) from public;
grant execute on function public.community_increment_views(uuid) to anon, authenticated;

commit;
