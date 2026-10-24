-- Private member details for logged-in administrators only.
-- Does not modify user records or expose auth metadata to ordinary members.
create or replace function public.admin_user_details()
returns table(
  user_id uuid, full_name text, email text, phone text, city text, last_sign_in_at timestamptz
)
language plpgsql stable security definer
set search_path = pg_catalog, public
as $$
begin
  perform public.require_admin();
  return query
    select u.id,
           coalesce(nullif(btrim(p.full_name), ''),
                    nullif(btrim(u.raw_user_meta_data->>'name'), ''),
                    nullif(btrim(u.raw_user_meta_data->>'full_name'), '')),
           coalesce(nullif(btrim(u.email), ''), nullif(btrim(p.email), '')),
           coalesce(nullif(btrim(u.phone), ''), nullif(btrim(p.phone), '')),
           nullif(btrim(p.city), ''),
           u.last_sign_in_at
      from auth.users u
      left join public.user_profiles p on p.user_id = u.id
     where coalesce(u.raw_app_meta_data->>'role', '') <> 'admin';
end;
$$;

revoke all on function public.admin_user_details() from public, anon, authenticated;
grant execute on function public.admin_user_details() to authenticated;
