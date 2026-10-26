-- READ ONLY. No DDL/DML, no posting-ID filters.
with targets as (
 select j.id job_id,w.id work_location_id,j.company,w.raw_address,w.lat,w.lng,w.location_verified
 from public.local_jobs j join public.job_work_locations w on w.job_id=j.id
 union all select j.id,null::bigint,j.company,j.location,null::float8,null::float8,false
 from public.local_jobs j where not exists(select 1 from public.job_work_locations w where w.job_id=j.id)
), matches as (
 select t.*,m.source_candidate_id,m.lat confirmed_lat,m.lng confirmed_lng,
 row_number() over(partition by t.job_id,t.work_location_id order by m.approved_at desc,m.source_candidate_id desc) rank
 from targets t join public.admin_confirmed_location_memory m
 on m.active and m.company_key=public.admin_location_key(t.company)
 and m.address_key=public.admin_location_key(t.raw_address)
 join public.job_location_candidates c on c.id=m.source_candidate_id and c.status='approved'
 join public.local_jobs origin_job on origin_job.id=c.job_id
 where m.place_precision in ('entrance','building','site')
 and lower(normalize(c.company_snapshot,NFC))=lower(normalize(t.company,NFC))
 and lower(normalize(origin_job.company,NFC))=lower(normalize(c.company_snapshot,NFC))
 and c.reviewed_by=m.approved_by and c.reviewed_at=m.approved_at
 and c.lat=m.lat and c.lng=m.lng and c.place_precision=m.place_precision
 and (public.admin_location_key(origin_job.location)=m.address_key or exists(select 1 from public.job_work_locations ow where ow.job_id=origin_job.id and public.admin_location_key(ow.raw_address)=m.address_key))
)
select jsonb_build_object('public_jobs',(select count(*) from public.local_jobs where active and not admin_hidden),
'memory_targets',(select count(*) from matches where rank=1),
'confirmed_source_mismatches',(select jsonb_agg(jsonb_build_object('job_id',job_id,'work_id',work_location_id,'company',company,'old_lat',lat,'old_lng',lng,'new_lat',confirmed_lat,'new_lng',confirmed_lng)) from matches where rank=1 and (lat is distinct from confirmed_lat or lng is distinct from confirmed_lng or not location_verified)),
'public_points',(select jsonb_agg(jsonb_build_object('id',j.id,'work_rows',(select count(*) from public.job_work_locations w where w.job_id=j.id),'source_points',(select count(*) from public.job_work_locations w where w.job_id=j.id and w.lat is not null and w.lng is not null),'cache_kind',s.result->>'kind')) from public.local_jobs j left join public.map_r1_location_jobs s on s.job_id=j.id where j.active and not j.admin_hidden)) as report;
