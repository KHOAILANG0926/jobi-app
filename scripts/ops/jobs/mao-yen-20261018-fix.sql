-- 2026-10-18: #4828을 표준 등록 경로(ops-insert-job.yml)로 바로잡는다.
-- 어제 등록은 포스터를 GitHub 주소에 두어 화면 이미지 허용 목록(우리 Storage만)에 걸려 대체 그림이 나왔고,
-- 근무지 기록(job_work_locations)이 빠져 기준 공고(CTY KDA)와 상세 위치 부분이 달랐다.
-- 공개 판단은 기존 트리거(R7 OCR·직업분류·정책)가 한다: 이미지가 바뀌므로 OCR 재대조 전까지 자동 비공개 → 통과 시 자동 재공개.
-- 원문에 없는 회사명·좌표는 채우지 않는다.
update public.local_jobs
   set images = '["mao-yen/mao-yen-20261017.png"]'::jsonb,
       image_url = 'https://edhuesdnuxlbcfephutq.supabase.co/storage/v1/object/public/job-images/mao-yen/mao-yen-20261017.png'
 where id = 4828;

insert into public.job_work_locations (job_id, raw_address, province, address_evidence)
select 4828, 'Khu phố Mao Yên, phường Phương Liễu, Bắc Ninh', 'Bắc Ninh',
       'Poster ghi "Khu phố Mao Yên, phường Phương Liễu, Bắc Ninh", không có số nhà.'
where not exists (select 1 from public.job_work_locations where job_id = 4828);
