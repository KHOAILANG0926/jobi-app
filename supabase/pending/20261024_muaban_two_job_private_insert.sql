-- PENDING ONLY: run after R1 trigger fix approval/application.
-- Two bounded private app records; source_text is actual Muaban page excerpt
-- from private research_artifacts, stripped of signed-in header/footer.
-- Never publish automatically; no coordinates inferred.
WITH candidates AS (
  SELECT id,payload,
         split_part(split_part(payload->>'source_text','Thông tin chi tiết',2),'Lưu tin',1) AS source_excerpt
  FROM public.research_artifacts
  WHERE id IN (126,127) AND kind='job_collection_review'
),
validated AS (
  SELECT *,
    (payload->'contact'->>'phone' ~ '^0[35789][0-9]{8}$'
     AND payload->'verification'->>'phone_complete'='true'
     AND length(source_excerpt)>100
     AND position(payload->>'company' IN source_excerpt)>0) AS eligible
  FROM candidates
)
INSERT INTO public.local_jobs
(title,company,category,location,employer_phone,source,source_url,description,source_text,
 active,admin_hidden,occupation_code,occupation_evidence,origin,salary_min,salary_max,
 salary_currency,salary_period,age_min,age_max,gender_requirement)
SELECT CASE WHEN id=126 THEN payload->>'title' ELSE 'Công nhân sản xuất tại ADTEK' END,
       payload->>'company',
       CASE WHEN id=126 THEN 'retail' ELSE 'factory' END,
       CASE WHEN id=126 THEN '33 Lý Thái Tổ, TP. Bắc Ninh'
            ELSE 'Nhà máy Quế Võ III, Bắc Ninh' END,
       payload->'contact'->>'phone','muaban',payload->>'source_url',
       CASE WHEN id=126 THEN payload->'occupation'->>'evidence'
            ELSE 'Tuyển lao động nam/nữ gia nhập đội ngũ sản xuất.' END,
       source_excerpt,false,true,
       CASE WHEN id=126 THEN '52230' ELSE '93' END,
       CASE WHEN id=126 THEN payload->'occupation'->>'evidence'
            ELSE 'Chúng tôi đang tuyển lao động nam/nữ, độ tuổi 18–45, gia nhập đội ngũ sản xuất năng động, kỷ luật và đoàn kết.' END,
       'crawler',
       CASE WHEN id=126 THEN 8000000 ELSE 9000000 END,
       CASE WHEN id=126 THEN 18000000 ELSE 17000000 END,
       'VND','month',
       CASE WHEN id=126 THEN 22 ELSE 18 END,
       CASE WHEN id=126 THEN 35 ELSE 45 END,
       'Không yêu cầu'
FROM validated v
WHERE eligible
  AND NOT EXISTS (
    SELECT 1 FROM public.local_jobs j
    WHERE j.source_url=v.payload->>'source_url'
  );
-- Verify inserted records are active=false and admin_hidden=true.
-- Do not merge or deploy this SQL without explicit approval.
