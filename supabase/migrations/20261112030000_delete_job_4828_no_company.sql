begin;
-- Lee 2026-11-12 "4828만 회사 이름이 없다며, 그것만 일단 삭제를 하면 되고"(비공개가 아니라 삭제).
-- 대상: #4828(10-08 등록, 원문에 회사 이름 없음 — 11-07 회사 이름 규칙·11-06 위치 확인 규칙 전에 들어와 지금 기준이면 받지 않는 공고).
-- 기존 삭제 함수(map_r1_delete_no_info, #5063과 같은 방식)를 그대로 쓴다: 지원·메시지·면접 기록이 있으면 지우지 않고 비공개+목록,
-- 없으면 삭제 + map_r1_deleted_log 기록. 회사 칸이 비어 있고 제목이 맞을 때만 실행, 다르면 전체 취소. 이미 없으면 아무것도 안 함.
do $del$
declare j jsonb; result text;
begin
 select to_jsonb(l) into j from public.local_jobs l where l.id = 4828;
 if j is null then raise notice 'job 4828 not present; nothing to delete'; return; end if;
 if nullif(btrim(coalesce(j->>'company', '')), '') is not null or coalesce(j->>'title', '') not like 'Tuyển công nhân sản xuất dây truyền dữ liệu%' then
  raise exception 'job 4828 identity mismatch (company/title differ); refusing to delete';
 end if;
 result := public.map_r1_delete_no_info(4828);
 raise notice 'job 4828: %', result;
 if result not in ('deleted', 'kept_hidden') then raise exception 'unexpected delete result: %', result; end if;
end $del$;
commit;
