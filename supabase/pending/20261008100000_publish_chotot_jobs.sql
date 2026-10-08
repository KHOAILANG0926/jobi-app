-- chotot 공고 공개 전환 (admin_hidden=false). 사용자가 Supabase SQL Editor에서 직접 실행한다.
-- DDL 없음, 삭제 없음. 되돌리기: 아래 "되돌리기" 참고.
--
-- 순서: (1) docs/ops/2026-10-08_chotot_publish_dryrun.sql 실행 → publish_targets 값 확인
--       (2) 아래 v_expected 를 그 값으로 바꾼다 (null 이면 중단)
--       (3) 이 파일 전체 실행 → 건수가 다르면 예외로 중단되고 아무것도 바뀌지 않는다
--       (4) 맨 끝 확인 쿼리 결과 확인 후 docs/ops/2026-10-08_chotot_publish_dryrun.md 의 URL 3개 확인
--
-- 공개 대상 기준(dry-run과 동일): chotot ID 4685~4784 · 지금 비공개 · active · 회사명 2자 이상
--   · 연락처 숫자 8자리 이상 · 마감일 없음 또는 오늘(베트남 시간) 이후. 위치는 핀 없이 공개
--   (승인 좌표 Chỉ đường / KCN 영역 지도 / Gọi hỏi đường 3단계 규칙은 화면이 처리).
--
-- 되돌리기: update public.local_jobs set admin_hidden = true where source like 'chotot:%' and id between 4685 and 4784;

begin;

do $publish$
declare
  v_expected int := null;  -- ★ dry-run 의 publish_targets 값으로 바꿀 것
  v_total int;
  v_targets int;
  v_updated int;
begin
  create temp table _chotot_publish_targets on commit drop as
  select j.id
  from public.local_jobs j
  where j.source like 'chotot:%'
    and j.id between 4685 and 4784
    and j.admin_hidden
    and j.active
    and length(btrim(coalesce(j.company, ''))) >= 2
    and length(regexp_replace(coalesce(j.employer_phone, ''), '\D', '', 'g')) >= 8
    and (j.application_deadline is null
         or j.application_deadline > (now() at time zone 'Asia/Ho_Chi_Minh')::date);

  select count(*) into v_total from public.local_jobs where source like 'chotot:%' and id between 4685 and 4784;
  if v_total <> 100 then
    raise exception 'chotot 행이 100건이 아님(%): 중단', v_total;
  end if;

  select count(*) into v_targets from _chotot_publish_targets;
  if v_expected is null then
    raise exception 'v_expected 가 비어 있음. dry-run 의 publish_targets(현재 계산 %) 로 설정 후 다시 실행', v_targets;
  end if;
  if v_targets <> v_expected then
    raise exception '공개 대상 건수 불일치: 기대 %, 실제 %. 중단(변경 없음)', v_expected, v_targets;
  end if;

  update public.local_jobs set admin_hidden = false
  where id in (select id from _chotot_publish_targets) and admin_hidden;
  get diagnostics v_updated = row_count;
  if v_updated <> v_expected then
    raise exception '갱신 건수 불일치: 기대 %, 실제 %. 롤백', v_expected, v_updated;
  end if;
end
$publish$;

commit;

-- 공개 건수 확인 (읽기 전용)
select
  count(*) filter (where active and not admin_hidden) as chotot_public,
  count(*) filter (where admin_hidden)                as chotot_still_hidden,
  count(*)                                            as chotot_total,
  (select count(*) from public.local_jobs where active and not admin_hidden) as all_public_jobs
from public.local_jobs
where source like 'chotot:%' and id between 4685 and 4784;
