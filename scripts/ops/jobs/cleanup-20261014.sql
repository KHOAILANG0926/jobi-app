-- 사용자 지시(2026-10-14 00:00): KDA(#4824) 외 나머지 공고 삭제, KDA 카드에 포스터 표시.
delete from public.local_jobs where id in (4819,4820,4821,4822,4823) and origin = 'crawler' returning id;
update public.local_jobs
set image_url = 'https://edhuesdnuxlbcfephutq.supabase.co/storage/v1/object/public/job-images/kda/kda-20261013.png'
where id = 4824 and company = 'CTY KDA'
returning id, active, admin_hidden, image_url;
select count(*) as public_jobs from public.local_jobs where active and not admin_hidden;
