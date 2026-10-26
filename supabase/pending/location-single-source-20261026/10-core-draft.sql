-- STRICT REVIEW DRAFT. NOT a production migration or an apply command.
-- This core contract is tested only in a disposable PostgreSQL database.
-- Compatibility adapters + reader cutover listed in the plan must precede activation.
-- The explicit database-name guard prevents accidental production execution.
do $$begin
 if current_database()<>'location_single_source_dryrun' then
   raise exception 'REVIEW ONLY: production application requires Lee approval and the complete cutover migration';
 end if;
end$$;
create schema location_private;
revoke all on schema location_private from public,anon,authenticated,service_role;
create function location_private.company_identity(p_text text) returns text language sql immutable
set search_path=pg_catalog as $$select lower(regexp_replace(btrim(normalize(coalesce(p_text,''),NFC)),'[[:space:]]+',' ','g'))$$;
revoke all on function location_private.company_identity(text) from public,anon,authenticated,service_role;
create role location_writer nologin noinherit nosuperuser nocreatedb nocreaterole noreplication nobypassrls;
grant usage on schema public,location_private to location_writer;
grant select on public.local_jobs,public.job_work_locations,public.job_location_candidates,public.admin_confirmed_location_memory to location_writer;
grant insert,update,delete on public.job_work_locations to location_writer;
grant select,insert,update on public.map_r1_location_jobs to location_writer;
grant usage,select on sequence public.job_work_locations_id_seq to location_writer;
grant execute on function public.admin_location_key(text) to location_writer;
grant execute on function location_private.company_identity(text) to location_writer;
create policy location_writer_only on public.job_work_locations for all to location_writer using(true) with check(true);
-- In production, explicit SELECT policies for local_jobs/candidates/memory are also required.
-- They grant only the internal NOLOGIN role, never anon/authenticated/service_role.
alter table public.job_work_locations
 add column point_kind text not null default 'unresolved' check(point_kind in ('exact','gate','area','unresolved')),
 add column point_precision text,
 add column point_authority text not null default 'unresolved',
 add column point_company_key text,
 add column point_candidate_id bigint,
 add column point_memory_id bigint,
 add column point_evidence jsonb not null default '{}',
 add column point_revision bigint not null default 0;
alter table public.map_r1_location_jobs add column source_points jsonb not null default '[]',add column provider_result jsonb;
create table location_private.write_log (
 id bigint generated always as identity primary key,job_id bigint not null,work_location_id bigint,
 authority text not null,previous_point jsonb,next_point jsonb,created_at timestamptz not null default now()
);
alter table location_private.write_log enable row level security;
create policy writer_audit on location_private.write_log for all to location_writer using(true) with check(true);
grant insert,select on location_private.write_log to location_writer;
grant usage,select on sequence location_private.write_log_id_seq to location_writer;

-- No caller-controlled GUC bypass. The actual database execution role must be the
-- NOLOGIN role owned by the single private writer. Owners/superusers can change DDL;
-- no application-level policy can prevent a trusted DDL owner from disabling it.
create function location_private.guard_source_write() returns trigger language plpgsql
set search_path=pg_catalog as $$begin
 if current_user<>'location_writer' then
   if tg_op='DELETE' and not exists(select 1 from public.local_jobs where id=old.job_id) then return old; end if;
   raise exception 'location source: use the canonical writer' using errcode='42501';
 end if;
 return case when tg_op='DELETE' then old else new end;
end$$;
revoke all on function location_private.guard_source_write() from public,anon,authenticated,service_role;
create trigger trg_00_location_single_writer before insert or update or delete on public.job_work_locations
for each row execute function location_private.guard_source_write();
revoke insert,update,delete on public.job_work_locations from public,anon,authenticated,service_role;

-- The only routine allowed to INSERT/UPDATE coordinates in the source table.
-- Public RPC adapters authorize their caller first, then invoke this private routine.
create function location_private.write_location(
 p_job_id bigint,p_address text,p_lat float8,p_lng float8,p_authority text,p_evidence jsonb
) returns bigint language plpgsql security definer set search_path=pg_catalog as $$
declare j public.local_jobs; w public.job_work_locations; c public.job_location_candidates;
 m public.admin_confirmed_location_memory; addr text; k text; prec text; verified boolean;
 cid bigint; mid bigint; point_source text; proof jsonb:=coalesce(p_evidence,'{}');
begin
 select * into j from public.local_jobs where id=p_job_id;
 if j.id is null then raise exception 'job not found'; end if;
 -- Serialize every location mutation for one job. Approval/auto adapters must lock
 -- in the same order: job row, then work row, then queue row (never table-wide).
 perform pg_advisory_xact_lock(p_job_id);
 addr:=nullif(btrim(p_address),'');
 if addr is null then raise exception 'address required'; end if;
 if p_authority not in ('admin_confirmed','auto_reuse','source_verified','poster_pin','auto_gate','auto_area','unresolved') then
   raise exception 'unknown authority';
 end if;
 select * into w from public.job_work_locations
 where job_id=p_job_id and public.admin_location_key(raw_address)=public.admin_location_key(addr)
 order by sort_order,id limit 1 for update;
 if p_authority in ('admin_confirmed','auto_reuse') then
   cid:=(proof->>'candidate_id')::bigint;
   if p_authority='auto_reuse' then
     mid:=(proof->>'memory_id')::bigint;
     select * into m from public.admin_confirmed_location_memory where source_candidate_id=mid and active;
     if m.source_candidate_id is null or m.company_key<>public.admin_location_key(j.company)
       or m.address_key<>public.admin_location_key(addr) then raise exception 'invalid memory target'; end if;
     cid:=m.source_candidate_id;
   end if;
   select * into c from public.job_location_candidates where id=cid and status='approved';
   if c.id is null or c.reviewed_by is null or c.reviewed_at is null or c.place_precision not in ('entrance','building','site')
     or location_private.company_identity(c.company_snapshot)<>location_private.company_identity(j.company)
     or public.admin_location_key(c.address_snapshot)<>public.admin_location_key(addr)
     or (p_authority='admin_confirmed' and c.job_id<>p_job_id) then raise exception 'approval not valid for company/address'; end if;
   if not exists(select 1 from public.local_jobs origin_job where origin_job.id=c.job_id
    and location_private.company_identity(origin_job.company)=location_private.company_identity(c.company_snapshot)
    and (public.admin_location_key(origin_job.location)=public.admin_location_key(c.address_snapshot) or exists(
      select 1 from public.job_work_locations origin_work where origin_work.job_id=origin_job.id
      and public.admin_location_key(origin_work.raw_address)=public.admin_location_key(c.address_snapshot)))) then raise exception 'approval source is no longer current'; end if;
   if mid is not null and (m.approved_by is distinct from c.reviewed_by or m.approved_at is distinct from c.reviewed_at or m.lat is distinct from c.lat or m.lng is distinct from c.lng
      or m.place_precision is distinct from c.place_precision) then raise exception 'memory differs from approval'; end if;
   p_lat:=c.lat; p_lng:=c.lng; prec:=c.place_precision; verified:=true; k:='exact';
   point_source:='admin_approved';
   proof:=jsonb_build_object('candidate_id',cid,'memory_id',mid,'source','admin_approved','checkedAt',c.reviewed_at);
 elsif p_authority='unresolved' then
   p_lat:=null;p_lng:=null;verified:=false;k:='unresolved';point_source:=null;
 else
   if nullif(proof->>'source','') is null or nullif(proof->>'checkedAt','') is null then raise exception 'provenance required'; end if;
   verified:=p_authority in ('source_verified','poster_pin');
   k:=case when verified then 'exact' when p_authority='auto_gate' then 'gate' else 'area' end;
   prec:=case when p_authority='auto_gate' then 'entrance' when verified then 'site' else 'area' end;
   point_source:=proof->>'source';
 end if;
 if k<>'unresolved' and (p_lat is null or p_lng is null or not(p_lat between 8 and 24 and p_lng between 102 and 110)) then
   raise exception 'invalid VN point';
 end if;
 if w.id is not null and w.point_authority in ('admin_confirmed','auto_reuse') and p_authority='poster_pin' then return w.id; end if;
 if w.id is not null and w.location_verified and p_authority in ('auto_gate','auto_area','source_verified','unresolved')
    and coalesce(proof->>'operation','') not in ('revoke','invalidate') then return w.id; end if;
 -- Do not overwrite a newer human decision with an older/replayed approval.
 if w.id is not null and w.point_candidate_id is not null and cid is not null
    and (w.point_evidence->>'checkedAt')::timestamptz > c.reviewed_at then return w.id; end if;
 if w.id is not null and w.lat is not distinct from p_lat and w.lng is not distinct from p_lng
   and w.location_verified=verified and w.point_kind=k and w.point_authority=p_authority
   and w.point_candidate_id is not distinct from cid and w.point_memory_id is not distinct from mid
   and w.point_evidence=proof then return w.id; end if;
 if w.id is null then
   insert into public.job_work_locations(job_id,raw_address,normalized_address,lat,lng,location_verified,
    geocode_status,geocode_source,verification_method,coordinate_accuracy,point_kind,point_precision,
    point_authority,point_company_key,point_candidate_id,point_memory_id,point_evidence,point_revision)
   values(p_job_id,addr,public.admin_location_key(addr),p_lat,p_lng,verified,
    case when k='unresolved' then 'pending' when verified then 'manual' else 'success' end,point_source,
    case when p_authority in ('admin_confirmed','auto_reuse') then 'admin_approved' when p_authority='poster_pin' then 'poster_pin' when verified then 'source_coordinate' else null end,
    case when verified then 'exact' when k='unresolved' then 'unresolved' else 'region' end,k,prec,
    p_authority,location_private.company_identity(j.company),cid,mid,proof,1) returning id into w.id;
   insert into location_private.write_log(job_id,work_location_id,authority,previous_point,next_point)
    values(p_job_id,w.id,p_authority,null,jsonb_build_object('lat',p_lat,'lng',p_lng,'kind',k));
 else
   insert into location_private.write_log(job_id,work_location_id,authority,previous_point,next_point)
    values(p_job_id,w.id,p_authority,jsonb_build_object('lat',w.lat,'lng',w.lng,'kind',w.point_kind),jsonb_build_object('lat',p_lat,'lng',p_lng,'kind',k));
   update public.job_work_locations set lat=p_lat,lng=p_lng,location_verified=verified,
    geocode_status=case when k='unresolved' then 'pending' when verified then 'manual' else 'success' end,
    geocode_source=point_source,
    verification_method=case when p_authority in ('admin_confirmed','auto_reuse') then 'admin_approved' when p_authority='poster_pin' then 'poster_pin' when verified then 'source_coordinate' else null end,
    coordinate_accuracy=case when verified then 'exact' when k='unresolved' then 'unresolved' else 'region' end,
    point_kind=k,point_precision=prec,point_authority=p_authority,point_company_key=location_private.company_identity(j.company),
    point_candidate_id=cid,point_memory_id=mid,point_evidence=proof,point_revision=point_revision+1,updated_at=now()
   where id=w.id;
 end if;
 return w.id;
end$$;
alter function location_private.write_location(bigint,text,float8,float8,text,jsonb) owner to location_writer;
revoke all on function location_private.write_location(bigint,text,float8,float8,text,jsonb) from public,anon,authenticated,service_role;
grant execute on function location_private.write_location(bigint,text,float8,float8,text,jsonb) to postgres;

-- Full ordered point sets, rather than a job-level scalar, preserve multi-site jobs.
create function location_private.expected_points(p_job_id bigint) returns jsonb language sql stable
set search_path=pg_catalog as $$
 select coalesce(jsonb_agg(jsonb_build_object('workLocationId',w.id,'address',w.raw_address,
  'lat',w.lat,'lng',w.lng,'kind',w.point_kind,'precision',w.point_precision,
  'source',w.geocode_source,'checkedAt',w.point_evidence->>'checkedAt','revision',w.point_revision)
 order by w.sort_order,w.id),'[]'::jsonb)
 from public.job_work_locations w where w.job_id=p_job_id and w.point_kind<>'unresolved'
 and w.lat between 8 and 24 and w.lng between 102 and 110
$$;
revoke all on function location_private.expected_points(bigint) from public,anon,authenticated,service_role;
grant execute on function location_private.expected_points(bigint) to location_writer;
create function location_private.derive_cache() returns trigger language plpgsql security definer
set search_path=pg_catalog as $$begin
 new.source_points:=location_private.expected_points(new.job_id);
 new.result:=case when jsonb_array_length(new.source_points)>0 then new.source_points->0 else null end;
 return new;
end$$;
alter function location_private.derive_cache() owner to location_writer;
revoke all on function location_private.derive_cache() from public,anon,authenticated,service_role;
create trigger trg_location_derived_cache before insert or update on public.map_r1_location_jobs
for each row execute function location_private.derive_cache();
create function location_private.refresh_cache() returns trigger language plpgsql security definer
set search_path=pg_catalog as $$declare jid bigint;begin
 jid:=case when tg_op='DELETE' then old.job_id else new.job_id end;
 if exists(select 1 from public.local_jobs where id=jid) then
  insert into public.map_r1_location_jobs(job_id,source_points,result)
   values(jid,location_private.expected_points(jid),null)
   on conflict(job_id) do update set source_points=excluded.source_points,updated_at=now();
 end if;
 return null;
end$$;
alter function location_private.refresh_cache() owner to location_writer;
revoke all on function location_private.refresh_cache() from public,anon,authenticated,service_role;
create trigger trg_location_refresh_cache after insert or update or delete on public.job_work_locations
for each row execute function location_private.refresh_cache();

-- The memory is reusable approval evidence, never a screen's coordinate source.
-- One eligibility/target definition is shared by fanout and mismatch monitoring.
create view location_private.valid_memory_targets with(security_invoker=true) as
with targets as (
 select j.id job_id,j.company,w.raw_address address from public.local_jobs j
 join public.job_work_locations w on w.job_id=j.id
 union all
 select j.id,j.company,j.location from public.local_jobs j
 where nullif(btrim(j.location),'') is not null and not exists(
  select 1 from public.job_work_locations w where w.job_id=j.id
  and public.admin_location_key(w.raw_address)=public.admin_location_key(j.location))
), eligible as (
 select t.*,m.source_candidate_id,m.lat,m.lng,m.place_precision,m.approved_at,
  row_number() over(partition by t.job_id,public.admin_location_key(t.address)
   order by m.approved_at desc,m.source_candidate_id desc) preference
 from targets t join public.admin_confirmed_location_memory m on m.active
  and m.company_key=public.admin_location_key(t.company)
  and m.address_key=public.admin_location_key(t.address)
 join public.job_location_candidates c on c.id=m.source_candidate_id and c.status='approved'
 join public.local_jobs origin_job on origin_job.id=c.job_id
 where c.reviewed_by is not null and c.reviewed_at is not null
 and m.approved_by=c.reviewed_by and m.approved_at=c.reviewed_at and c.place_precision in ('entrance','building','site')
 and m.lat=c.lat and m.lng=c.lng and m.place_precision=c.place_precision
 and m.lat between 8 and 24 and m.lng between 102 and 110
 and location_private.company_identity(c.company_snapshot)=location_private.company_identity(t.company)
 and location_private.company_identity(origin_job.company)=location_private.company_identity(c.company_snapshot)
 and public.admin_location_key(c.address_snapshot)=m.address_key
 and (public.admin_location_key(origin_job.location)=m.address_key or exists(
  select 1 from public.job_work_locations origin_work where origin_work.job_id=origin_job.id
  and public.admin_location_key(origin_work.raw_address)=m.address_key))
)
select * from eligible where preference=1;
revoke all on location_private.valid_memory_targets from public,anon,authenticated,service_role;
create function location_private.reconcile_memory() returns integer language plpgsql security definer
set search_path=pg_catalog as $$declare t record; n int:=0;begin
 -- Revoke first, then reapply the current winner, always via the same writer.
 for t in select w.job_id,w.raw_address from public.job_work_locations w
  where w.point_memory_id is not null and not exists(
   select 1 from location_private.valid_memory_targets v where v.job_id=w.job_id
   and public.admin_location_key(v.address)=public.admin_location_key(w.raw_address)
   and v.source_candidate_id=w.point_memory_id)
  order by w.job_id,w.id
 loop
  perform location_private.write_location(t.job_id,t.raw_address,null,null,'unresolved','{"operation":"revoke"}');
 end loop;
 for t in select * from location_private.valid_memory_targets order by job_id,address loop
  perform location_private.write_location(t.job_id,t.address,t.lat,t.lng,'auto_reuse',
   jsonb_build_object('memory_id',t.source_candidate_id));n:=n+1;
 end loop;
 return n;
end$$;
revoke all on function location_private.reconcile_memory() from public,anon,authenticated,service_role;
create function location_private.memory_changed() returns trigger language plpgsql security definer
set search_path=pg_catalog as $$begin perform location_private.reconcile_memory();return null;end$$;
revoke all on function location_private.memory_changed() from public,anon,authenticated,service_role;
create trigger trg_location_memory_changed after insert or update or delete on public.admin_confirmed_location_memory
for each statement execute function location_private.memory_changed();

create function public.location_integrity_issues() returns table(issue text,job_id bigint,work_location_id bigint)
language sql stable security definer set search_path=pg_catalog as $$
 select 'confirmed_memory_differs_from_source'::text,v.job_id,w.id
 from location_private.valid_memory_targets v left join public.job_work_locations w
 on w.job_id=v.job_id and public.admin_location_key(w.raw_address)=public.admin_location_key(v.address)
 where w.id is null or w.lat is distinct from v.lat or w.lng is distinct from v.lng or not w.location_verified
 union all
 select 'stale_confirmation_on_source',w.job_id,w.id from public.job_work_locations w
 join public.local_jobs j on j.id=w.job_id
 where w.point_authority in ('admin_confirmed','auto_reuse') and (
  w.point_company_key is distinct from location_private.company_identity(j.company)
  or not exists(select 1 from public.job_location_candidates c join public.local_jobs origin_job on origin_job.id=c.job_id
   where c.id=w.point_candidate_id and c.status='approved' and c.reviewed_by is not null
   and c.place_precision in ('entrance','building','site') and c.lat=w.lat and c.lng=w.lng
   and location_private.company_identity(c.company_snapshot)=location_private.company_identity(j.company)
   and location_private.company_identity(origin_job.company)=location_private.company_identity(c.company_snapshot)
   and public.admin_location_key(c.address_snapshot)=public.admin_location_key(w.raw_address)
   and (public.admin_location_key(origin_job.location)=public.admin_location_key(c.address_snapshot) or exists(
    select 1 from public.job_work_locations origin_work where origin_work.job_id=origin_job.id
    and public.admin_location_key(origin_work.raw_address)=public.admin_location_key(c.address_snapshot))))
  or (w.point_authority='auto_reuse' and not exists(
   select 1 from location_private.valid_memory_targets v where v.job_id=w.job_id
   and public.admin_location_key(v.address)=public.admin_location_key(w.raw_address)
   and v.source_candidate_id=w.point_memory_id)))
 union all
 select 'map_cache_differs_from_source',j.id,null::bigint from public.local_jobs j
 left join public.map_r1_location_jobs s on s.job_id=j.id
 where j.active and not j.admin_hidden and
  (coalesce(s.source_points,'[]') is distinct from location_private.expected_points(j.id)
   or s.result is distinct from location_private.expected_points(j.id)->0)
$$;
revoke all on function public.location_integrity_issues() from public,anon,authenticated;
grant execute on function public.location_integrity_issues() to service_role;
