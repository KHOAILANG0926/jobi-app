-- One server-backed profile per authenticated user.

begin;

create table if not exists public.user_profiles (
  user_id uuid primary key references auth.users(id) on delete cascade,
  full_name text not null default '',
  phone text not null default '',
  email text not null default '',
  city text not null default '',
  bio text not null default '',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.user_profiles enable row level security;

drop policy if exists user_profiles_select_own on public.user_profiles;
drop policy if exists user_profiles_insert_own on public.user_profiles;
drop policy if exists user_profiles_update_own on public.user_profiles;

create policy user_profiles_select_own on public.user_profiles
  for select to authenticated
  using (user_id = auth.uid());

create policy user_profiles_insert_own on public.user_profiles
  for insert to authenticated
  with check (user_id = auth.uid());

create policy user_profiles_update_own on public.user_profiles
  for update to authenticated
  using (user_id = auth.uid())
  with check (user_id = auth.uid());

revoke all privileges on table public.user_profiles from anon, authenticated;
grant select, insert on table public.user_profiles to authenticated;
grant update (full_name, phone, email, city, bio, updated_at)
  on table public.user_profiles to authenticated;

commit;
