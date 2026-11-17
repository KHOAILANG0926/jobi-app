-- 운영 점검(읽기 전용): 10-14 뒤 추가된 비공개 칸이 anon·authenticated에 열려 있지 않고, 공개로 준 칸은 그대로 읽히는지.
do $check$
declare c text; r text; bad text := '';
begin
  foreach r in array array['anon','authenticated'] loop
    foreach c in array array['updated_at','company_id','company_branch_id','duplicate_status','duplicate_of','duplicate_reason','logo_lookup','agency_workplace_key'] loop
      if has_column_privilege(r, 'public.local_jobs', c, 'select') then bad := bad || r || '.' || c || ' 읽힘; '; end if;
    end loop;
    foreach c in array array['id','title','occupation_code','company_domain','description_html','employment_type_extra'] loop
      if not has_column_privilege(r, 'public.local_jobs', c, 'select') then bad := bad || r || '.' || c || ' 막힘(공개 칸); '; end if;
    end loop;
  end loop;
  if bad <> '' then raise exception 'local_jobs 칸 권한 이상: %', bad; end if;
  raise notice 'local_jobs_reprivate_columns production check passed';
end $check$;
