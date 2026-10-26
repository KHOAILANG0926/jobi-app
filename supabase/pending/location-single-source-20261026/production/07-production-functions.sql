CREATE OR REPLACE FUNCTION public.admin_location_key(p_text text)
 RETURNS text
 LANGUAGE sql
 STABLE
 SET search_path TO 'pg_catalog', 'public'
AS $function$
  select lower(btrim(regexp_replace(public.unaccent(coalesce(p_text,'')), '[[:space:][:punct:]]+', ' ', 'g')))
$function$;

CREATE OR REPLACE FUNCTION public.can_manage_local_job(p_job_id bigint, p_token text)
 RETURNS boolean
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
  select exists (
    select 1 from public.local_jobs l
    where l.id = p_job_id
      and (
        (auth.uid() is not null and l.employer_id = auth.uid() and public.is_account_active(auth.uid()))
        or (l.employer_id is null and l.guest_manage_token is not null
            and p_token is not null and length(p_token) >= 20 and l.guest_manage_token = p_token)
      )
  );
$function$;

CREATE OR REPLACE FUNCTION public.job_work_locations_fill_normalized()
 RETURNS trigger
 LANGUAGE plpgsql
AS $function$
begin
  if new.normalized_address is null or btrim(new.normalized_address) = '' then
    new.normalized_address := regexp_replace(
      trim(both ' ' from unaccent(lower(coalesce(new.raw_address, '')))),
      '\s+', ' ', 'g'
    );
  end if;
  new.updated_at := now();
  return new;
end;
$function$;

CREATE OR REPLACE FUNCTION public.map_r1_snapshot(p_id bigint)
 RETURNS jsonb
 LANGUAGE sql
 STABLE
 SET search_path TO 'pg_catalog', 'public'
AS $function$
 select jsonb_build_object('id',j.id,'company',coalesce(j.company,''),'location',coalesce(j.location,''),
 'targets',coalesce((select jsonb_agg(jsonb_build_object('address',w.raw_address,'workLocationId',w.id) order by w.sort_order,w.id)
 from public.job_work_locations w where w.job_id=j.id),'[]'::jsonb)) from public.local_jobs j where j.id=p_id
$function$;

CREATE OR REPLACE FUNCTION public.require_admin()
 RETURNS uuid
 LANGUAGE plpgsql
 STABLE
 SET search_path TO 'pg_catalog', 'public'
AS $function$
declare caller uuid := auth.uid();
begin
  if caller is null or coalesce(auth.jwt() -> 'app_metadata' ->> 'role', '') <> 'admin' then
    raise exception 'admin access required' using errcode = '42501';
  end if;
  return caller;
end;
$function$;

CREATE INDEX job_location_candidates_job_idx ON public.job_location_candidates USING btree (job_id);
CREATE UNIQUE INDEX job_location_candidates_one_approved ON public.job_location_candidates USING btree (job_id, address_snapshot) WHERE (status = 'approved'::text);
CREATE INDEX idx_job_work_locations_job_id ON public.job_work_locations USING btree (job_id);
CREATE INDEX idx_job_work_locations_geog ON public.job_work_locations USING gist (geog);
create trigger trg_job_work_locations_fill_normalized before insert or update on public.job_work_locations for each row execute function public.job_work_locations_fill_normalized();

