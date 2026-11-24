-- 지도 정상화 W7 복구 dry-run(Lee 2026-11-24): 복구 migration이 고를 대상을 같은 규칙으로 미리 보여 준다. 읽기 전용(데이터 변경 없음).
-- 실행: ops-run-sql.yml(master, Lee 계정 수동, name=location-w7-restore-preview). run-sql-plan이 처음부터 읽기 전용 트랜잭션을 건다.
-- 복구 규칙(공통, 공고 번호 고정 없음):
--   확정 좌표를 잃은 줄(쓰기 기록에서 줄마다 가장 최근 '확정 → 확정 아님' 1건)이 지금도 확정이 없고,
--   ① 같은 사업장: 운영 판정 location_private.same_site_address(잃기 전 주소, 지금 주소, 그 줄에 저장된 행정구역 — 잃기 전·지금 둘 다)
--   ② 같은 회사: 잃기 전 줄의 회사 열쇠와 지금 공고 회사 이름이 표기만 다름(admin_location_key 같음)
--   ③ 근거: 그 좌표를 확정으로 만든 쓰기 기록의 요청(request_payload)이 좌표를 직접 가진 확정 출처(source_verified·poster_pin·legacy_verified)이고
--      잃기 전 좌표와 같으며 출처·확인 시각·근거 글이 있음 → 이때만 같은 좌표·근거를 지금 주소 줄에 다시 쓴다(쓰기 함수 write_location).
--   관리자 확정·재사용 줄은 확정 기억표 자격(같은 회사+같은 주소 글자)으로만 다시 붙으므로 이 복구에서 다루지 않는다(기존 정책).
-- 그 밖의 확정 없는 공개 공고는 기존 위치 찾기(Google → VietMap → Goong)를 한 번 다시 부른다(map_r1_request_location, 20261112020000과 같은 방식).
-- 주소는 자르지 않고 전체를 보여 준다(Lee: 잘린 결과만으로 다른 사업장이라고 확정하지 않는다).
-- '위치 찾기 다시' 목록은 지금 확정이 없는 공개 공고 전체다 — migration은 복구를 먼저 하고, 그 뒤에도 확정이 없는 공고만 다시 부른다.
set transaction read only;
\pset tuples_only on
\pset format unaligned
with ev as (
  select distinct on (l.work_location_id) l.id, l.job_id, l.work_location_id, l.created_at, l.previous_row as p
    from location_private.write_log l
   where l.previous_row is not null and l.next_row is not null and l.previous_row->>'lat' is not null
     and (l.previous_row->>'point_authority' in ('admin_confirmed', 'auto_reuse') or coalesce((l.previous_row->>'location_verified')::boolean, false))
     and not (l.next_row->>'point_authority' in ('admin_confirmed', 'auto_reuse') or coalesce((l.next_row->>'location_verified')::boolean, false))
   order by l.work_location_id, l.created_at desc, l.id desc),
c as (
  select e.*, w.raw_address as now_addr, j.company, j.active, j.admin_hidden,
         array[w.province, w.district, w.ward, w.resolved_province, e.p->>'province', e.p->>'district', e.p->>'ward', e.p->>'resolved_province']
           || coalesce(w.resolved_wards, '{}'::text[]) as regions,
         (select s.request_payload from location_private.write_log s
           where s.work_location_id = e.work_location_id and s.id < e.id and s.next_row->>'lat' = e.p->>'lat' and s.next_row->>'lng' = e.p->>'lng'
             and coalesce((s.next_row->>'location_verified')::boolean, false)
           order by s.id desc limit 1) as proof
    from ev e join public.job_work_locations w on w.id = e.work_location_id join public.local_jobs j on j.id = e.job_id
   where not (w.lat is not null and (w.location_verified or w.point_authority in ('admin_confirmed', 'auto_reuse')))),
d as (
  select c.*, location_private.same_site_address(c.p->>'raw_address', c.now_addr, c.regions) as same_site,
         (coalesce(c.p->>'point_company_key', '') = '' or public.admin_location_key(c.p->>'point_company_key') = public.admin_location_key(c.company)) as same_company,
         (c.proof->>'authority' in ('source_verified', 'poster_pin', 'legacy_verified') and c.proof->>'lat' = c.p->>'lat' and c.proof->>'lng' = c.p->>'lng'
           and nullif(btrim(c.proof->'evidence'->>'source'), '') is not null and nullif(btrim(c.proof->'evidence'->>'checkedAt'), '') is not null
           and (c.proof->>'authority' <> 'source_verified' or nullif(btrim(c.proof->'evidence'->>'evidence'), '') is not null)) as has_proof
    from c)
select '::notice::[W7 복구 판정] #' || job_id || ' ' || case when active and not coalesce(admin_hidden, false) then '공개' else '비공개' end
       || ' · ' || coalesce(company, '') || ' · 줄 ' || work_location_id || ' · 잃은 때 ' || to_char(created_at, 'YYYY-MM-DD HH24:MI')
       || ' · 판정 ' || case when same_site and same_company and has_proof then '복구(같은 좌표·근거 다시 쓰기)'
                            when p->>'point_authority' in ('admin_confirmed', 'auto_reuse') then '복구 안 함(관리자 확정·재사용 — 기억표 자격으로만)'
                            when not same_site then '복구 안 함(같은 사업장 아님 — 위치 찾기 다시)'
                            when not same_company then '복구 안 함(회사 다름 — 위치 찾기 다시)'
                            else '복구 안 함(확정 근거 기록 없음 — 위치 찾기 다시)' end
       || ' · 잃기 전 [' || coalesce(p->>'raw_address', '') || '] ' || coalesce(p->>'point_authority', '') || ' ' || coalesce(p->>'lat', '') || ',' || coalesce(p->>'lng', '')
       || ' · 지금 [' || coalesce(now_addr, '') || ']'
       || ' · 저장된 행정구역 [' || coalesce(array_to_string(regions, ' / '), '') || ']'
       || ' · 근거 ' || coalesce(proof->>'authority', '없음') || ' / ' || coalesce(proof->'evidence'->>'source', '없음') || ' / ' || coalesce(proof->'evidence'->>'checkedAt', '없음')
       || ' / ' || left(coalesce(proof->'evidence'->>'evidence', ''), 200)
  from d order by job_id, work_location_id;
with conf as (
  select w.job_id, bool_or(w.lat is not null and (w.location_verified or w.point_authority in ('admin_confirmed', 'auto_reuse'))) as any_confirmed
    from public.job_work_locations w group by w.job_id)
select '::notice::[W7 위치 찾기 다시] #' || j.id || ' · ' || coalesce(j.company, '') || ' · 줄 ' || w.id || ' ' || coalesce(w.point_kind, '없음') || '/' || coalesce(w.point_authority, '없음')
       || ' · 출처 ' || coalesce(w.point_evidence->>'source', '없음') || ' · [' || coalesce(w.raw_address, '') || ']'
       || ' · 지도 처리 ' || coalesce(s.state, '없음') || ' 호출 ' || coalesce(s.calls::text, '-') || ' 실패 ' || coalesce(s.failures::text, '-')
       || ' · 마지막 결과 ' || coalesce(s.provider_result->>'kind', '없음') || ' / ' || left(coalesce(s.provider_result->>'source', ''), 60)
       || ' / ' || left(replace(coalesce(s.provider_result->>'evidence', ''), chr(10), ' | '), 200)
  from public.local_jobs j join conf on conf.job_id = j.id and not conf.any_confirmed
  join public.job_work_locations w on w.job_id = j.id
  left join public.map_r1_location_jobs s on s.job_id = j.id
 where j.active and not coalesce(j.admin_hidden, false)
 order by j.id, w.sort_order, w.id;
