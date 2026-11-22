-- Lee 2026-11-22: 비공개 7건(5342·5368·5421·5437·5873·5938·5595) 원인 확인용 조회만(쓰기 없음, ops-run-sql 읽기 전용). 결과로 원인을 정한 뒤 고친다.
-- 실행 기록이 공개 저장소에 남으므로 전체 글 대신 확인할 줄만 뽑는다.
select id, active, admin_hidden, dormitory, occupation_code, occupation_evidence, category, location, company from public.local_jobs where id in (5342, 5368, 5421, 5437, 5873, 5938, 5595) order by id;
select j.id, 'source_text' as part, l as line from public.local_jobs j, regexp_split_to_table(j.source_text, chr(10)) l where j.id in (5342, 5368, 5421, 5437, 5873) and l ~* 'JOY TH|HỒ SƠ NHẬN|đi đâu xa|bao ăn|kinh doanh|LIÊN HỆ ỨNG TUYỂN' order by j.id;
select j.id, 'description' as part, l as line from public.local_jobs j, regexp_split_to_table(j.description, chr(10)) l where j.id in (5342, 5368, 5421, 5437, 5873) and l ~* 'JOY TH|HỒ SƠ NHẬN|đi đâu xa|bao ăn|kinh doanh|LIÊN HỆ ỨNG TUYỂN' order by j.id;
select id, ocr_check - 'ocr_text' as ocr_check from public.local_jobs where id in (5342, 5368, 5421, 5437, 5873, 5938, 5595) order by id;
select * from public.job_work_locations where job_id in (5938, 5595) order by job_id, id;
