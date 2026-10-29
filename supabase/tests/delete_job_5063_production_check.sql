-- Read-only. 20261029160000 운영 점검: #5063이 공개 목록에 없어야 한다(삭제됐거나, 사용자 기록이 있으면 비공개).
do $check$
begin
 if exists(select 1 from public.local_jobs where id = 5063 and source_url = 'https://www.facebook.com/1466495055615965'
           and active and not admin_hidden) then
  raise exception 'job 5063 is still public';
 end if;
 if exists(select 1 from public.location_integrity_issues()) then raise exception 'canonical location integrity after delete'; end if;
end $check$;
