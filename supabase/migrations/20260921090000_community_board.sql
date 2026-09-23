-- Community board: 지금까지 브라우저 localStorage에만 저장되던 게시판을 공용
-- 테이블로 전환한다. 읽기는 로그인 여부와 무관하게 공개(레딧처럼 누구나 볼 수
-- 있음), 쓰기(글/댓글/좋아요)는 로그인 사용자 본인 소유 행만 허용한다.

begin;

create table if not exists public.community_posts (
  id uuid primary key default gen_random_uuid(),
  author_id uuid not null references auth.users(id),
  author_name text not null,
  category text not null check (category in ('review', 'tip', 'question')),
  title text not null check (length(trim(title)) > 0),
  body text not null check (length(trim(body)) > 0),
  job_category text,
  company text,
  rating smallint check (rating between 1 and 5),
  photo_paths text[] not null default '{}',
  likes_count integer not null default 0,
  comments_count integer not null default 0,
  created_at timestamptz not null default now()
);

create table if not exists public.community_comments (
  id uuid primary key default gen_random_uuid(),
  post_id uuid not null references public.community_posts(id) on delete cascade,
  author_id uuid not null references auth.users(id),
  author_name text not null,
  body text not null check (length(trim(body)) > 0),
  created_at timestamptz not null default now()
);

create table if not exists public.community_likes (
  post_id uuid not null references public.community_posts(id) on delete cascade,
  user_id uuid not null references auth.users(id),
  created_at timestamptz not null default now(),
  primary key (post_id, user_id)
);

create index if not exists community_posts_created_at_idx on public.community_posts (created_at desc);
create index if not exists community_comments_post_id_idx on public.community_comments (post_id);

-- likes_count / comments_count는 카드 목록에서 매번 집계 쿼리를 안 돌리려고
-- 트리거로 비정규화해서 유지한다.
create or replace function public.community_sync_likes_count()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if tg_op = 'INSERT' then
    update public.community_posts set likes_count = likes_count + 1 where id = new.post_id;
    return new;
  elsif tg_op = 'DELETE' then
    update public.community_posts set likes_count = greatest(0, likes_count - 1) where id = old.post_id;
    return old;
  end if;
  return null;
end;
$$;

drop trigger if exists community_likes_sync on public.community_likes;
create trigger community_likes_sync
  after insert or delete on public.community_likes
  for each row execute function public.community_sync_likes_count();

create or replace function public.community_sync_comments_count()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if tg_op = 'INSERT' then
    update public.community_posts set comments_count = comments_count + 1 where id = new.post_id;
    return new;
  elsif tg_op = 'DELETE' then
    update public.community_posts set comments_count = greatest(0, comments_count - 1) where id = old.post_id;
    return old;
  end if;
  return null;
end;
$$;

drop trigger if exists community_comments_sync on public.community_comments;
create trigger community_comments_sync
  after insert or delete on public.community_comments
  for each row execute function public.community_sync_comments_count();

alter table public.community_posts enable row level security;
alter table public.community_comments enable row level security;
alter table public.community_likes enable row level security;

drop policy if exists community_posts_select on public.community_posts;
drop policy if exists community_posts_insert on public.community_posts;
drop policy if exists community_posts_update on public.community_posts;
drop policy if exists community_posts_delete on public.community_posts;

create policy community_posts_select on public.community_posts
  for select
  to anon, authenticated
  using (true);

create policy community_posts_insert on public.community_posts
  for insert
  to authenticated
  with check (author_id = auth.uid());

create policy community_posts_update on public.community_posts
  for update
  to authenticated
  using (author_id = auth.uid())
  with check (author_id = auth.uid());

create policy community_posts_delete on public.community_posts
  for delete
  to authenticated
  using (author_id = auth.uid());

drop policy if exists community_comments_select on public.community_comments;
drop policy if exists community_comments_insert on public.community_comments;
drop policy if exists community_comments_delete on public.community_comments;

create policy community_comments_select on public.community_comments
  for select
  to anon, authenticated
  using (true);

create policy community_comments_insert on public.community_comments
  for insert
  to authenticated
  with check (author_id = auth.uid());

create policy community_comments_delete on public.community_comments
  for delete
  to authenticated
  using (author_id = auth.uid());

drop policy if exists community_likes_select on public.community_likes;
drop policy if exists community_likes_insert on public.community_likes;
drop policy if exists community_likes_delete on public.community_likes;

create policy community_likes_select on public.community_likes
  for select
  to anon, authenticated
  using (true);

create policy community_likes_insert on public.community_likes
  for insert
  to authenticated
  with check (user_id = auth.uid());

create policy community_likes_delete on public.community_likes
  for delete
  to authenticated
  using (user_id = auth.uid());

revoke all privileges on table public.community_posts from anon, authenticated;
grant select on table public.community_posts to anon, authenticated;
grant insert (author_id, author_name, category, title, body, job_category, company, rating, photo_paths)
  on table public.community_posts to authenticated;
grant update (title, body, job_category, company, rating, photo_paths)
  on table public.community_posts to authenticated;
grant delete on table public.community_posts to authenticated;

revoke all privileges on table public.community_comments from anon, authenticated;
grant select on table public.community_comments to anon, authenticated;
grant insert (post_id, author_id, author_name, body) on table public.community_comments to authenticated;
grant delete on table public.community_comments to authenticated;

revoke all privileges on table public.community_likes from anon, authenticated;
grant select on table public.community_likes to anon, authenticated;
grant insert (post_id, user_id) on table public.community_likes to authenticated;
grant delete on table public.community_likes to authenticated;

commit;
