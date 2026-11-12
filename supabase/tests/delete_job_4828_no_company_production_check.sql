-- Read-only. 20261112030000 운영 점검: #4828(회사 이름 없음)이 공개 목록에 없어야 한다(삭제됐거나, 사용자 기록이 있으면 비공개).
do $check$
begin
 if exists(select 1 from public.local_jobs where id = 4828 and nullif(btrim(coalesce(company, '')), '') is null
           and title like 'Tuyển công nhân sản xuất dây truyền dữ liệu%' and active and not admin_hidden) then
  raise exception 'job 4828 is still public';
 end if;
 if exists(select 1 from public.location_integrity_issues()) then raise exception 'canonical location integrity after delete'; end if;
end $check$;
