-- Disposable local database only: generated identities, rolled back fixtures.
begin;
do $$
declare jid bigint; otherid bigint; original_member boolean; original_create boolean;
begin
 if location_private.provider_target('{"targets":[{"address":"Khu A, Bắc Ninh","workLocationId":301},{"address":"Khu B, Bắc Ninh","workLocationId":302}]}'::jsonb,'{"address":"Khu A, Bắc Ninh","workLocationId":301,"kind":"area"}'::jsonb) is distinct from 'Khu A, Bắc Ninh' then raise exception 'multi-workplace administrative result must bind explicit canonical target';end if;
 if location_private.administrative_area('Đường Nguyễn Văn Cừ, TP. Bắc Ninh, Bắc Ninh')->>'key' is distinct from 'city:bac ninh'
 then raise exception 'explicit city must precede province';end if;
 if location_private.administrative_area('TP. Hải Dương, Hải Dương') is not null then raise exception 'unsupported city must not become broader province';end if;
 if location_private.administrative_area('Bắc Ninh, Hà Nội') is not null then raise exception 'conflicting provinces must not be guessed';end if;
 insert into public.local_jobs(title,company,location,origin,active,admin_hidden)
 values('Disposable area fixture','Generated area employer','Đường Nguyễn Văn Cừ, TP. Bắc Ninh, Bắc Ninh','crawler',true,false) returning id into jid;
 if not exists(select 1 from public.job_work_locations where job_id=jid and point_kind='area'
 and lat=21.18608 and lng=106.07632 and not location_verified and point_authority='auto_area') then raise exception 'new null-coordinate city job needs canonical approximate pin';end if;
 if not exists(select 1 from public.map_r1_location_jobs where job_id=jid and jsonb_array_length(source_points)>0) then raise exception 'main map projection needs canonical area pin';end if;
 perform public.replace_job_work_locations(jid,jsonb_build_array(jsonb_build_object('raw_address','12 Nguyễn Văn Cừ, TP. Bắc Ninh, Bắc Ninh')));
 if not exists(select 1 from public.test_hook_requests where job_id=jid) then raise exception 'area approximation must not suppress higher-priority provider attempt';end if;
 perform location_private.write_location(jid,'upsert',jsonb_build_object('address','12 Nguyễn Văn Cừ, TP. Bắc Ninh, Bắc Ninh',
 'lat',21.18,'lng',106.07,'authority','source_verified','evidence',jsonb_build_object('source','VietMap verified fixture','checkedAt',now(),'evidence','Exact numbered street match')));
 perform location_private.write_location(jid,'upsert',jsonb_build_object('address','12 Nguyễn Văn Cừ, TP. Bắc Ninh, Bắc Ninh','authority','unresolved'));
 if not exists(select 1 from public.job_work_locations where job_id=jid and point_kind='exact' and location_verified and lat=21.18) then raise exception 'automatic fallback overwrote verified source';end if;
 insert into public.local_jobs(title,company,location,origin,active,admin_hidden)
 values('Disposable other province','Different generated employer','Hải Dương','crawler',true,false) returning id into otherid;
 if not exists(select 1 from public.job_work_locations where job_id=otherid and point_kind='area' and lat=20.9613 and lng=106.364 and not location_verified) then raise exception 'original Hải Dương must not remap to Hải Phòng';end if;
 if has_schema_privilege('location_writer','location_private','CREATE') then raise exception 'temporary schema CREATE remained granted';end if;
 if exists(select 1 from pg_auth_members where roleid='location_writer'::regrole and (inherit_option or set_option)) then raise exception 'unsafe writer membership remained granted';end if;
 if exists(select 1 from public.location_integrity_issues()) then raise exception 'fallback broke canonical projection integrity';end if;
end$$;
rollback;
select 'PASS: generated null-coordinate jobs, city witness, original province, provider priority, verified protection, queue flags and permissions' result;
