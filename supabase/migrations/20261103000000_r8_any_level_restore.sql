-- 2026-11-03 Lee "진행해": 10-18 규칙(직업코드 1~5단계 모두 허용)을 다시 적용한다.
-- 원인: 2026-11-02 13:35 occupation-r8-apply 수동 실행이 "R8 적용" 단계에서 10-15 파일(20261015120000)을 다시 실행해
--       local_jobs_occupation_r8()을 옛 정의("4·5단계만 허용")로 덮어씀 → #5247(코드 5, 1단계) 보충이 13:53·15:27 실패.
-- 바뀌는 것: 함수 local_jobs_occupation_r8() 정의를 20261018090000과 같은 본문으로, 칸 설명(comment)을 1~5단계로. 트리거·데이터·권한 변경 없음.
-- 재발 방지: occupation-r8-apply.yml이 옛 migration을 다시 실행하지 않게 같은 PR에서 고침.
begin;

create or replace function public.local_jobs_occupation_r8()
returns trigger
language plpgsql
set search_path = public
as $$
declare
  haystack text;
begin
  if new.occupation_code is null then
    if nullif(trim(coalesce(new.occupation_evidence, '')), '') is not null then
      raise exception 'job_rule_R8: 직업코드 없이 근거만 저장할 수 없음' using errcode = 'check_violation';
    end if;
    new.occupation_evidence := null;
    return new;
  end if;

  -- 단계 제한 없음(2026-10-18): 근거로 확인 가능한 단계까지만 코드를 붙인다. 없는 코드는 외래키가 거부.

  haystack := lower(normalize(coalesce(new.title, '') || E'\n' || coalesce(new.source_text, '') || E'\n' || coalesce(new.description, ''), NFC));
  if nullif(trim(coalesce(new.occupation_evidence, '')), '') is not null
     and position(lower(normalize(new.occupation_evidence, NFC)) in haystack) > 0 then
    return new;
  end if;

  -- 직업군 칸은 그대로인데 글 수정으로 근거가 사라진 경우: 수정은 막지 않고 미분류로 되돌린다.
  if tg_op = 'UPDATE'
     and new.occupation_code is not distinct from old.occupation_code
     and new.occupation_evidence is not distinct from old.occupation_evidence then
    new.occupation_code := null;
    new.occupation_evidence := null;
    return new;
  end if;

  raise exception 'job_rule_R8: 근거 글자가 공고 제목·원문·설명에 없음 (코드 %)', new.occupation_code
    using errcode = 'check_violation';
end;
$$;

comment on column public.local_jobs.occupation_code is '공식 직업코드(QĐ 34/2020, occupation_master 1~5단계 — 원문 근거로 확인 가능한 단계까지). null = 미분류(비공개). 규칙 R8.';

commit;
