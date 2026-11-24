-- 시험 DB 준비(폐기용, 운영 아님): 20261124120000_multi_branch_conversion 시험.
-- 위치 원본 쓰기 함수는 대역이 아니라 운영 본문 그대로다: 20261026231445_location_single_source.sql의 write_location을 글자 그대로 옮겼다
-- (뒤의 패치 20261028050507·20261029120000이 넣은 성·시 중심 단계는 20261111200000이 다시 지워, 지금 운영 본문은 이것과 같은 갈래다).
-- 원본 줄 직접 쓰기 막는 트리거(guard_source_write)도 운영과 같다. ingest_job만 '기존 공고 위치 글자 고치기'(update_fields=location) 대역이다.
do $$begin if not exists(select 1 from pg_roles where rolname='location_writer') then create role location_writer nologin; end if; end$$;
alter table public.local_jobs add column if not exists title text, add column if not exists source text, add column if not exists source_url text,
  add column if not exists source_text text, add column if not exists active boolean default true, add column if not exists admin_hidden boolean default false;
create sequence if not exists public.job_work_locations_id_seq start 500000;
alter table public.job_work_locations alter column id set default nextval('public.job_work_locations_id_seq'),
  add column if not exists normalized_address text, add column if not exists country text default 'VN', add column if not exists province text,
  add column if not exists district text, add column if not exists ward text, add column if not exists shuttle_route text, add column if not exists address_accuracy text,
  add column if not exists address_evidence text, add column if not exists resolved_province text, add column if not exists resolved_wards text[],
  add column if not exists matched_recruitment_regions text[], add column if not exists coordinate_accuracy text, add column if not exists verification_method text,
  add column if not exists geocode_source text, add column if not exists geocode_status text default 'pending',
  add column if not exists point_kind text not null default 'unresolved', add column if not exists point_precision text,
  add column if not exists point_authority text not null default 'unresolved', add column if not exists point_company_key text,
  add column if not exists point_candidate_id bigint, add column if not exists point_memory_id bigint,
  add column if not exists point_evidence jsonb not null default '{}', add column if not exists point_revision bigint not null default 0,
  add column if not exists updated_at timestamptz default now();
create schema if not exists location_private;
create table if not exists location_private.retained_rows (id bigint generated always as identity primary key, relation_name text not null, job_id bigint not null, row_data jsonb not null, reason text not null, retained_at timestamptz not null default now());
create table if not exists location_private.write_log (id bigint generated always as identity primary key, job_id bigint not null, work_location_id bigint, operation text not null, previous_row jsonb, next_row jsonb, request_payload jsonb, created_at timestamptz not null default now());
create table if not exists public.research_artifacts (kind text not null, name text not null, payload jsonb, meta jsonb, unique (kind, name));
create table if not exists public.applications (id bigint generated always as identity primary key, job_id bigint);
create table if not exists public.message_threads (id bigint generated always as identity primary key, job_id bigint);
create table if not exists public.interviews (id bigint generated always as identity primary key, job_id bigint);
create table if not exists public.mbc_test_ingest_calls (p jsonb);
create or replace function location_private.company_identity(p_text text) returns text language sql immutable
set search_path=pg_catalog as $$select lower(regexp_replace(btrim(normalize(coalesce(p_text,''),NFC)),'[[:space:]]+',' ','g'))$$;
create or replace function location_private.safe_source(p_source text) returns text language sql immutable
set search_path=pg_catalog as $$select case
 when p_source ilike '%vietmap%' then 'VietMap'
 when p_source ilike '%openstreetmap%' or p_source ilike '%osm%' then 'OpenStreetMap'
 when p_source='admin_approved' then 'admin_approved'
 when p_source='poster_pin' then 'poster_pin'
 else 'source_evidence' end$$;
create or replace view location_private.valid_memory_targets as select null::bigint as job_id, null::text as address, null::bigint as source_candidate_id where false;
grant usage on schema public, location_private to location_writer;
grant select on public.local_jobs, public.job_work_locations, public.job_location_candidates, location_private.valid_memory_targets to location_writer;
grant insert, update, delete on public.job_work_locations to location_writer;
grant insert on location_private.write_log, location_private.retained_rows to location_writer;
grant usage, select on sequence public.job_work_locations_id_seq to location_writer;
grant execute on function public.admin_location_key(text), location_private.company_identity(text), location_private.safe_source(text) to location_writer;
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
create or replace function location_private.guard_source_write() returns trigger language plpgsql set search_path=pg_catalog as $$begin
 if current_user<>'location_writer' then
  if tg_op='DELETE' and not exists(select 1 from public.local_jobs where id=old.job_id) then return old; end if;
  raise exception 'location source: use the canonical writer' using errcode='42501';
 end if;
 return case when tg_op='DELETE' then old else new end;
end$$;
create trigger trg_00_location_single_writer before insert or update or delete on public.job_work_locations
 for each row execute function location_private.guard_source_write();
create or replace function public.ingest_job(p jsonb) returns bigint language plpgsql as $f$
begin
  if coalesce(btrim(p->>'source_text'), '') = '' then raise exception 'ingest: source_text(원문) 필요'; end if;
  if p->>'channel' is distinct from 'sql_file' or p->'update_fields' is distinct from '["location"]'::jsonb or not (p ? 'job_id') then
    raise exception 'test stub: only existing-job location fix expected, got %', p; end if;
  insert into public.mbc_test_ingest_calls values (p);
  update public.local_jobs set location = p->>'location' where id = (p->>'job_id')::bigint;
  return (p->>'job_id')::bigint;
end $f$;
-- dry-run(45314812701)과 같은 공고·줄 번호·위치 근거·공개 상태(주소·좌표는 시험용 값)
insert into public.local_jobs(id, company, title, location, source, source_url, source_text, active, admin_hidden) values
 (4825, 'CTY KTCN SG', 'Kỹ sư MEP', 'Cảng hàng không', 'chotot', 'https://example.test/a', 'nguyên văn A', false, false),
 (5992, 'KRIK', 'KRIK tuyển', '152 Trần Hưng Đạo, Kinh Bắc, Bắc Ninh', null, null, 'nguyên văn B', true, false),
 (5994, 'MEDIAMART', 'MediaMart tuyển', 'Số 37 Lý Thái Tổ, Bắc Ninh', null, null, 'nguyên văn C', true, false),
 (9104, 'Solo', 'Một chỗ', '1 Ngô Gia Tự', null, null, 'nguyên văn D', true, false);
alter table public.job_work_locations disable trigger trg_00_location_single_writer;
insert into public.job_work_locations(id, job_id, raw_address, normalized_address, sort_order, lat, lng, location_verified, point_kind, point_precision, point_authority, point_evidence, geocode_status, coordinate_accuracy) values
 (1118, 4825, 'Cảng hàng không', null, 0, null, null, false, 'unresolved', null, 'unresolved', '{}', 'pending', 'unresolved'),
 (1121, 4825, 'Sân bay Quảng Trị', null, 1, null, null, false, 'unresolved', null, 'unresolved', '{}', 'pending', 'unresolved'),
 (1119, 4825, 'Cảng HKQT Long Thành', null, 2, null, null, false, 'unresolved', null, 'unresolved', '{}', 'pending', 'unresolved'),
 (1120, 4825, 'Dự án Becamex Bình Dương', null, 3, null, null, false, 'unresolved', null, 'unresolved', '{}', 'pending', 'unresolved'),
 (1776, 5992, '152 Trần Hưng Đạo, Kinh Bắc, Bắc Ninh', null, 0, 21.18, 106.07, false, 'area', 'area', 'auto_area', '{"source":"source_evidence","checkedAt":"2026-11-20T00:00:00+00:00"}', 'success', 'region'),
 (1798, 5992, '148 Trần Phú, Từ Sơn, Bắc Ninh', null, 1, 21.117, 105.96, true, 'exact', 'site', 'source_verified', '{"source":"source_evidence","checkedAt":"2026-11-20T00:00:00+00:00"}', 'manual', 'exact'),
 (1778, 5994, 'Số 37 Lý Thái Tổ, Bắc Ninh', null, 0, 21.18, 106.06, true, 'exact', 'site', 'source_verified', '{"source":"source_evidence","checkedAt":"2026-11-20T00:00:00+00:00"}', 'manual', 'exact'),
 (1800, 5994, 'Đường Trần Phú, Phường Từ Sơn, Bắc Ninh', null, 1, 21.12, 105.96, false, 'area', 'area', 'auto_area', '{"source":"VietMap","checkedAt":"2026-11-20T00:00:00+00:00"}', 'success', 'region'),
 (9141, 9104, '1 Ngô Gia Tự', null, 0, 21.18, 106.07, true, 'exact', 'site', 'source_verified', '{"source":"source_evidence","checkedAt":"2026-11-20T00:00:00+00:00"}', 'manual', 'exact');
alter table public.job_work_locations enable trigger trg_00_location_single_writer;
create table public.mbc_test_before as select id, job_id, to_jsonb(w) as row_data from public.job_work_locations w where job_id in (4825, 5992, 5994, 9104);
create table public.mbc_test_jobs_before as select id, location from public.local_jobs where id in (4825, 5992, 5994, 9104);
