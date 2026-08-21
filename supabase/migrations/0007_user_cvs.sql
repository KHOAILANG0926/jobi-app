-- One JSONB CV document per authenticated user. Photos live in private Storage.

begin;

create table if not exists public.user_cvs (
  user_id uuid primary key references auth.users(id) on delete cascade,
  cv_data jsonb not null check (jsonb_typeof(cv_data) = 'object'),
  photo_path text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.user_cvs enable row level security;

drop policy if exists user_cvs_select_own on public.user_cvs;
drop policy if exists user_cvs_insert_own on public.user_cvs;
drop policy if exists user_cvs_update_own on public.user_cvs;

create policy user_cvs_select_own on public.user_cvs
  for select to authenticated
  using (user_id = auth.uid());

create policy user_cvs_insert_own on public.user_cvs
  for insert to authenticated
  with check (user_id = auth.uid());

create policy user_cvs_update_own on public.user_cvs
  for update to authenticated
  using (user_id = auth.uid())
  with check (user_id = auth.uid());

revoke all privileges on table public.user_cvs from anon, authenticated;
grant select, insert on table public.user_cvs to authenticated;
grant update (cv_data, photo_path, updated_at)
  on table public.user_cvs to authenticated;

commit;
