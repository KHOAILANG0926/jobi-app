-- APPROVED DESIGN IMPLEMENTATION. Root operator only, after preview review.
-- All schema, adapters, data conversion and assertions commit together.
begin;
set local lock_timeout='15s';
set local statement_timeout='120s';
select pg_advisory_xact_lock(20261026,26);
-- Lock before evaluating evidence and retaining the baseline.
lock table public.local_jobs,public.job_location_candidates,public.admin_confirmed_location_memory,public.job_work_locations,public.map_r1_location_jobs in share row exclusive mode;
do $$begin
 if exists(select 1 from pg_namespace where nspname='location_private') then
  raise exception 'Canonical location schema already exists; do not replay';
 end if;
 if exists(select 1 from pg_roles where rolname='location_writer') then raise exception 'Unexpected existing writer role'; end if;
 if exists(select 1 from public.job_work_locations where (lat is null)<>(lng is null)
  or (lat is not null and not(lat between 8 and 24 and lng between 102 and 110))) then
  raise exception 'Invalid legacy source coordinate; preview and resolve before applying';
 end if;
 if exists(select 1 from public.job_work_locations where lat is not null and nullif(btrim(geocode_source),'') is null) then
  raise exception 'Missing legacy source evidence; refusing to invent provenance';
 end if;
 if exists(select 1 from public.job_location_candidates a join public.job_location_candidates b on a.id<b.id
  and lower(normalize(a.company_snapshot,NFC))=lower(normalize(b.company_snapshot,NFC))
  and public.admin_location_key(a.address_snapshot)=public.admin_location_key(b.address_snapshot)
  and a.reviewed_at=b.reviewed_at and row(a.lat,a.lng,a.place_precision) is distinct from row(b.lat,b.lng,b.place_precision)
  where a.status='approved' and b.status='approved' and a.reviewed_by is not null and b.reviewed_by is not null
  and a.evidence not like 'AUTO REUSE:%' and b.evidence not like 'AUTO REUSE:%') then
  raise exception 'Conflicting simultaneous human evidence; rollback and review';
 end if;
end$$;
create schema location_private;
revoke all on schema location_private from public,anon,authenticated,service_role;
create role location_writer nologin noinherit nosuperuser nocreatedb nocreaterole noreplication nobypassrls;
-- Supabase postgres has CREATEROLE, not superuser: temporary ownership-transfer
-- membership exists only within this transaction and is revoked before commit.
do $$begin execute format('grant location_writer to %I with inherit false, set true',current_user);end$$;
create function location_private.company_identity(p_text text) returns text language sql immutable
set search_path=pg_catalog as $$select lower(regexp_replace(btrim(normalize(coalesce(p_text,''),NFC)),'[[:space:]]+',' ','g'))$$;
create function location_private.safe_source(p_source text) returns text language sql immutable
set search_path=pg_catalog as $$select case
 when p_source ilike '%vietmap%' then 'VietMap'
 when p_source ilike '%openstreetmap%' or p_source ilike '%osm%' then 'OpenStreetMap'
 when p_source='admin_approved' then 'admin_approved'
 when p_source='poster_pin' then 'poster_pin'
 else 'source_evidence' end$$;
create function location_private.provider_target(p_snapshot jsonb,p_result jsonb) returns text
language plpgsql immutable set search_path=pg_catalog as $$declare addr text;n int;begin
 addr:=nullif(btrim(p_result->>'address'),'');
 if addr is not null then return addr;end if;
 n:=jsonb_array_length(coalesce(p_snapshot->'targets','[]'));
 if n=1 then return nullif(btrim(p_snapshot->'targets'->0->>'address'),'');
 elsif n=0 then return nullif(btrim(p_snapshot->>'location'),'');
 else raise exception 'ambiguous provider target; explicit address required';end if;
end$$;

create table location_private.retained_rows(
 id bigint generated always as identity primary key,relation_name text not null,
 job_id bigint not null,row_data jsonb not null,reason text not null,retained_at timestamptz not null default now());
alter table location_private.retained_rows enable row level security;
insert into location_private.retained_rows(relation_name,job_id,row_data,reason)
 select 'local_jobs',id,jsonb_build_object('active',active,'admin_hidden',admin_hidden),'pre_cutover' from public.local_jobs;
insert into location_private.retained_rows(relation_name,job_id,row_data,reason)
 select 'job_work_locations',job_id,to_jsonb(w),'pre_cutover' from public.job_work_locations w;
insert into location_private.retained_rows(relation_name,job_id,row_data,reason)
 select 'map_r1_location_jobs',job_id,to_jsonb(s),'pre_cutover' from public.map_r1_location_jobs s;
create table location_private.write_log(
 id bigint generated always as identity primary key,job_id bigint not null,work_location_id bigint,
 operation text not null,previous_row jsonb,next_row jsonb,request_payload jsonb,created_at timestamptz not null default now());
alter table location_private.write_log enable row level security;
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
update public.map_r1_location_jobs set provider_result=result;
create index location_job_company_identity on public.local_jobs(location_private.company_identity(company));
create index location_candidate_company_identity on public.job_location_candidates(location_private.company_identity(company_snapshot),reviewed_at desc,id desc);
create index location_work_confirmation on public.job_work_locations(point_candidate_id) where point_candidate_id is not null;
create index location_work_company on public.job_work_locations(point_company_key,job_id);
-- Keep public visibility tied to the parent. No change to hidden jobs or publication flags.
drop policy if exists job_work_locations_public_select on public.job_work_locations;
create policy job_work_locations_public_select on public.job_work_locations for select to anon,authenticated
 using(exists(select 1 from public.local_jobs j where j.id=job_id and j.active and not j.admin_hidden));
grant usage on schema public,location_private to location_writer;
grant create on schema location_private to location_writer;
grant select on public.local_jobs,public.job_work_locations,public.job_location_candidates,public.admin_confirmed_location_memory to location_writer;
grant insert,update,delete on public.job_work_locations to location_writer;
grant select,insert,update on public.map_r1_location_jobs to location_writer;
grant insert on location_private.write_log,location_private.retained_rows to location_writer;
grant usage,select on sequence public.job_work_locations_id_seq,location_private.write_log_id_seq,location_private.retained_rows_id_seq to location_writer;
grant execute on function public.admin_location_key(text),location_private.company_identity(text),location_private.safe_source(text) to location_writer;
create policy canonical_writer on public.job_work_locations for all to location_writer using(true) with check(true);
create policy canonical_read_jobs on public.local_jobs for select to location_writer using(true);
create policy canonical_read_candidates on public.job_location_candidates for select to location_writer using(true);
create policy canonical_read_memory on public.admin_confirmed_location_memory for select to location_writer using(true);
create policy canonical_cache on public.map_r1_location_jobs for all to location_writer using(true) with check(true);
create policy canonical_audit on location_private.write_log for insert to location_writer with check(true);
create policy canonical_archive on location_private.retained_rows for insert to location_writer with check(true);
-- Disable legacy fanout triggers. Their definitions remain retained in migration history.
drop trigger if exists trg_admin_remember_confirmed_location on public.job_location_candidates;
drop trigger if exists trg_admin_forget_confirmed_location_update on public.job_location_candidates;
drop trigger if exists trg_admin_forget_confirmed_location_delete on public.job_location_candidates;
drop trigger if exists trg_admin_remembered_jobs on public.local_jobs;
drop trigger if exists trg_admin_remembered_work_locations on public.job_work_locations;
drop trigger if exists trg_map_r1_work_location_saved on public.job_work_locations;

create function location_private.guard_source_write() returns trigger language plpgsql set search_path=pg_catalog as $$begin
 if current_user<>'location_writer' then
  if tg_op='DELETE' and not exists(select 1 from public.local_jobs where id=old.job_id) then return old; end if;
  raise exception 'location source: use the canonical writer' using errcode='42501';
 end if;
 return case when tg_op='DELETE' then old else new end;
end$$;
create trigger trg_00_location_single_writer before insert or update or delete on public.job_work_locations
 for each row execute function location_private.guard_source_write();
revoke insert,update,delete,truncate on public.job_work_locations from public,anon,authenticated,service_role;
-- Table grants and column grants are distinct in PostgreSQL.
do $$declare r record;begin
 for r in select grantee,column_name,privilege_type from information_schema.column_privileges
 where table_schema='public' and table_name='job_work_locations' and grantee in ('anon','authenticated','service_role','PUBLIC')
 and privilege_type in ('INSERT','UPDATE','REFERENCES') loop
  execute format('revoke %s (%I) on public.job_work_locations from %I',r.privilege_type,r.column_name,r.grantee);
 end loop;
end$$;

create view location_private.valid_memory_targets with(security_invoker=true) as
with targets as (
 select j.id job_id,j.company,w.raw_address address,w.id work_location_id from public.local_jobs j
 join public.job_work_locations w on w.job_id=j.id
 union all select j.id,j.company,j.location,null::bigint from public.local_jobs j
 where nullif(btrim(j.location),'') is not null and not exists(select 1 from public.job_work_locations w where w.job_id=j.id)
), eligible as (
 select t.*,c.id source_candidate_id,c.lat,c.lng,c.place_precision,c.reviewed_at approved_at,c.reviewed_by approved_by,
 row_number() over(partition by t.job_id,public.admin_location_key(t.address) order by c.reviewed_at desc,c.id desc) preference
 from targets t join public.job_location_candidates c
 on location_private.company_identity(c.company_snapshot)=location_private.company_identity(t.company)
 and public.admin_location_key(c.address_snapshot)=public.admin_location_key(t.address)
 join public.admin_confirmed_location_memory m on m.source_candidate_id=c.id and m.active
 join public.local_jobs origin_job on origin_job.id=c.job_id
 where c.status='approved' and c.reviewed_by is not null and c.reviewed_at is not null
 and c.evidence not like 'AUTO REUSE:%'
 and c.place_precision in ('entrance','building','site') and nullif(btrim(c.evidence),'') is not null
 and c.lat between 8 and 24 and c.lng between 102 and 110
 and m.approved_by=c.reviewed_by and m.approved_at=c.reviewed_at and m.lat=c.lat and m.lng=c.lng and m.place_precision=c.place_precision
 and m.address_key=public.admin_location_key(c.address_snapshot)
 and location_private.company_identity(origin_job.company)=location_private.company_identity(c.company_snapshot)
 and (public.admin_location_key(origin_job.location)=public.admin_location_key(c.address_snapshot)
 or exists(select 1 from public.job_work_locations ow where ow.job_id=origin_job.id
 and public.admin_location_key(ow.raw_address)=public.admin_location_key(c.address_snapshot)))
)
select * from eligible where preference=1;
grant select on location_private.valid_memory_targets to location_writer;

-- Single source mutator: points, metadata, retained deletions and batch replacement.
-- Only authorization adapters (postgres-owned) may execute this private routine.
create function location_private.write_location(p_job_id bigint,p_operation text,p_payload jsonb)
returns bigint language plpgsql security definer set search_path=pg_catalog,public as $$
declare j public.local_jobs; w public.job_work_locations; c public.job_location_candidates;
 r jsonb; proof jsonb; oldrow jsonb; addr text; authority text; kind text; precisionv text;
 latv float8; lngv float8; verified boolean; cid bigint; mid bigint; wid bigint; ids bigint[]:='{}';
 winner record; checked timestamptz;
begin
 -- No application-controlled GUC grants permission; execution role is fixed.
 perform pg_advisory_xact_lock(20261026,27);
 select * into j from public.local_jobs where id=p_job_id;
 if j.id is null then return null; end if;
 -- Adapters lock the job first. The internal role has SELECT, not broad UPDATE
 -- on local_jobs; its advisory lock is shared by every recursive writer call.
 perform pg_advisory_xact_lock(p_job_id);
 if p_operation='replace' then
  if jsonb_typeof(p_payload)<>'array' then raise exception 'rows must be array'; end if;
  if exists(select 1 from jsonb_array_elements(p_payload) x group by public.admin_location_key(x->>'raw_address') having count(*)>1) then
   raise exception 'duplicate replacement address'; end if;
  for r in select value from jsonb_array_elements(p_payload) loop
   wid:=location_private.write_location(p_job_id,'upsert',r||jsonb_build_object('authority',
    case when coalesce((r->>'location_verified')::boolean,false) then 'source_verified'
     when r->>'lat' is not null then 'auto_area' else 'unresolved' end,
    'evidence',coalesce(r->'point_evidence',jsonb_build_object('source',r->>'geocode_source','checkedAt',now(),'evidence',r->>'address_evidence'))));
   ids:=array_append(ids,wid);
  end loop;
  for w in select * from public.job_work_locations where job_id=p_job_id and not(id=any(ids)) order by id for update loop
   perform location_private.write_location(p_job_id,'delete',jsonb_build_object('work_location_id',w.id));
  end loop;
  return coalesce(ids[1],0);
 elsif p_operation='delete' then
  select * into w from public.job_work_locations where job_id=p_job_id and id=(p_payload->>'work_location_id')::bigint for update;
  if not found then return null; end if;
  insert into location_private.retained_rows(relation_name,job_id,row_data,reason) values('job_work_locations',p_job_id,to_jsonb(w),'writer_delete');
  insert into location_private.write_log(job_id,work_location_id,operation,previous_row) values(p_job_id,w.id,'delete',to_jsonb(w));
  delete from public.job_work_locations where id=w.id;
  return w.id;
 elsif p_operation not in ('upsert','invalidate','import') then raise exception 'invalid operation'; end if;
 addr:=nullif(btrim(coalesce(p_payload->>'raw_address',p_payload->>'address')),'');
 if addr is null then raise exception 'address required'; end if;
 select * into w from public.job_work_locations where job_id=p_job_id
 and public.admin_location_key(raw_address)=public.admin_location_key(addr) order by sort_order,id limit 1 for update;
 if p_payload ? 'work_location_id' and w.id is distinct from (p_payload->>'work_location_id')::bigint then raise exception 'stale target'; end if;
 oldrow:=case when w.id is null then null else to_jsonb(w) end;
 if p_payload ? 'new_address' then
  addr:=nullif(btrim(p_payload->>'new_address'),'');
  if addr is null then raise exception 'new address required';end if;
 end if;
 authority:=coalesce(p_payload->>'authority','unresolved');
 proof:=coalesce(p_payload->'evidence','{}');
 cid:=(p_payload->>'candidate_id')::bigint;mid:=(p_payload->>'memory_id')::bigint;
 if authority in ('admin_confirmed','auto_reuse') then
  select * into winner from location_private.valid_memory_targets t where t.job_id=p_job_id
   and public.admin_location_key(t.address)=public.admin_location_key(addr);
  if winner.source_candidate_id is null or winner.source_candidate_id is distinct from coalesce(cid,mid) then raise exception 'invalid or superseded approval'; end if;
  select * into c from public.job_location_candidates where id=winner.source_candidate_id;
  if authority='admin_confirmed' and c.job_id<>p_job_id then raise exception 'approval belongs to another job'; end if;
  cid:=c.id;mid:=case when authority='auto_reuse' then c.id else null end;
  latv:=c.lat;lngv:=c.lng;kind:='exact';precisionv:=c.place_precision;verified:=true;
  proof:=jsonb_build_object('source','admin_approved','checkedAt',c.reviewed_at,'candidateId',c.id,'memoryId',mid);
 elsif authority='unresolved' or p_operation='invalidate' then
  latv:=null;lngv:=null;kind:='unresolved';precisionv:=null;verified:=false;authority:='unresolved';proof:='{}';cid:=null;mid:=null;
 elsif authority in ('source_verified','poster_pin','auto_gate','auto_area','legacy_verified','legacy_area') then
  latv:=(p_payload->>'lat')::float8;lngv:=(p_payload->>'lng')::float8;
  if nullif(btrim(proof->>'source'),'') is null or nullif(btrim(proof->>'checkedAt'),'') is null then raise exception 'missing provenance'; end if;
  checked:=(proof->>'checkedAt')::timestamptz;
  if checked>now()+interval '5 minutes' then raise exception 'future evidence'; end if;
  if authority='source_verified' and nullif(btrim(proof->>'evidence'),'') is null then raise exception 'verified evidence required'; end if;
  verified:=authority in ('source_verified','poster_pin','legacy_verified');
  kind:=case when verified then 'exact' when authority='auto_gate' then 'gate' else 'area' end;
  precisionv:=case when verified then coalesce(p_payload->>'precision','site') when kind='gate' then 'entrance' else 'area' end;
 else raise exception 'unknown authority';end if;
 if kind<>'unresolved' then
  proof:=jsonb_strip_nulls(jsonb_build_object('source',location_private.safe_source(proof->>'source'),'checkedAt',proof->'checkedAt',
   'candidateId',proof->'candidateId','memoryId',proof->'memoryId','importedLegacy',proof->'importedLegacy','timestampMeaning',proof->'timestampMeaning'));
 end if;
 if kind<>'unresolved' and (latv is null or lngv is null or not(latv between 8 and 24 and lngv between 102 and 110)) then raise exception 'invalid VN coordinates'; end if;
 -- Revalidate a stored human decision before protecting it from automatic writes.
 if w.point_authority in ('admin_confirmed','auto_reuse') and p_operation not in ('invalidate','import')
 and authority not in ('admin_confirmed','auto_reuse') then
  if exists(select 1 from location_private.valid_memory_targets t where t.job_id=p_job_id
   and public.admin_location_key(t.address)=public.admin_location_key(addr) and t.source_candidate_id=w.point_candidate_id) then
   latv:=w.lat;lngv:=w.lng;kind:=w.point_kind;precisionv:=w.point_precision;verified:=w.location_verified;
   authority:=w.point_authority;proof:=w.point_evidence;cid:=w.point_candidate_id;mid:=w.point_memory_id;
  end if;
 elsif w.location_verified and authority in ('auto_gate','auto_area','source_verified','unresolved') and p_operation not in ('invalidate','import') then
  latv:=w.lat;lngv:=w.lng;kind:=w.point_kind;precisionv:=w.point_precision;verified:=w.location_verified;
  authority:=w.point_authority;proof:=w.point_evidence;cid:=w.point_candidate_id;mid:=w.point_memory_id;
 end if;
 if w.id is null then
  insert into public.job_work_locations(job_id,raw_address,normalized_address,sort_order)
   values(p_job_id,addr,public.admin_location_key(addr),coalesce((p_payload->>'sort_order')::int,0)) returning * into w;
 end if;
 -- Metadata comes from a fixed whitelist. Coordinates and authority cannot be
 -- smuggled through arbitrary jsonb_populate_record fields.
 update public.job_work_locations set
  raw_address=addr,
  normalized_address=public.admin_location_key(addr),
  country=case when p_payload?'country' then coalesce(p_payload->>'country','VN') else country end,
  province=case when p_payload?'province' then p_payload->>'province' else province end,
  district=case when p_payload?'district' then p_payload->>'district' else district end,
  ward=case when p_payload?'ward' then p_payload->>'ward' else ward end,
  industrial_park=case when p_payload?'industrial_park' then p_payload->>'industrial_park' else industrial_park end,
  shuttle_route=case when p_payload?'shuttle_route' then p_payload->>'shuttle_route' else shuttle_route end,
  address_accuracy=case when p_payload?'address_accuracy' then p_payload->>'address_accuracy' else address_accuracy end,
  address_evidence=case when p_payload?'address_evidence' then p_payload->>'address_evidence' else address_evidence end,
  resolved_province=case when p_payload?'resolved_province' then p_payload->>'resolved_province' else resolved_province end,
  resolved_wards=case when p_payload?'resolved_wards' then array(select jsonb_array_elements_text(p_payload->'resolved_wards')) else resolved_wards end,
  matched_recruitment_regions=case when p_payload?'matched_recruitment_regions' then array(select jsonb_array_elements_text(p_payload->'matched_recruitment_regions')) else matched_recruitment_regions end,
  sort_order=coalesce((p_payload->>'sort_order')::int,sort_order),
  lat=latv,lng=lngv,location_verified=verified,point_kind=kind,point_precision=precisionv,point_authority=authority,
  point_company_key=location_private.company_identity(j.company),point_candidate_id=cid,point_memory_id=mid,point_evidence=proof,
  point_revision=point_revision+case when oldrow is null or row(lat,lng,point_kind,point_precision,point_authority,point_candidate_id,point_memory_id,point_evidence,point_company_key,raw_address,sort_order)
   is distinct from row(latv,lngv,kind,precisionv,authority,cid,mid,proof,location_private.company_identity(j.company),addr,coalesce((p_payload->>'sort_order')::int,sort_order)) then 1 else 0 end,
  geocode_source=case when kind='unresolved' then null else location_private.safe_source(proof->>'source') end,
  geocode_status=case when kind='unresolved' then 'pending' when verified then 'manual' else 'success' end,
  coordinate_accuracy=case when verified then 'exact' when kind='unresolved' then 'unresolved' else 'region' end,
  verification_method=case when authority in ('admin_confirmed','auto_reuse') then 'admin_approved' when authority='poster_pin' then 'poster_pin' when verified then 'source_coordinate' else null end
 where id=w.id returning * into w;
 if oldrow is distinct from to_jsonb(w)-'updated_at' then
  insert into location_private.write_log(job_id,work_location_id,operation,previous_row,next_row,request_payload)
   values(p_job_id,w.id,p_operation,oldrow,to_jsonb(w),p_payload);
 end if;
 return w.id;
end$$;
alter function location_private.write_location(bigint,text,jsonb) owner to location_writer;
do $$declare migration_role text:=current_user;begin
 execute 'set local role location_writer';
 execute 'revoke all on function location_private.write_location(bigint,text,jsonb) from public,anon,authenticated,service_role';
 execute format('grant execute on function location_private.write_location(bigint,text,jsonb) to %I',migration_role);
 execute format('set local role %I',migration_role);
end$$;

create function location_private.expected_points(p_job_id bigint) returns jsonb language sql stable set search_path=pg_catalog as $$
 select coalesce(jsonb_agg(jsonb_build_object('workLocationId',w.id,'address',w.raw_address,'lat',w.lat,'lng',w.lng,
 'kind',w.point_kind,'precision',w.point_precision,'source',location_private.safe_source(w.point_evidence->>'source'),
 'checkedAt',w.point_evidence->>'checkedAt','revision',w.point_revision) order by w.sort_order,w.id),'[]'::jsonb)
 from public.job_work_locations w where w.job_id=p_job_id and w.point_kind<>'unresolved'
 and w.lat between 8 and 24 and w.lng between 102 and 110
$$;
grant execute on function location_private.expected_points(bigint),public.map_r1_snapshot(bigint) to location_writer;
create function location_private.derive_cache() returns trigger language plpgsql security definer set search_path=pg_catalog as $$begin
 new.source_points:=location_private.expected_points(new.job_id);
 new.result:=new.source_points->0;
 return new;
end$$;
alter function location_private.derive_cache() owner to location_writer;
create trigger trg_location_derived_cache before insert or update on public.map_r1_location_jobs
 for each row execute function location_private.derive_cache();
create function location_private.refresh_cache() returns trigger language plpgsql security definer set search_path=pg_catalog as $$declare jid bigint;begin
 jid:=case when tg_op='DELETE' then old.job_id else new.job_id end;
 -- Preserve every queue scheduling field. A source update never claims/retries a job.
 if exists(select 1 from public.local_jobs where id=jid) then
  insert into public.map_r1_location_jobs(job_id,snapshot,search_key,state,source_points)
  values(jid,public.map_r1_snapshot(jid),md5(public.map_r1_snapshot(jid)::text),'deferred',location_private.expected_points(jid))
  on conflict(job_id) do update set source_points=excluded.source_points;
 end if;
 return null;
end$$;
alter function location_private.refresh_cache() owner to location_writer;
create trigger trg_location_refresh_cache after insert or update or delete on public.job_work_locations
 for each row execute function location_private.refresh_cache();

create function location_private.reconcile_company(p_company text) returns integer
language plpgsql security definer set search_path=pg_catalog as $$declare j record;w record;t record;n int:=0;begin
 -- Index bounds the fanout by strict company identity, including stale descendants.
 perform pg_advisory_xact_lock(20261026,27);
 for j in select distinct x.id from public.local_jobs x
 where location_private.company_identity(x.company)=p_company
 or exists(select 1 from public.job_work_locations sw where sw.job_id=x.id and sw.point_company_key=p_company)
 order by x.id loop
  perform 1 from public.local_jobs where id=j.id for update;
  for w in select * from public.job_work_locations where job_id=j.id and point_candidate_id is not null order by id loop
   if not exists(select 1 from location_private.valid_memory_targets v where v.job_id=j.id
    and public.admin_location_key(v.address)=public.admin_location_key(w.raw_address) and v.source_candidate_id=w.point_candidate_id) then
    perform location_private.write_location(j.id,'invalidate',jsonb_build_object('address',w.raw_address));
   end if;
  end loop;
  for t in select * from location_private.valid_memory_targets where job_id=j.id order by address loop
   perform location_private.write_location(j.id,'upsert',jsonb_build_object('address',t.address,'authority','auto_reuse','memory_id',t.source_candidate_id));n:=n+1;
  end loop;
 end loop;
 return n;
end$$;
create function location_private.candidate_changed() returns trigger language plpgsql security definer set search_path=pg_catalog as $$declare c public.job_location_candidates;keyv text;begin
 c:=case when tg_op='DELETE' then old else new end;
 keyv:=location_private.company_identity(c.company_snapshot);
 if tg_op<>'DELETE' and new.status='approved' and new.reviewed_by is not null and new.evidence not like 'AUTO REUSE:%' then
  insert into public.admin_confirmed_location_memory(source_candidate_id,address_key,company_key,lat,lng,place_precision,approved_by,approved_at,source_address,active)
  values(new.id,public.admin_location_key(new.address_snapshot),public.admin_location_key(new.company_snapshot),new.lat,new.lng,new.place_precision,new.reviewed_by,new.reviewed_at,new.address_snapshot,true)
  on conflict(source_candidate_id) do update set address_key=excluded.address_key,company_key=excluded.company_key,
   lat=excluded.lat,lng=excluded.lng,place_precision=excluded.place_precision,approved_by=excluded.approved_by,approved_at=excluded.approved_at,source_address=excluded.source_address,active=true;
 else
  update public.admin_confirmed_location_memory set active=false where source_candidate_id=c.id;
 end if;
 perform location_private.reconcile_company(keyv);
 if tg_op='UPDATE' and old.company_snapshot is distinct from new.company_snapshot then
  perform location_private.reconcile_company(location_private.company_identity(old.company_snapshot));
 end if;
 return null;
end$$;
create function location_private.memory_changed() returns trigger language plpgsql security definer set search_path=pg_catalog as $$declare keyv text;begin
 -- An approval trigger performs one reconciliation after its memory write.
 if pg_trigger_depth()>1 then return null;end if;
 select location_private.company_identity(company_snapshot) into keyv from public.job_location_candidates
 where id=case when tg_op='DELETE' then old.source_candidate_id else new.source_candidate_id end;
 if keyv is not null then perform location_private.reconcile_company(keyv);end if;
 return null;
end$$;
create trigger trg_canonical_candidate after insert or update or delete on public.job_location_candidates
 for each row execute function location_private.candidate_changed();
create function location_private.memory_identity_guard() returns trigger language plpgsql set search_path=pg_catalog as $$begin
 if new.source_candidate_id is distinct from old.source_candidate_id then raise exception 'memory source identity is immutable';end if;return new;
end$$;
create trigger trg_canonical_memory_identity before update on public.admin_confirmed_location_memory
 for each row execute function location_private.memory_identity_guard();
create trigger trg_canonical_memory after insert or update or delete on public.admin_confirmed_location_memory
 for each row execute function location_private.memory_changed();

create function location_private.job_identity_changed() returns trigger language plpgsql security definer set search_path=pg_catalog as $$declare w record;begin
 if tg_op='UPDATE' and new.company is not distinct from old.company and new.location is not distinct from old.location then return null;end if;
 if tg_op='UPDATE' then
  -- Parent text changes invalidate the corresponding source, through the writer.
  for w in select * from public.job_work_locations where job_id=new.id order by id loop
   if location_private.company_identity(new.company) is distinct from location_private.company_identity(old.company)
    or (public.admin_location_key(w.raw_address)=public.admin_location_key(old.location)
      and public.admin_location_key(new.location)<>public.admin_location_key(old.location)) then
    if public.admin_location_key(w.raw_address)=public.admin_location_key(old.location)
     and nullif(btrim(new.location),'') is null then
     perform location_private.write_location(new.id,'delete',jsonb_build_object('work_location_id',w.id));
    elsif public.admin_location_key(w.raw_address)=public.admin_location_key(old.location)
     and nullif(btrim(new.location),'') is not null then
     if exists(select 1 from public.job_work_locations other where other.job_id=new.id and other.id<>w.id
      and public.admin_location_key(other.raw_address)=public.admin_location_key(new.location)) then
      perform location_private.write_location(new.id,'delete',jsonb_build_object('work_location_id',w.id));
     else
      perform location_private.write_location(new.id,'invalidate',jsonb_build_object('address',w.raw_address,'new_address',new.location));
     end if;
    else
     perform location_private.write_location(new.id,'invalidate',jsonb_build_object('address',w.raw_address));
    end if;
   end if;
  end loop;
  perform location_private.reconcile_company(location_private.company_identity(old.company));
 end if;
 perform location_private.reconcile_company(location_private.company_identity(new.company));
 return null;
end$$;
create trigger trg_01_canonical_job_identity after insert or update of company,location on public.local_jobs
 for each row execute function location_private.job_identity_changed();

create or replace function public.admin_reuse_confirmed_location(p_job_id bigint) returns integer
language plpgsql security definer set search_path=pg_catalog as $$declare t record;n int:=0;begin
 perform 1 from public.local_jobs where id=p_job_id for update;
 for t in select * from location_private.valid_memory_targets where job_id=p_job_id order by address loop
  perform location_private.write_location(p_job_id,'upsert',jsonb_build_object('address',t.address,'authority','auto_reuse','memory_id',t.source_candidate_id));n:=n+1;
 end loop;
 return n;
end$$;
revoke all on function public.admin_reuse_confirmed_location(bigint) from public,anon,authenticated;
create or replace function public.replace_job_work_locations(p_job_id bigint,p_rows jsonb) returns void
language plpgsql security definer set search_path=pg_catalog as $$declare originv text;before_addresses jsonb;after_addresses jsonb;begin
 select origin into originv from public.local_jobs where id=p_job_id for update;
 if originv is distinct from 'crawler' then raise exception 'replace_job_work_locations: crawler only';end if;
 select coalesce(jsonb_agg(raw_address order by raw_address),'[]') into before_addresses from public.job_work_locations where job_id=p_job_id;
 perform location_private.write_location(p_job_id,'replace',p_rows);
 perform location_private.reconcile_company((select location_private.company_identity(company) from public.local_jobs where id=p_job_id));
 select coalesce(jsonb_agg(raw_address order by raw_address),'[]') into after_addresses from public.job_work_locations where job_id=p_job_id;
 if before_addresses is distinct from after_addresses and exists(select 1 from public.job_work_locations where job_id=p_job_id and point_kind='unresolved') then
  perform public.map_r1_request_location(p_job_id);
 end if;
end$$;
revoke all on function public.replace_job_work_locations(bigint,jsonb) from public,anon,authenticated;
grant execute on function public.replace_job_work_locations(bigint,jsonb) to service_role;
create or replace function public.set_job_pinned_location(p_job_id bigint,p_token text,p_address text,p_lat float8,p_lng float8)
returns boolean language plpgsql security definer set search_path=pg_catalog as $$declare w record;addr text;begin
 if not public.can_manage_local_job(p_job_id,p_token) then raise exception 'not allowed' using errcode='42501';end if;
 perform 1 from public.local_jobs where id=p_job_id for update;
 if p_lat is null or p_lng is null then
  for w in select * from public.job_work_locations where job_id=p_job_id and point_authority='poster_pin' order by id loop
   perform location_private.write_location(p_job_id,'invalidate',jsonb_build_object('address',w.raw_address));
  end loop;
  return true;
 end if;
 addr:=nullif(btrim(p_address),'');
 if addr is null then select nullif(btrim(location),'') into addr from public.local_jobs where id=p_job_id;end if;
 if addr is null then raise exception 'source address required';end if;
 perform location_private.write_location(p_job_id,'upsert',jsonb_build_object('address',addr,'lat',p_lat,'lng',p_lng,'authority','poster_pin',
  'evidence',jsonb_build_object('source','poster_pin','checkedAt',now())));
 perform public.admin_reuse_confirmed_location(p_job_id);
 return true;
end$$;
revoke all on function public.set_job_pinned_location(bigint,text,text,float8,float8) from public;
grant execute on function public.set_job_pinned_location(bigint,text,text,float8,float8) to anon,authenticated;

create or replace function public.admin_review_location_candidate(p_candidate_id bigint,p_action text,p_note text default '')
returns public.job_location_candidates language plpgsql security definer set search_path=pg_catalog as $$
declare caller uuid:=public.require_admin();cur public.job_location_candidates;result public.job_location_candidates;j public.local_jobs;r record;begin
 select * into cur from public.job_location_candidates where id=p_candidate_id;
 if cur.id is null then raise exception 'candidate not found';end if;
 -- All same-company fanout jobs are locked in ID order before the candidate.
 for r in select id from public.local_jobs where location_private.company_identity(company)=location_private.company_identity(cur.company_snapshot)
 order by id loop perform 1 from public.local_jobs where id=r.id for update;end loop;
 select * into cur from public.job_location_candidates where id=p_candidate_id for update;
 select * into j from public.local_jobs where id=cur.job_id;
 if p_action='approve' then
  if cur.status not in ('pending','revoked') or cur.place_precision not in ('entrance','building','site') then raise exception 'candidate cannot be approved';end if;
  if location_private.company_identity(cur.company_snapshot)<>location_private.company_identity(j.company)
   or not(public.admin_location_key(cur.address_snapshot)=public.admin_location_key(j.location) or exists(
    select 1 from public.job_work_locations where job_id=j.id and public.admin_location_key(raw_address)=public.admin_location_key(cur.address_snapshot))) then
   raise exception 'stale company/address snapshot';end if;
  update public.job_location_candidates set status='revoked',reviewed_by=caller,reviewed_at=clock_timestamp(),review_note='superseded'
   where job_id=cur.job_id and public.admin_location_key(address_snapshot)=public.admin_location_key(cur.address_snapshot) and status='approved' and id<>cur.id;
  update public.job_location_candidates set status='approved',reviewed_by=caller,reviewed_at=clock_timestamp(),review_note=nullif(p_note,'') where id=cur.id returning * into result;
 elsif p_action='reject' and cur.status='pending' then
  update public.job_location_candidates set status='rejected',reviewed_by=caller,reviewed_at=clock_timestamp(),review_note=nullif(p_note,'') where id=cur.id returning * into result;
 elsif p_action='revoke' and cur.status='approved' then
  update public.job_location_candidates set status='revoked',reviewed_by=caller,reviewed_at=clock_timestamp(),review_note=nullif(p_note,'') where id=cur.id returning * into result;
 else raise exception 'invalid review action/state';end if;
 insert into public.admin_audit_logs(admin_user_id,action,target_type,target_id,metadata)
 values(caller,'location_candidate.'||p_action,'job',cur.job_id::text,jsonb_build_object('candidate_id',cur.id,'note',p_note));
 return result;
end$$;
revoke all on function public.admin_review_location_candidate(bigint,text,text) from public,anon;
grant execute on function public.admin_review_location_candidate(bigint,text,text) to authenticated;

-- Completion is an authorization adapter. Reservation/budget RPCs remain intact.
create or replace function public.map_r1_complete(p_id bigint,p_lease uuid,p_result jsonb) returns boolean
language plpgsql security definer set search_path=pg_catalog as $$
declare r public.map_r1_location_jobs;k text;addr text;wid bigint;latv float8;lngv float8;begin
 perform 1 from public.local_jobs where id=p_id for update;
 perform 1 from public.job_work_locations where job_id=p_id order by id for update;
 select * into r from public.map_r1_location_jobs where job_id=p_id for update;
 if not found or p_lease is null or r.lease is distinct from p_lease or r.state<>'processing' then return false;end if;
 if r.snapshot is distinct from public.map_r1_snapshot(p_id) then
  update public.map_r1_location_jobs set state='failed',failures=failures+1,lease=null,updated_at=now() where job_id=p_id;
  return false;
 end if;
 k:=p_result->>'kind';
 if k is null or k not in ('exact','gate','area','unresolved') then raise exception 'invalid result';end if;
 if k<>'unresolved' then
  latv:=(p_result->>'lat')::float8;lngv:=(p_result->>'lng')::float8;
  if latv is null or lngv is null or not(latv between 8 and 24 and lngv between 102 and 110)
   or nullif(btrim(p_result->>'source'),'') is null or nullif(btrim(p_result->>'checkedAt'),'') is null then raise exception 'missing provenance';end if;
  addr:=location_private.provider_target(r.snapshot,p_result);wid:=(p_result->>'workLocationId')::bigint;
  if addr is null or not(addr=r.snapshot->>'location' or exists(select 1 from jsonb_array_elements(r.snapshot->'targets') t where t->>'address'=addr))
   or (wid is not null and not exists(select 1 from public.job_work_locations where id=wid and job_id=p_id and raw_address=addr)) then raise exception 'stale result target';end if;
  if k='exact' and (nullif(btrim(r.snapshot->>'company'),'') is null or nullif(btrim(p_result->>'evidence'),'') is null) then raise exception 'invalid exact evidence';end if;
  if not exists(select 1 from public.job_location_candidates where job_id=p_id and status in ('rejected','revoked')
    and public.admin_location_key(address_snapshot)=public.admin_location_key(addr)) then
   perform location_private.write_location(p_id,'upsert',jsonb_build_object('address',addr,'lat',latv,'lng',lngv,
    'authority',case k when 'exact' then 'source_verified' when 'gate' then 'auto_gate' else 'auto_area' end,'evidence',p_result));
   perform public.admin_reuse_confirmed_location(p_id);
  end if;
 end if;
 update public.map_r1_search_history set result=p_result,failures=failures+case when coalesce((p_result->>'failed')::boolean,false) then 1 else 0 end,updated_at=now()
 where job_id=p_id and search_key=r.search_key;
 update public.map_r1_location_jobs set provider_result=p_result,
 state=case when coalesce((p_result->>'deferred')::boolean,false) then 'deferred' when coalesce((p_result->>'failed')::boolean,false) then 'failed' else 'done' end,
 failures=failures+case when coalesce((p_result->>'failed')::boolean,false) then 1 else 0 end,lease=null,updated_at=now() where job_id=p_id;
 return true;
end$$;
revoke all on function public.map_r1_complete(bigint,uuid,jsonb) from public,anon,authenticated;
grant execute on function public.map_r1_complete(bigint,uuid,jsonb) to service_role;
create or replace function public.map_r1_has_exact(p_id bigint) returns boolean language sql stable set search_path=pg_catalog as $$
 select exists(select 1 from public.job_work_locations where job_id=p_id and point_kind='exact' and location_verified)
$$;
create or replace function public.map_r1_on_job_saved() returns trigger language plpgsql security definer set search_path=pg_catalog as $$begin
 if tg_op='UPDATE' and new.company is not distinct from old.company and new.location is not distinct from old.location then return null;end if;
 perform public.map_r1_request_location(new.id);return null;
end$$;
-- Source rows do not schedule provider work during their intermediate writes.
-- The crawler adapter requests once after a genuinely changed unresolved batch;
-- the parent save trigger handles actual company/address edits.
-- Entire ordered set; legacy result is its first item and has a points array too.
drop function public.map_r1_public_points(bigint[]);
create function public.map_r1_public_points(p_ids bigint[]) returns table(job_id bigint,result jsonb,source_points jsonb)
language sql stable security definer set search_path=pg_catalog as $$
 select j.id,coalesce(location_private.expected_points(j.id)->0,jsonb_build_object('kind','unresolved'))
 ||jsonb_build_object('points',location_private.expected_points(j.id)),location_private.expected_points(j.id)
 from public.local_jobs j where j.id=any(p_ids) and cardinality(p_ids)<=100 and j.active and not j.admin_hidden
$$;
revoke all on function public.map_r1_public_points(bigint[]) from public;
grant execute on function public.map_r1_public_points(bigint[]) to anon,authenticated,service_role;

-- A single transaction gate gives trigger-driven cross-job fanout the same
-- ordering as RPCs. Acquire before scanning/locking rows, including queue claims.
-- This serializes short DB location mutations, never provider network requests.
create function location_private.mutation_gate() returns trigger language plpgsql
set search_path=pg_catalog as $$begin perform pg_advisory_xact_lock(20261026,27);return null;end$$;
create function location_private.gated_body(src text) returns text language plpgsql immutable
set search_path=pg_catalog as $$
declare pos int:=1;len int:=length(src);depth int;startv int;tag text;closing int;escaped boolean;ch text;beginpos int;
begin
 while pos<=len loop
  ch:=substr(src,pos,1);
  if substr(src,pos,2)='--' then
   closing:=strpos(substr(src,pos),E'\n');if closing=0 then exit;end if;pos:=pos+closing;
  elsif substr(src,pos,2)='/*' then
   depth:=1;pos:=pos+2;
   while pos<=len and depth>0 loop
    if substr(src,pos,2)='/*' then depth:=depth+1;pos:=pos+2;
    elsif substr(src,pos,2)='*/' then depth:=depth-1;pos:=pos+2;else pos:=pos+1;end if;
   end loop;
   if depth<>0 then raise exception 'Unclosed comment in RPC source';end if;
  elsif ch=chr(39) or ch='"' then
   escaped:=ch=chr(39) and pos>1 and lower(substr(src,pos-1,1))='e';pos:=pos+1;
   while pos<=len loop
    if escaped and substr(src,pos,1)=chr(92) then pos:=pos+2;
    elsif substr(src,pos,1)=ch then
     if substr(src,pos+1,1)=ch then pos:=pos+2;else pos:=pos+1;exit;end if;
    else pos:=pos+1;end if;
   end loop;
  elsif ch='$' and substring(substr(src,pos) from '^\$[A-Za-z_0-9]*\$') is not null then
   tag:=substring(substr(src,pos) from '^\$[A-Za-z_0-9]*\$');
   closing:=strpos(substr(src,pos+length(tag)),tag);
   if closing=0 then raise exception 'Unclosed dollar string in RPC source';end if;
   pos:=pos+length(tag)+closing-1+length(tag);
  elsif lower(substr(src,pos,5))='begin' and (pos=1 or substr(src,pos-1,1)!~'[A-Za-z_0-9$]')
   and (pos+5>len or substr(src,pos+5,1)!~'[A-Za-z_0-9$]') then beginpos:=pos;exit;
  else pos:=pos+1;end if;
 end loop;
 if beginpos is null then raise exception 'RPC executable BEGIN not found; refusing unsafe patch';end if;
 return overlay(src placing E'begin\n PERFORM pg_catalog.pg_advisory_xact_lock(20261026,27);' from beginpos for 5);
end$$;

do $$declare t text;r record;definition text;newbody text;begin
 for t in select unnest(array['local_jobs','job_location_candidates','admin_confirmed_location_memory','job_work_locations','map_r1_location_jobs','map_r1_search_history']) loop
  execute format('create trigger trg_00_canonical_gate before insert or update or delete on public.%I for each statement execute function location_private.mutation_gate()',t);
 end loop;
 -- Preserve existing ACL, arguments, security mode and body, including quotas.
 -- Install the gate before the first executable BEGIN of every relevant RPC.
 for r in select p.oid,p.prosrc,p.proacl,p.proconfig,p.prosecdef,p.provolatile from pg_proc p join pg_namespace n on n.oid=p.pronamespace join pg_language l on l.oid=p.prolang
  where n.nspname='public' and l.lanname='plpgsql' and p.prorettype<>'trigger'::regtype and p.provolatile='v'
  and p.prosrc ~* '(insert[[:space:]]+into|update[[:space:]]+[a-z_]|delete[[:space:]]+from|for[[:space:]]+update)'
  and p.prosrc ~* '(local_jobs|job_work_locations|job_location_candidates|map_r1_location_jobs|map_r1_search_history|admin_confirmed_location_memory)'
 loop
  definition:=pg_get_functiondef(r.oid);
  newbody:=location_private.gated_body(r.prosrc);
  definition:=overlay(definition placing newbody from strpos(definition,r.prosrc) for length(r.prosrc));
  execute definition;
  if not exists(select 1 from pg_proc p where p.oid=r.oid and p.prosrc=newbody
   and p.proacl is not distinct from r.proacl and p.proconfig is not distinct from r.proconfig
   and p.prosecdef=r.prosecdef and p.provolatile=r.provolatile) then raise exception 'RPC patch changed signature/ACL/security/config';end if;
 end loop;
end$$;

-- Legacy import retains every old row and evidence timestamp without claiming a
-- fresh check. Existing verified points remain exact; legacy unverified is area.
do $$declare w record;s record;t record;addr text;begin
 for w in select * from public.job_work_locations order by job_id,id loop
  perform location_private.write_location(w.job_id,'import',jsonb_build_object('address',w.raw_address,'lat',w.lat,'lng',w.lng,
  'authority',case when w.lat is null then 'unresolved' when w.location_verified then 'legacy_verified' else 'legacy_area' end,
  'evidence',jsonb_build_object('source',w.geocode_source,'checkedAt',w.updated_at,'importedLegacy',true,'timestampMeaning','original_row_updated_at')));
 end loop;
 -- Current, evidenced provider approximations only. Source wins when already present.
 for s in select q.* from public.map_r1_location_jobs q where q.provider_result->>'kind' in ('gate','area')
 and q.snapshot=public.map_r1_snapshot(q.job_id) and q.state in ('done','failed','deferred') order by q.job_id loop
  if nullif(s.provider_result->>'source','') is null or nullif(s.provider_result->>'checkedAt','') is null then raise exception 'cache import lacks evidence';end if;
  addr:=location_private.provider_target(s.snapshot,s.provider_result);
  if addr is null or not(addr=s.snapshot->>'location' or exists(select 1 from jsonb_array_elements(s.snapshot->'targets') x where x->>'address'=addr)) then raise exception 'cache import target conflict';end if;
  if not exists(select 1 from public.job_work_locations where job_id=s.job_id and public.admin_location_key(raw_address)=public.admin_location_key(addr) and lat is not null) then
   perform location_private.write_location(s.job_id,'import',jsonb_build_object('address',addr,'lat',s.provider_result->'lat','lng',s.provider_result->'lng',
    'authority',case s.provider_result->>'kind' when 'gate' then 'auto_gate' else 'auto_area' end,'evidence',s.provider_result));
  end if;
 end loop;
 for t in select id,location from public.local_jobs j where nullif(btrim(j.location),'') is not null
  and not exists(select 1 from public.job_work_locations missing_work where missing_work.job_id=j.id) order by id loop
  perform location_private.write_location(t.id,'upsert',jsonb_build_object('address',t.location,'authority','unresolved'));
 end loop;
 for t in select distinct location_private.company_identity(company) company from public.local_jobs order by 1 loop
  perform location_private.reconcile_company(t.company);
 end loop;
end$$;
update public.map_r1_location_jobs set source_points=location_private.expected_points(job_id);

create function public.location_integrity_issues() returns table(issue text,job_id bigint,work_location_id bigint)
language sql stable security definer set search_path=pg_catalog as $$
 select 'confirmed_memory_differs_from_source',v.job_id,w.id from location_private.valid_memory_targets v
 left join public.job_work_locations w on w.job_id=v.job_id and public.admin_location_key(w.raw_address)=public.admin_location_key(v.address)
 where w.id is null or w.lat is distinct from v.lat or w.lng is distinct from v.lng or not w.location_verified or w.point_candidate_id is distinct from v.source_candidate_id
 union all
 select 'stale_confirmation_on_source',w.job_id,w.id from public.job_work_locations w where w.point_candidate_id is not null
 and not exists(select 1 from location_private.valid_memory_targets v where v.job_id=w.job_id
 and public.admin_location_key(v.address)=public.admin_location_key(w.raw_address) and v.source_candidate_id=w.point_candidate_id)
 union all
 select 'invalid_source_point',w.job_id,w.id from public.job_work_locations w where
 (w.point_kind='unresolved' and (w.lat is not null or w.lng is not null or w.location_verified))
 or (w.point_kind<>'unresolved' and (w.lat is null or w.lng is null or not(w.lat between 8 and 24 and w.lng between 102 and 110)
 or w.point_precision is null or nullif(w.point_evidence->>'source','') is null or nullif(w.point_evidence->>'checkedAt','') is null
 or (w.point_kind='exact')<>w.location_verified))
 union all
 select 'map_cache_differs_from_source',j.id,null::bigint from public.local_jobs j left join public.map_r1_location_jobs s on s.job_id=j.id
 where j.active and not j.admin_hidden and ((s.job_id is null and location_private.expected_points(j.id)<>'[]'::jsonb) or s.source_points is distinct from location_private.expected_points(j.id)
 or s.result is distinct from location_private.expected_points(j.id)->0)
$$;
revoke all on function public.location_integrity_issues() from public,anon,authenticated;
grant execute on function public.location_integrity_issues() to service_role;
insert into public.job_posting_rules(rule_key,content,decided_on,machine_checkable,block_mode,implementation)
values
 ('L1_single_location_source','공고 위치의 원본은 job_work_locations 하나. 후보/기억/공급자 응답을 별도 화면 좌표 원본으로 쓰지 않는다.','2026-10-26','가능','저장거부','원본 제약 + 메인/상세/원본 점 집합 전수 검사'),
 ('L2_single_location_writer','확정·재사용·자동 위치·작성자 핀·수집 좌표는 private 단일 쓰기 함수만 통과. 직접 쓰기는 권한/트리거로 차단한다.','2026-10-26','가능','저장거부','location_private.write_location + NOLOGIN 역할 + guard_source_write'),
 ('L3_derived_location_cache','지도 캐시는 원본 트리거로 갱신. 유효한 확정 기억은 동일 회사/주소에 자동 반영. 불일치는 저녁 8시 보고한다.','2026-10-26','가능','저장거부','원본→캐시 트리거 / location_integrity_issues / 기존 저녁 보고'),
 ('L4_data_independent_location_tests','운영 위치 시험은 특정 공고 번호·회사명·건수에 의존하지 않는다. 모든 공개 공고의 점 집합·정밀도를 원본과 대조한다.','2026-10-26','가능','없음','CI 정적 검사 + 동적 전수 검사 + 비공개 생성 ID E2E')
on conflict(rule_key) do update set content=excluded.content,decided_on=excluded.decided_on,
 machine_checkable=excluded.machine_checkable,block_mode=excluded.block_mode,implementation=excluded.implementation;
-- Do not set last_test_result to success merely because a rule row exists.

-- Revoke ACLs as each actual owner; NOINHERIT ownership-transfer membership
-- alone cannot grant/revoke the writer-owned functions in managed PostgreSQL.
do $$declare migration_role text:=current_user;r record;begin
 for r in select p.oid::regprocedure signature from pg_proc p join pg_namespace n on n.oid=p.pronamespace
  where n.nspname='location_private' and p.proowner=current_user::regrole loop
  execute format('revoke all on function %s from public,anon,authenticated,service_role',r.signature);
 end loop;
 execute 'set local role location_writer';
 for r in select p.oid::regprocedure signature from pg_proc p join pg_namespace n on n.oid=p.pronamespace
  where n.nspname='location_private' and p.proowner=current_user::regrole loop
  execute format('revoke all on function %s from public,anon,authenticated,service_role',r.signature);
 end loop;
 execute format('set local role %I',migration_role);
end$$;
revoke create on schema location_private from location_writer;
do $$begin execute format('revoke location_writer from %I',current_user);end$$;
-- PostgreSQL 17 retains its automatic creator ADMIN-only grant. It may manage
-- this NOLOGIN role but cannot inherit or SET it; no application member exists.
do $$begin
 if exists(select 1 from location_private.retained_rows a join public.local_jobs j on j.id=a.job_id
  where a.relation_name='local_jobs' and a.reason='pre_cutover' and a.row_data is distinct from jsonb_build_object('active',j.active,'admin_hidden',j.admin_hidden)) then
  raise exception 'Publication flags changed during cutover';end if;
 if exists(select 1 from location_private.retained_rows a join public.map_r1_location_jobs q on q.job_id=a.job_id
  where a.relation_name='map_r1_location_jobs' and a.reason='pre_cutover' and
  (a.row_data->'state' is distinct from to_jsonb(q.state) or a.row_data->'lease' is distinct from coalesce(to_jsonb(q.lease),'null')
   or a.row_data->'calls' is distinct from to_jsonb(q.calls) or a.row_data->'failures' is distinct from to_jsonb(q.failures))) then
  raise exception 'Existing queue lease/budget/state changed during cutover';end if;
 if exists(select 1 from public.location_integrity_issues()) then raise exception 'Canonical postcondition failed; entire transaction rolled back';end if;
 if exists(select 1 from pg_auth_members where roleid=(select oid from pg_roles where rolname='location_writer')
  and not(member=current_user::regrole and admin_option and not inherit_option and not set_option)) then
  raise exception 'Writer role has unsafe or application membership';end if;
 if pg_has_role('anon','location_writer','MEMBER') or pg_has_role('authenticated','location_writer','MEMBER') or pg_has_role('service_role','location_writer','MEMBER')
  or has_function_privilege('anon','location_private.write_location(bigint,text,jsonb)','EXECUTE')
  or has_function_privilege('authenticated','location_private.write_location(bigint,text,jsonb)','EXECUTE')
  or has_function_privilege('service_role','location_private.write_location(bigint,text,jsonb)','EXECUTE') then
  raise exception 'Application role has writer membership path or private execute';end if;
 if exists(select 1 from pg_roles where rolname='location_writer' and (rolcanlogin or rolbypassrls or rolsuper)) then raise exception 'Unsafe writer role';end if;
end$$;
commit;
