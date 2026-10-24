-- Read-only private account details; no account email/phone disclosed to the public.
create or replace function public.admin_user_details()
returns table(user_id uuid, email text, phone text, full_name text, city text, last_sign_in_at timestamptz)
language plpgsql stable security definer set search_path=pg_catalog,public,auth as $$
begin
 perform public.require_admin();
 return query
 select u.id, coalesce(nullif(p.email,''),u.email),
        coalesce(nullif(p.phone,''),u.phone), p.full_name,p.city,u.last_sign_in_at
 from auth.users u
 left join public.user_profiles p on p.user_id=u.id
 where coalesce(u.raw_app_meta_data->>'role','') <> 'admin';
end $$;
revoke all on function public.admin_user_details() from public,anon,authenticated;
grant execute on function public.admin_user_details() to authenticated;
