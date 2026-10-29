begin;
-- Lee 2026-10-29 21:59 "정보 별로 없는 맨 첫 번째 공고는 일단 지워, 삭제를 해".
-- 대상: #5063 Facebook 옷가게 공고(원문에 지역·상호·업무 설명 없음). 기존 삭제 함수(map_r1_delete_no_info)를 그대로 쓴다:
-- 지원·메시지·면접 기록이 있으면 지우지 않고 비공개 + 목록(사용자 데이터 보호), 없으면 삭제 + map_r1_deleted_log 기록.
-- 수집 원문(job_ingest_raw)은 job_id만 비워지고 남는다(FK on delete set null).
-- 번호·회사·원문 주소가 모두 맞을 때만 실행. 다르면 전체 취소. 이미 없으면(시험 DB 등) 아무것도 안 함.
do $del$
declare j record; result text;
begin
 select id, company, source_url into j from public.local_jobs where id = 5063;
 if not found then raise notice 'job 5063 not present; nothing to delete'; return; end if;
 if j.company is distinct from 'Sỉ Lẻ Thời Trang Nam Nữ' or j.source_url is distinct from 'https://www.facebook.com/1466495055615965' then
  raise exception 'job 5063 identity mismatch (company/source differ); refusing to delete';
 end if;
 result := public.map_r1_delete_no_info(5063);
 raise notice 'job 5063: %', result;
 if result not in ('deleted', 'kept_hidden') then raise exception 'unexpected delete result: %', result; end if;
end $del$;
commit;
