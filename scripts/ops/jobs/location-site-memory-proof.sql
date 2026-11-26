-- 읽기 전용(Lee 2026-11-26 #1086 운영 실증): 우리 사업장 위치 기억(public.location_site_memory)이 실제로 쓰인 위치 줄을 센다.
-- 기억을 쓰면 위치 줄의 근거 문구에 "cùng công ty, cùng địa điểm"(같은 회사·같은 장소)이 남는다(autoLocationResolver ⓪).
-- ① 그런 줄 개수 ② 최근 줄마다 같은 회사·같은 사업장 확정 줄(다른 공고)의 좌표와 같은지·다른 좌표가 섞이지 않았는지.
-- 데이터 변경 없음. 결과는 GitHub Actions 주석(::notice::)으로만 출력한다. 공고 번호·회사 이름을 고정하지 않는다.
set transaction read only;
\pset tuples_only on
\pset format unaligned
select '::notice::기억 재사용 위치 줄 ' || count(*) || '개, 공고 ' || count(distinct w.job_id) || '개, 가장 최근 ' || coalesce(to_char(max(w.updated_at) at time zone 'Asia/Ho_Chi_Minh', 'YYYY-MM-DD HH24:MI'), '없음') || ' (베트남 시각)'
  from public.job_work_locations w
  where w.point_evidence::text like '%cùng công ty, cùng địa điểm%';
with r as (
  select w.id, w.job_id, w.lat, w.lng, w.raw_address, j.company
  from public.job_work_locations w join public.local_jobs j on j.id = w.job_id
  where w.point_evidence::text like '%cùng công ty, cùng địa điểm%'
  order by w.updated_at desc nulls last, w.id desc limit 30)
select '::notice::위치 줄 ' || r.id || '(공고 ' || r.job_id || ') 같은 사업장 확정 줄 중 같은 좌표 '
  || (select count(*) from public.location_site_memory(r.company, r.raw_address) m where m.job_id <> r.job_id and abs(m.lat - r.lat) < 0.000001 and abs(m.lng - r.lng) < 0.000001)
  || '곳, 다른 좌표 '
  || (select count(*) from public.location_site_memory(r.company, r.raw_address) m where m.job_id <> r.job_id and (abs(m.lat - r.lat) >= 0.000001 or abs(m.lng - r.lng) >= 0.000001))
  || '곳'
  from r order by r.id desc;
