-- Immutable, administrator-only session access evidence.
create table if not exists public.admin_access_events (
  id bigint generated always as identity primary key,
  admin_user_id uuid not null,
  occurred_at timestamptz not null default now(),
  event_type text not null check(event_type in ('admin_page_access','admin_page_exit')),
  ip_address inet,
  user_agent text,
  request_id uuid not null unique
);
revoke all on public.admin_access_events from public, anon, authenticated;
create index if not exists admin_access_events_recent on public.admin_access_events(occurred_at desc);
create index if not exists admin_access_events_actor on public.admin_access_events(admin_user_id, occurred_at desc);
alter table public.admin_access_events enable row level security;

create or replace function public.admin_access_history()
returns table(id bigint, admin_user_id uuid, occurred_at timestamptz, event_type text,
              ip_address text, user_agent text)
language plpgsql security definer set search_path = pg_catalog, public as $$
begin
  perform public.require_admin();
  return query select e.id,e.admin_user_id,e.occurred_at,e.event_type,
    host(e.ip_address),e.user_agent from public.admin_access_events e
  order by e.occurred_at desc limit 200;
end $$;
revoke all on function public.admin_access_history() from public,anon,authenticated;
grant execute on function public.admin_access_history() to authenticated;
