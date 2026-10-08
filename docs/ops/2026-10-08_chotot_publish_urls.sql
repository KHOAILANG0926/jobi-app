-- 공개 후 확인할 URL 3개를 고른다 (읽기 전용). 공개 전·후 어느 때나 실행 가능. 형식: https://viecganban.vn/viec-lam/sb-<id>
-- 1) KCN 영역 지도 1건(승인 핀 없음 + 근무지에 KCN 글자) 2) 일반 1건(핀·KCN 없음, 직접 모집 → Gọi hỏi đường만) 3) 대행사 1건
-- 4) 승인 핀 1건(있으면 Chỉ đường 확인용, 추가 참고)
with base as (
  select j.id, j.company, j.recruitment_type,
    exists (select 1 from public.job_location_candidates c where c.job_id = j.id and c.status = 'approved') as approved_pin,
    exists (select 1 from public.job_work_locations w where w.job_id = j.id and w.industrial_park is not null) as kcn_text
  from public.local_jobs j
  where j.source like 'chotot:%' and j.id between 4685 and 4784 and j.active
    and length(btrim(coalesce(j.company, ''))) >= 2
    and length(regexp_replace(coalesce(j.employer_phone, ''), '\D', '', 'g')) >= 8
    and (j.application_deadline is null or j.application_deadline > (now() at time zone 'Asia/Ho_Chi_Minh')::date)
)
select * from (
  select 1 as n, 'KCN 영역 지도' as kind, 'https://viecganban.vn/viec-lam/sb-' || min(id) as url, company from base
    where kcn_text and not approved_pin group by company order by min(id) limit 1) a
union all select * from (
  select 2, '일반(Gọi hỏi đường만)', 'https://viecganban.vn/viec-lam/sb-' || min(id), company from base
    where not kcn_text and not approved_pin and recruitment_type is distinct from 'agency' group by company order by min(id) limit 1) b
union all select * from (
  select 3, '대행사', 'https://viecganban.vn/viec-lam/sb-' || min(id), company from base
    where recruitment_type = 'agency' group by company order by min(id) limit 1) c
union all select * from (
  select 4, '승인 핀(Chỉ đường)', 'https://viecganban.vn/viec-lam/sb-' || min(id), company from base
    where approved_pin group by company order by min(id) limit 1) d
order by 1;
