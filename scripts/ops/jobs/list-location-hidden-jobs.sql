-- 읽기 전용(Lee 2026-10-28): 수집 입구 02(위치가 공개를 바꾸지 않음)를 적용하면 다시 공개 요청될 공고 목록.
-- 대상 조건은 supabase/pending/ingest-gateway-20261028/02-location-never-hides-dryrun.sql 3)과 같다:
--   위치 못 찾음 목록(map_r1_unlocated)에 있고, 원래 공개였고(prev_active), 지금 비공개이며, 관리자 숨김이 아닌 공고.
-- 다른 차단(직업분류·정책·출처 등)에 걸리면 적용 후에도 비공개로 남는다(참고 칸: publish_gate_reason·policy_decision).
-- 데이터 변경 없음. 결과는 GitHub Actions 주석(::notice::)으로 출력한다.
set transaction read only;
\pset tuples_only on
\pset format unaligned
select '::notice::다시 공개 요청 대상 총 ' || count(*) || '건 (연락처 있음 '
       || count(*) filter (where coalesce(j.employer_phone,'') <> '' or coalesce(j.contact_zalo,'') <> '') || '건)'
  from public.map_r1_unlocated u join public.local_jobs j on j.id = u.job_id
 where u.prev_active and not j.active and not j.admin_hidden;
select '::notice::#' || j.id
       || ' | ' || left(coalesce(j.title,''), 60)
       || ' | ' || left(coalesce(j.company,''), 40)
       || ' | 등록 ' || to_char(j.created_at at time zone 'Asia/Ho_Chi_Minh', 'YYYY-MM-DD')
       || ' | 숨김 ' || to_char(u.since at time zone 'Asia/Ho_Chi_Minh', 'YYYY-MM-DD HH24:MI')
       || ' | 이유 ' || u.reason
       || ' | 연락처 ' || case when coalesce(j.employer_phone,'') <> '' or coalesce(j.contact_zalo,'') <> '' then '있음' else '없음' end
       || coalesce(' | 다른 차단 참고 ' || nullif(j.publish_gate_reason,''), '')
       || coalesce(' | 정책 ' || nullif(j.policy_decision,''), '')
  from public.map_r1_unlocated u join public.local_jobs j on j.id = u.job_id
 where u.prev_active and not j.active and not j.admin_hidden
 order by u.since, j.id
 limit 200;
