-- 2순위(Lee 2026-11-24): 기존 운영 DB 다중 지점 공고 전환 — dry-run 집계(읽기 전용, 데이터 변경 없음).
-- 실행: ops-run-sql.yml(master, Lee 계정 수동, name=multi-branch-conversion-preview). run-sql-plan이 처음부터 읽기 전용 트랜잭션을 건다.
-- 규정: CLAUDE.md 「지점별 독립 공고」(공고 단위 = 원문 글 1 + 물리적 지점 1, 지점 식별자 = admin_location_key(원문 주소)).
-- 전환 계획(이 집계가 보여 주는 것): 지점이 2곳 이상인 공고는 첫 지점(sort_order, id 순 1번째)을 기존 공고 번호에 남기고,
--   나머지 지점마다 같은 원문의 독립 공고를 새로 만든다. 같은 원문(source_url)·같은 지점의 공고가 이미 있으면 새로 만들지 않고 그 공고를 쓴다(중복 전환 방지).
-- 결과는 GitHub Actions 주석(::notice::)으로만 출력한다.
set transaction read only;
\pset tuples_only on
\pset format unaligned
select '::notice::[전환 미리 보기] 전체 공고 ' || (select count(*) from public.local_jobs)
       || '건 · 근무지 줄 ' || (select count(*) from public.job_work_locations) || '줄';
with b as (
  select w.id, w.job_id, w.sort_order, coalesce(nullif(w.normalized_address, ''), public.admin_location_key(w.raw_address)) as k
    from public.job_work_locations w),
t as (select job_id from b group by job_id having count(distinct k) > 1),
r as (select b.*, row_number() over (partition by b.job_id order by b.sort_order, b.id) as rn from b join t using (job_id))
select '::notice::[전환 대상] 지점 2곳 이상 공고 ' || (select count(*) from t) || '건'
       || ' (공개 ' || (select count(*) from t join public.local_jobs j on j.id = t.job_id where j.active and not coalesce(j.admin_hidden, false)) || '건)'
       || ' · 대상 근무지 줄 ' || (select count(*) from r) || '줄'
       || ' · 기존 번호에 남는 첫 지점 ' || (select count(*) from r where rn = 1)
       || ' · 새 독립 공고로 옮길 지점 ' || (select count(*) from r where rn > 1);
with b as (
  select w.*, coalesce(nullif(w.normalized_address, ''), public.admin_location_key(w.raw_address)) as k
    from public.job_work_locations w),
t as (select job_id from b group by job_id having count(distinct k) > 1),
r as (select b.*, row_number() over (partition by b.job_id order by b.sort_order, b.id) = 1 as keep from b join t using (job_id))
select '::notice::[지점별 위치 근거] ' || case when keep then '남는 첫 지점' else '옮길 지점' end
       || ' · ' || coalesce(point_kind, '없음') || '/' || coalesce(point_authority, '없음') || ' ' || count(*) || '줄'
  from r group by keep, point_kind, point_authority order by keep desc, point_kind, point_authority;
with b as (
  select w.*, coalesce(nullif(w.normalized_address, ''), public.admin_location_key(w.raw_address)) as k
    from public.job_work_locations w),
t as (select job_id from b group by job_id having count(distinct k) > 1),
r as (select b.*, row_number() over (partition by b.job_id order by b.sort_order, b.id) as rn from b join t using (job_id))
select '::notice::#' || j.id || ' ' || case when j.active and not coalesce(j.admin_hidden, false) then '공개' else '비공개' end
       || ' · ' || left(coalesce(j.company, ''), 40) || ' · ' || left(coalesce(j.title, ''), 50)
       || ' · 출처 ' || coalesce(split_part(j.source, ':', 1), '없음')
       || ' · 지점 ' || r.rn || ' ' || case when r.rn = 1 then '(기존 번호 유지)' else '(새 독립 공고)' end
       || ' · 근무지 줄 ' || r.id || ' · ' || coalesce(r.point_kind, '없음') || '/' || coalesce(r.point_authority, '없음')
       || ' · ' || left(r.raw_address, 70)
       || coalesce(' · 이미 있는 같은 지점 공고 #' || (
            select min(j2.id)::text from public.local_jobs j2 join public.job_work_locations w2 on w2.job_id = j2.id
             where j.source_url is not null and j2.source_url = j.source_url and j2.id <> j.id
               and coalesce(nullif(w2.normalized_address, ''), public.admin_location_key(w2.raw_address)) = r.k), '')
  from r join public.local_jobs j on j.id = r.job_id order by j.id, r.rn;
with b as (
  select w.job_id, coalesce(nullif(w.normalized_address, ''), public.admin_location_key(w.raw_address)) as k
    from public.job_work_locations w),
t as (select job_id from b group by job_id having count(distinct k) > 1)
select '::notice::[대상 공고에 걸린 기록] 지원 ' || (select count(*) from public.applications a join t using (job_id))
       || ' · 대화 ' || (select count(*) from public.message_threads m join t using (job_id))
       || ' · 면접 ' || (select count(*) from public.interviews i join t using (job_id))
       || ' · 위치 후보 ' || (select count(*) from public.job_location_candidates c join t using (job_id))
       || ' (승인 ' || (select count(*) from public.job_location_candidates c join t using (job_id) where c.status = 'approved') || ')';
