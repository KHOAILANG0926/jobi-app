do $$begin
 if not exists(select 1 from location_private.retained_rows a join public.job_work_locations w on w.job_id=a.job_id
  where a.relation_name='job_work_locations' and a.row_data->>'geocode_source'='Original unverified directory'
  and w.point_kind='area' and not w.location_verified and w.coordinate_accuracy='region'
  and w.point_evidence->>'timestampMeaning'='original_row_updated_at') then raise exception 'Legacy unverified coordinate not truthfully retained';end if;
 if not exists(select 1 from public.map_r1_location_jobs s where s.provider_result->>'source'='VietMap private_opaque_identifier'
  and s.source_points->0->>'source'='VietMap' and s.source_points->0->>'kind'='area') then raise exception 'Cache import/sanitizer failed';end if;
 if not exists(select 1 from public.job_work_locations w join public.job_location_candidates c on c.id=w.point_candidate_id
  where c.evidence='Original human evidence' and w.point_kind='exact' and w.lat=c.lat and w.lng=c.lng) then raise exception 'Human import failed';end if;
 if exists(select 1 from public.location_integrity_issues()) then raise exception 'Import invariants failed';end if;
 if (select count(*) from public.job_posting_rules where rule_key in ('L1_single_location_source','L2_single_location_writer','L3_derived_location_cache','L4_data_independent_location_tests'))<>4 then raise exception 'Rule rows missing';end if;
end$$;
select 'PASS: legacy exact/approximate/provider imports, original timestamps, sanitizer, queue/flags, rule rows' result;
do $$begin
 if exists(select 1 from public.local_jobs j where j.company='Alias human' and
 ((select count(*) from public.job_work_locations w where w.job_id=j.id)<>1
 or (select jsonb_array_length(source_points) from public.map_r1_location_jobs where job_id=j.id)<>1
 or not exists(select 1 from public.job_work_locations w where w.job_id=j.id and w.point_kind='exact' and w.lat=21.5))) then
 raise exception 'Address-less provider response duplicated sole target';end if;
end$$;
do $$begin if exists(select 1 from public.test_hook_requests) then raise exception 'Migration scheduled unnecessary provider request';end if;end$$;
select 'PASS: migration imported resolved/unresolved sources without provider requests' result;
