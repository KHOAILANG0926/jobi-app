-- Private, synthetic data with generated IDs; production data is never copied.
insert into auth.users(id) values(gen_random_uuid()) returning id as seed_admin \gset
insert into public.local_jobs(title,company,location,origin,active,admin_hidden) values('legacy fixture','Legacy human','Legacy address','crawler',false,true) returning id as seed_job \gset
insert into public.job_work_locations(job_id,raw_address) values(:seed_job,'Legacy address');
insert into public.job_location_candidates(job_id,company_snapshot,address_snapshot,lat,lng,place_precision,source,evidence,status,reviewed_by,reviewed_at)
 values(:seed_job,'Legacy human','Legacy address',21.15,106.15,'building','company_official','Original human evidence','approved',:'seed_admin',now()) returning id as seed_candidate \gset
insert into public.admin_confirmed_location_memory(source_candidate_id,address_key,company_key,lat,lng,place_precision,approved_by,approved_at,source_address)
 select id,public.admin_location_key(address_snapshot),public.admin_location_key(company_snapshot),lat,lng,place_precision,reviewed_by,reviewed_at,address_snapshot from public.job_location_candidates where id=:seed_candidate;
insert into public.map_r1_location_jobs(job_id,snapshot,search_key,state,calls,failures,lease,result)
 values(:seed_job,public.map_r1_snapshot(:seed_job),'legacy-history','processing',1,1,gen_random_uuid(),jsonb_build_object('kind','area','lat',21.01,'lng',106.01,'source','OpenStreetMap retained','checkedAt',now()));
insert into public.local_jobs(title,company,location,origin,active,admin_hidden) values('legacy fixture','Legacy approximate','Legacy unverified address','crawler',false,true) returning id as seed_legacy_job \gset
insert into public.job_work_locations(job_id,raw_address,lat,lng,geocode_source,location_verified,coordinate_accuracy)
 values(:seed_legacy_job,'Legacy unverified address',21.2,106.2,'Original unverified directory',false,'exact');
insert into public.local_jobs(title,company,location,origin,active,admin_hidden) values('cache fixture','Legacy cache','Cache source address','crawler',false,true) returning id as seed_cache_job \gset
insert into public.map_r1_location_jobs(job_id,snapshot,search_key,state,result)
 values(:seed_cache_job,public.map_r1_snapshot(:seed_cache_job),'cache-history','done',jsonb_build_object('kind','area','lat',21.3,'lng',106.3,'source','VietMap private_opaque_identifier','checkedAt',now()));
-- Display text may include an extra province while the sole raw target is a
-- shorter source address. Address-less cache must map to that sole target.
insert into public.local_jobs(title,company,location,origin,active,admin_hidden) values('alias fixture','Alias human','Sole source address, province display','crawler',false,true) returning id as alias_job \gset
insert into public.job_work_locations(job_id,raw_address) values(:alias_job,'Sole source address');
insert into public.job_location_candidates(job_id,company_snapshot,address_snapshot,lat,lng,place_precision,source,evidence,status,reviewed_by,reviewed_at)
 values(:alias_job,'Alias human','Sole source address',21.5,106.5,'building','company_official','Alias human evidence','approved',:'seed_admin',now()) returning id as alias_candidate \gset
insert into public.admin_confirmed_location_memory(source_candidate_id,address_key,company_key,lat,lng,place_precision,approved_by,approved_at,source_address)
 select id,public.admin_location_key(address_snapshot),public.admin_location_key(company_snapshot),lat,lng,place_precision,reviewed_by,reviewed_at,address_snapshot from public.job_location_candidates where id=:alias_candidate;
insert into public.map_r1_location_jobs(job_id,snapshot,search_key,state,result)
 values(:alias_job,public.map_r1_snapshot(:alias_job),'alias-history','done',jsonb_build_object('kind','area','lat',21.01,'lng',106.01,'source','OpenStreetMap old','checkedAt',now()));
