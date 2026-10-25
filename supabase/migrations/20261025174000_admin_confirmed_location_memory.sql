-- Lee 2026-10-25: approved coordinates are reused only for identical normalized
-- address or identical company+industrial park. Do not mark approximate coordinates verified.
create table if not exists public.admin_confirmed_location_memory (
  source_candidate_id bigint primary key,
  address_key text not null,
  company_key text not null,
  park_key text,
  lat double precision not null,
  lng double precision not null,
  approved_by uuid not null,
  approved_at timestamptz not null,
  source_address text not null
);
alter table public.admin_confirmed_location_memory enable row level security;
revoke all on public.admin_confirmed_location_memory from public, anon, authenticated;
grant select, insert, update on public.admin_confirmed_location_memory to service_role;

create or replace function public.admin_location_key(p_text text) returns text
language sql stable set search_path = pg_catalog, public as $
  select lower(btrim(regexp_replace(public.unaccent(coalesce(p_text,'')), '[[:space:][:punct:]]+', ' ', 'g')))
$;
revoke all on function public.admin_location_key(text) from public, anon, authenticated;

create or replace function public.admin_reuse_confirmed_location(p_job_id bigint) returns integer
language plpgsql security definer set search_path=pg_catalog,public as $$
declare j record; m record; addr text; workid bigint; n integer := 0;
begin
  select id,company,location from public.local_jobs where id=p_job_id into j;
  if j.id is null then return 0; end if;
  -- Any exact/approved job is already resolved. Never overwrite an existing decision.
  if exists(select 1 from public.job_location_candidates c where c.job_id=p_job_id and c.status='approved')
    or exists(select 1 from public.job_work_locations w where w.job_id=p_job_id
      and w.location_verified and w.lat between 8 and 24 and w.lng between 102 and 110)
  then return 0; end if;
  select mem.* into m
  from public.admin_confirmed_location_memory mem
  where (mem.address_key<>'' and
    (mem.address_key=public.admin_location_key(j.location)
      or exists(select 1 from public.job_work_locations w where w.job_id=p_job_id
        and mem.address_key=public.admin_location_key(w.raw_address))))
    or (mem.company_key<>'' and mem.park_key is not null and mem.park_key<>''
      and mem.company_key=public.admin_location_key(j.company)
      and exists(select 1 from public.job_work_locations w where w.job_id=p_job_id
        and mem.park_key=public.admin_location_key(w.industrial_park)))
  order by mem.approved_at desc limit 1;
  if m.source_candidate_id is null then return 0; end if;
  select w.id, w.raw_address into workid,addr
  from public.job_work_locations w where w.job_id=p_job_id
  and (public.admin_location_key(w.raw_address)=m.address_key
    or (m.park_key is not null and public.admin_location_key(w.industrial_park)=m.park_key))
  order by w.sort_order nulls last limit 1;
  addr:=coalesce(nullif(addr,''),nullif(j.location,''),m.source_address);
  if addr is null then return 0; end if;
  insert into public.job_location_candidates(job_id,work_location_id,company_snapshot,address_snapshot,
    lat,lng,place_precision,source,evidence,evidence_urls,status,review_note,reviewed_by,reviewed_at,created_by)
  values(p_job_id,workid,j.company,addr,m.lat,m.lng,'building','other',
    'AUTO REUSE: source confirmed candidate #'||m.source_candidate_id,'{}',
    'approved','자동 적용: 동일 주소 또는 동일 회사+공단',m.approved_by,now(),m.approved_by);
  insert into public.admin_audit_logs(admin_user_id,action,target_type,target_id,metadata)
  values(m.approved_by,'location_candidate.auto_reuse','job',p_job_id::text,
    jsonb_build_object('source_candidate_id',m.source_candidate_id,'address',addr));
  return 1;
end $$;
revoke all on function public.admin_reuse_confirmed_location(bigint) from public,anon,authenticated;

create or replace function public.admin_remember_confirmed_location() returns trigger
language plpgsql security definer set search_path=pg_catalog,public as $$
declare j record; p text; other_job record;
begin
  if new.status<>'approved' or old.status='approved' or new.reviewed_by is null then return new; end if;
  select company into j from public.local_jobs where id=new.job_id;
  select industrial_park into p from public.job_work_locations
    where job_id=new.job_id and
      (id=new.work_location_id or public.admin_location_key(raw_address)=public.admin_location_key(new.address_snapshot))
    order by (id=new.work_location_id) desc limit 1;
  insert into public.admin_confirmed_location_memory
    (source_candidate_id,address_key,company_key,park_key,lat,lng,approved_by,approved_at,source_address)
  values(new.id,public.admin_location_key(new.address_snapshot),public.admin_location_key(j.company),
    nullif(public.admin_location_key(p),''),new.lat,new.lng,new.reviewed_by,new.reviewed_at,new.address_snapshot)
  on conflict (source_candidate_id) do nothing;
  for other_job in select id from public.local_jobs where id<>new.job_id loop
    perform public.admin_reuse_confirmed_location(other_job.id);
  end loop;
  return new;
end $$;
revoke all on function public.admin_remember_confirmed_location() from public,anon,authenticated;
drop trigger if exists trg_admin_remember_confirmed_location on public.job_location_candidates;
create trigger trg_admin_remember_confirmed_location after update of status on public.job_location_candidates
for each row when (new.status='approved') execute function public.admin_remember_confirmed_location();

create or replace function public.admin_apply_remembered_to_new_job() returns trigger
language plpgsql security definer set search_path=pg_catalog,public as $$
begin
  perform public.admin_reuse_confirmed_location(new.id);
  return new;
end $$;
revoke all on function public.admin_apply_remembered_to_new_job() from public,anon,authenticated;
drop trigger if exists trg_admin_remembered_jobs on public.local_jobs;
create trigger trg_admin_remembered_jobs after insert or update of location,company on public.local_jobs
for each row execute function public.admin_apply_remembered_to_new_job();

create or replace function public.admin_apply_remembered_to_work_location() returns trigger
language plpgsql security definer set search_path=pg_catalog,public as $$
begin
  perform public.admin_reuse_confirmed_location(new.job_id);
  return new;
end $$;
revoke all on function public.admin_apply_remembered_to_work_location() from public,anon,authenticated;
drop trigger if exists trg_admin_remembered_work_locations on public.job_work_locations;
create trigger trg_admin_remembered_work_locations after insert or update of raw_address,industrial_park on public.job_work_locations
for each row execute function public.admin_apply_remembered_to_work_location();
