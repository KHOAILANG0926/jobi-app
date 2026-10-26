-- READ ONLY. Run against production before the transactional cutover.
-- No specific posting IDs, company names or publication counts select targets.
with caches as (
 select s.job_id,coalesce(nullif(btrim(s.result->>'address'),''),case jsonb_array_length(coalesce(s.snapshot->'targets','[]')) when 1 then nullif(btrim(s.snapshot->'targets'->0->>'address'),'') when 0 then nullif(btrim(s.snapshot->>'location'),'') else null end) address,s.result
 from public.map_r1_location_jobs s where s.result->>'kind' in ('gate','area') and s.snapshot=public.map_r1_snapshot(s.job_id) and s.state in ('done','failed','deferred')
), targets as (
 select j.id job_id,w.id work_location_id,j.company,w.raw_address address,w.lat,w.lng,w.location_verified,w.geocode_source,w.updated_at
 from public.local_jobs j join public.job_work_locations w on w.job_id=j.id
 union all select j.id,null::bigint,j.company,j.location,null::float8,null::float8,false,null::text,null::timestamptz
 from public.local_jobs j where nullif(btrim(j.location),'') is not null and not exists(select 1 from public.job_work_locations w where w.job_id=j.id)
 union all select j.id,null::bigint,j.company,q.address,null::float8,null::float8,false,null::text,null::timestamptz
 from caches q join public.local_jobs j on j.id=q.job_id where q.address is not null
 and not exists(select 1 from public.job_work_locations w where w.job_id=j.id and public.admin_location_key(w.raw_address)=public.admin_location_key(q.address))
 and (exists(select 1 from public.job_work_locations w where w.job_id=j.id) or public.admin_location_key(q.address)<>public.admin_location_key(j.location))
), approvals as (
 select t.job_id,t.work_location_id,t.address,c.id candidate_id,c.lat,c.lng,c.place_precision,c.reviewed_at,
 row_number() over(partition by t.job_id,public.admin_location_key(t.address) order by c.reviewed_at desc,c.id desc) preference
 from targets t join public.job_location_candidates c
 on lower(regexp_replace(btrim(normalize(c.company_snapshot,NFC)),'[[:space:]]+',' ','g'))=lower(regexp_replace(btrim(normalize(t.company,NFC)),'[[:space:]]+',' ','g'))
 and public.admin_location_key(c.address_snapshot)=public.admin_location_key(t.address)
 join public.admin_confirmed_location_memory m on m.source_candidate_id=c.id and m.active
 join public.local_jobs origin_job on origin_job.id=c.job_id
 where c.status='approved' and c.reviewed_by is not null and c.reviewed_at is not null and c.evidence not like 'AUTO REUSE:%'
 and c.place_precision in ('entrance','building','site') and nullif(btrim(c.evidence),'') is not null
 and c.lat between 8 and 24 and c.lng between 102 and 110
 and m.approved_by=c.reviewed_by and m.approved_at=c.reviewed_at and m.lat=c.lat and m.lng=c.lng and m.place_precision=c.place_precision
 and m.address_key=public.admin_location_key(c.address_snapshot)
 and lower(regexp_replace(btrim(normalize(origin_job.company,NFC)),'[[:space:]]+',' ','g'))=lower(regexp_replace(btrim(normalize(c.company_snapshot,NFC)),'[[:space:]]+',' ','g'))
 and (public.admin_location_key(origin_job.location)=public.admin_location_key(c.address_snapshot) or exists(
 select 1 from public.job_work_locations ow where ow.job_id=origin_job.id and public.admin_location_key(ow.raw_address)=public.admin_location_key(c.address_snapshot)))
), projected as (
 select t.job_id,t.work_location_id,t.address,
 jsonb_build_object('lat',t.lat,'lng',t.lng,'verified',t.location_verified) before_point,
 case when a.candidate_id is not null then jsonb_build_object('lat',a.lat,'lng',a.lng,'kind','exact','precision',a.place_precision,'authority','auto_reuse','candidate_id',a.candidate_id,'checkedAt',a.reviewed_at)
 when t.lat is not null then jsonb_build_object('lat',t.lat,'lng',t.lng,'kind',case when t.location_verified then 'exact' else 'area' end,'authority',case when t.location_verified then 'legacy_verified' else 'legacy_area' end,'checkedAt',t.updated_at,'timestampMeaning','original_row_updated_at')
 when q.result is not null then jsonb_build_object('lat',q.result->'lat','lng',q.result->'lng','kind',q.result->>'kind','authority','provider_import','checkedAt',q.result->>'checkedAt')
 else jsonb_build_object('kind','unresolved') end after_point
 from targets t left join approvals a on a.job_id=t.job_id and public.admin_location_key(a.address)=public.admin_location_key(t.address) and a.preference=1
 left join caches q on q.job_id=t.job_id and public.admin_location_key(q.address)=public.admin_location_key(t.address)
), blockers as (
 select 'invalid_source_coordinate' issue,w.job_id from public.job_work_locations w where (w.lat is null)<>(w.lng is null) or (w.lat is not null and not(w.lat between 8 and 24 and w.lng between 102 and 110))
 union all select 'missing_source_evidence',w.job_id from public.job_work_locations w where w.lat is not null and nullif(btrim(w.geocode_source),'') is null
 union all select 'missing_cache_evidence',c.job_id from caches c where nullif(c.result->>'source','') is null or nullif(c.result->>'checkedAt','') is null
 union all select 'ambiguous_cache_target',s.job_id from public.map_r1_location_jobs s where s.result->>'kind' in ('gate','area') and s.snapshot=public.map_r1_snapshot(s.job_id) and nullif(btrim(s.result->>'address'),'') is null and jsonb_array_length(coalesce(s.snapshot->'targets','[]'))>1
 union all select 'cache_target_conflict',c.job_id from caches c where c.address is null or not exists(select 1 from public.local_jobs j where j.id=c.job_id and
 (j.location=c.address or exists(select 1 from public.job_work_locations w where w.job_id=j.id and w.raw_address=c.address)))
 union all select 'conflicting_human_evidence',a.job_id from public.job_location_candidates a join public.job_location_candidates b
 on a.id<b.id and lower(normalize(a.company_snapshot,NFC))=lower(normalize(b.company_snapshot,NFC))
 and public.admin_location_key(a.address_snapshot)=public.admin_location_key(b.address_snapshot) and a.reviewed_at=b.reviewed_at
 and row(a.lat,a.lng,a.place_precision) is distinct from row(b.lat,b.lng,b.place_precision)
 where a.status='approved' and b.status='approved' and a.reviewed_by is not null and b.reviewed_by is not null and a.evidence not like 'AUTO REUSE:%' and b.evidence not like 'AUTO REUSE:%'
)
select jsonb_build_object('blockers',coalesce((select jsonb_agg(to_jsonb(b)) from blockers b),'[]'::jsonb),
 'targets',coalesce((select jsonb_agg(to_jsonb(p) order by p.job_id,p.work_location_id) from projected p),'[]'::jsonb),
 'approved_targets',(select count(*) from approvals where preference=1),
 'legacy_unverified_retained_as_area',(select count(*) from public.job_work_locations where lat is not null and not location_verified),
 'publication_flags_changed',false,'queue_leases_budgets_changed',false,
 'rpc_gate_inventory',(select jsonb_agg(p.oid::regprocedure::text order by p.oid::regprocedure::text) from pg_proc p join pg_namespace n on n.oid=p.pronamespace join pg_language l on l.oid=p.prolang
 where n.nspname='public' and l.lanname='plpgsql' and p.prorettype<>'trigger'::regtype and p.provolatile='v'
 and p.prosrc ~* '(insert[[:space:]]+into|update[[:space:]]+[a-z_]|delete[[:space:]]+from|for[[:space:]]+update)' and p.prosrc ~* '(local_jobs|job_work_locations|job_location_candidates|map_r1_location_jobs|map_r1_search_history|admin_confirmed_location_memory)')) preview;
