-- MAP-R1: pending approval. Never executed by the scheduled workflow.
-- Requires existing local_jobs, job_work_locations, job_location_candidates,
-- research_artifacts and vietmap_usage_take(date, integer).
begin;
create table public.map_r1_location_jobs (
  job_id bigint primary key references public.local_jobs(id) on delete cascade,
  snapshot jsonb not null,
  state text not null check (state in ('processing','done','failed','deferred')),
  calls integer not null default 0 check (calls between 0 and 2),
  failures integer not null default 0,
  lease uuid,
  updated_at timestamptz not null default now(),
  result jsonb
);
alter table public.map_r1_location_jobs enable row level security;
revoke all on public.map_r1_location_jobs from public, anon, authenticated;
grant select, insert, update on public.map_r1_location_jobs to service_role;

-- All functions are invoker and service-role-only, including the snapshot helper.
create function public.map_r1_snapshot(p_id bigint) returns jsonb
language sql stable security invoker set search_path = pg_catalog, public as $$
 select jsonb_build_object('id',j.id,'company',coalesce(j.company,''),'location',coalesce(j.location,''),
 'targets',coalesce((select jsonb_agg(jsonb_build_object('address',w.raw_address,'workLocationId',w.id) order by w.sort_order,w.id)
 from public.job_work_locations w where w.job_id=j.id),'[]'::jsonb)) from public.local_jobs j where j.id=p_id
$$;
create function public.map_r1_has_exact(p_id bigint) returns boolean
language sql stable security invoker set search_path = pg_catalog, public as $$
 select exists(select 1 from public.job_work_locations w where w.job_id=p_id and w.location_verified and w.lat between 8 and 24 and w.lng between 102 and 110)
 or exists(select 1 from public.job_location_candidates c join public.local_jobs j on j.id=c.job_id
 where c.job_id=p_id and c.status='approved' and c.company_snapshot=j.company
 and (c.address_snapshot=j.location or exists(select 1 from public.job_work_locations w where w.job_id=p_id and w.raw_address=c.address_snapshot)))
$$;
create function public.map_r1_claim_batch(p_limit integer, p_lease uuid)
returns table(job_id bigint, snapshot jsonb, calls integer)
language plpgsql security invoker set search_path = pg_catalog, public as $$
declare j record; snap jsonb; r public.map_r1_location_jobs; n integer:=0;
begin
 if p_limit < 1 or p_limit > 20 or p_lease is null then raise exception 'invalid batch'; end if;
 -- Global transaction lock shared by administrator and Actions. Does not rely on workflow concurrency alone.
 if not pg_try_advisory_xact_lock(20261015, 1) then return; end if;
 for j in select id from public.local_jobs where active and not admin_hidden order by id loop
   exit when n>=p_limit;
   if public.map_r1_has_exact(j.id) then continue; end if;
   -- Respect human rejection/revocation. Manual exception remains available.
   if exists(select 1 from public.job_location_candidates c where c.job_id=j.id and c.status in ('rejected','revoked')) then continue; end if;
   snap:=public.map_r1_snapshot(j.id);
   select * into r from public.map_r1_location_jobs s where s.job_id=j.id for update;
   if found then
     if r.state='processing' and r.updated_at > now()-interval '10 minutes' then continue; end if;
     if r.snapshot=snap and r.state='done' then continue; end if;
     if r.snapshot=snap and r.state='deferred' and r.updated_at > now()-interval '1 hour' then continue; end if;
     if r.snapshot=snap and r.state='failed' and (r.failures>=2 or r.calls>=2 or r.updated_at > now()-interval '1 hour') then continue; end if;
     update public.map_r1_location_jobs s set snapshot=snap,state='processing',lease=p_lease,updated_at=now(),result=null where s.job_id=j.id;
   else
     insert into public.map_r1_location_jobs(job_id,snapshot,state,lease) values(j.id,snap,'processing',p_lease);
   end if;
   return query select s.job_id,s.snapshot,s.calls from public.map_r1_location_jobs s where s.job_id=j.id;
   n:=n+1;
 end loop;
end $$;
create function public.map_r1_reserve_call(p_id bigint,p_lease uuid) returns boolean
language plpgsql security invoker set search_path = pg_catalog, public as $$
declare r public.map_r1_location_jobs; quota record;
begin
 select * into r from public.map_r1_location_jobs where job_id=p_id for update;
 if not found or r.lease is distinct from p_lease or r.state<>'processing' or r.calls>=2 then return false; end if;
 select * into quota from public.vietmap_usage_take((now() at time zone 'Asia/Ho_Chi_Minh')::date,250);
 if not quota.ok then return false; end if;
 update public.map_r1_location_jobs set calls=calls+1,updated_at=now() where job_id=p_id;
 return true;
end $$;
create function public.map_r1_complete(p_id bigint,p_lease uuid,p_result jsonb) returns boolean
language plpgsql security invoker set search_path = pg_catalog, public as $$
declare r public.map_r1_location_jobs; k text; candidate_id bigint; addr text; latv double precision; lngv double precision;
begin
 perform 1 from public.local_jobs where id=p_id for update;
 select * into r from public.map_r1_location_jobs where job_id=p_id for update;
 if not found or r.lease is distinct from p_lease or r.state<>'processing' then return false; end if;
 if r.snapshot is distinct from public.map_r1_snapshot(p_id) then
   update public.map_r1_location_jobs set state='failed',failures=failures+1,lease=null,updated_at=now() where job_id=p_id;
   return false;
 end if;
 k:=p_result->>'kind';
 if k not in ('exact','gate','area','unresolved') or k is null then raise exception 'invalid result'; end if;
 if k<>'unresolved' then
   latv:=(p_result->>'lat')::double precision; lngv:=(p_result->>'lng')::double precision;
   if latv is null or lngv is null or not(latv between 8 and 24 and lngv between 102 and 110)
     or coalesce(p_result->>'source','')='' or coalesce(p_result->>'checkedAt','')='' then raise exception 'missing provenance'; end if;
 end if;
 if k='exact' and not public.map_r1_has_exact(p_id) then
   addr:=p_result->>'address';
   if coalesce(r.snapshot->>'company','')='' or coalesce(p_result->>'evidence','')=''
     or not(addr=r.snapshot->>'location' or exists(select 1 from jsonb_array_elements(r.snapshot->'targets') t where t->>'address'=addr)) then raise exception 'invalid exact evidence'; end if;
   if exists(select 1 from public.job_location_candidates where job_id=p_id and status in ('rejected','revoked')) then return false; end if;
   select id into candidate_id from public.job_location_candidates where job_id=p_id and address_snapshot=addr and company_snapshot=r.snapshot->>'company'
     and status='pending' and abs(lat-latv)<0.0001 and abs(lng-lngv)<0.0001 order by id limit 1;
   if candidate_id is not null then
     update public.job_location_candidates set status='approved',place_precision='site',source='map_listing',evidence=p_result->>'evidence',review_note='MAP-R1 verified matching',reviewed_at=now() where id=candidate_id;
   else
     insert into public.job_location_candidates(job_id,work_location_id,company_snapshot,address_snapshot,lat,lng,place_precision,source,evidence,status,review_note,reviewed_at)
     values(p_id,(p_result->>'workLocationId')::bigint,r.snapshot->>'company',addr,latv,lngv,'site','map_listing',p_result->>'evidence','approved','MAP-R1 verified matching',now())
     on conflict (job_id,address_snapshot) where status='approved' do nothing;
   end if;
 end if;
 -- No writes to local_jobs or job_work_locations; public/hidden flags are untouched.
 update public.map_r1_location_jobs set result=p_result,state=case when coalesce((p_result->>'deferred')::boolean,false) then 'deferred' when coalesce((p_result->>'failed')::boolean,false) then 'failed' else 'done' end,
 failures=failures+case when coalesce((p_result->>'failed')::boolean,false) then 1 else 0 end,lease=null,updated_at=now() where job_id=p_id;
 return true;
end $$;
create function public.map_r1_public_points(p_ids bigint[]) returns table(job_id bigint,result jsonb)
language sql stable security invoker set search_path=pg_catalog,public as $$
 select s.job_id, jsonb_build_object('kind',s.result->>'kind','lat',s.result->'lat','lng',s.result->'lng','source',s.result->>'source','checkedAt',s.result->>'checkedAt')
 from public.map_r1_location_jobs s join public.local_jobs j on j.id=s.job_id
 where s.job_id=any(p_ids) and cardinality(p_ids)<=100 and j.active and not j.admin_hidden
 and s.result->>'kind' in ('gate','area') and s.state in ('done','failed','deferred') and s.snapshot=public.map_r1_snapshot(s.job_id)
 and not public.map_r1_has_exact(s.job_id)
$$;
revoke all on function public.map_r1_snapshot(bigint),public.map_r1_has_exact(bigint),public.map_r1_claim_batch(integer,uuid),public.map_r1_reserve_call(bigint,uuid),public.map_r1_complete(bigint,uuid,jsonb),public.map_r1_public_points(bigint[]) from public,anon,authenticated;
grant execute on function public.map_r1_snapshot(bigint),public.map_r1_has_exact(bigint),public.map_r1_claim_batch(integer,uuid),public.map_r1_reserve_call(bigint,uuid),public.map_r1_complete(bigint,uuid,jsonb),public.map_r1_public_points(bigint[]) to service_role;
commit;
