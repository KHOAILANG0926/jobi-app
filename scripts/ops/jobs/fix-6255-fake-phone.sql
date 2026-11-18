-- Lee 2026-11-18 #6255: vieclam24h 숨긴 자료의 자리 채움 값 0111111111이 전화번호로 저장·공개됨(실제 연락처 아님). 전화 칸만 비움.
-- 입구는 source_text를 요구한다(입구 기록용) — 정정 기록 글을 넣고, update_fields가 전화 칸뿐이라 공고 원문은 그대로.
-- 입구 ingest_job의 기존 공고 고치기(job_id + update_fields)로만 — 연락처가 없으면 DB 공개 판정(no_application_path)이 비공개로 바꾼다.
select public.ingest_job($ingest${"job_id": 6255, "update_fields": ["employer_phone"], "employer_phone": "", "source_text": "[정정 기록, 원문 아님] Lee 2026-11-18 #6255: 전화 칸 0111111111은 vieclam24h 숨긴 자료의 자리 채움 값 — 비움. 공고 원문(local_jobs.source_text)은 고치지 않음(update_fields=employer_phone).", "channel": "sql_file"}$ingest$::jsonb) as job_id \gset
select id, employer_phone, publish_gate_reason, active, admin_hidden from public.local_jobs where id = :job_id;
