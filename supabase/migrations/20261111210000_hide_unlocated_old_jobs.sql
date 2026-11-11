-- Lee 2026-11-11 지시("비공개요"): 위치를 찾을 수 없는 예전 공고 3건을 비공개(admin_hidden)로 돌린다. 삭제하지 않는다.
--  4828: 원문에 회사 이름 없음(11-07 회사 이름 규칙 전 등록) — Google로 찾을 수 없음
--  5421: Google이 찾은 Thanh Phệ 식당이 원문 공단(KCN Thuận Thành 3) 밖 — 같은 곳이라 확인 못 함
--  5437: DOOKKI 지점 여러 곳 — 한 곳으로 정할 수 없음
-- 지도 위치 절대 원칙(위치를 모르면 핀을 찍지 않고 등록하지 않음)에 맞춘다. 위치를 찾으면 ops-publish-jobs로 다시 공개할 수 있다.
begin;
do $hide$
declare n int;
begin
 update public.local_jobs set admin_hidden = true where id in (4828,5421,5437);
 get diagnostics n = row_count;
 if n <> 3 then raise exception 'expected 3 jobs (4828,5421,5437), updated %', n; end if;
end
$hide$;
commit;
