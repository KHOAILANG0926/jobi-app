-- 2026-10-18 사용자 지시: 직업분류 공개 조건 과잉 수정.
-- 바뀌는 것: 공식 직업코드는 "원문 근거로 확인 가능한 단계까지"만 붙인다. 1~5단계 모두 허용.
--   - 공개 게이트(job_occupation_publish_reason): 4·5단계 제한 제거. occupation_master에 있는 코드면 단계 무관.
--   - R8(local_jobs_occupation_r8): 1~3단계 코드 거부 제거. 나머지(없는 코드, 근거 누락, 원문에 없는 근거) 그대로.
-- 그대로 유지: 코드 없음(미분류)·원문 근거 누락·근거가 원문에 없음 → 비공개. 금지 직종(R4)·OCR(R7) 트리거는 건드리지 않음.
-- 데이터 변경 없음(공고 공개/비공개를 이 파일에서 바꾸지 않음). 화면·RLS·권한 변경 없음.
-- 시험: supabase/tests/occupation_publication.pglite.test.mjs (실제 공고 #4824·#4827·#4828 사례)
begin;

create or replace function public.job_occupation_publish_reason(p_code text, p_evidence text, p_source text)
returns text language sql stable set search_path = pg_catalog, public as $$
 select case
  when nullif(btrim(p_code),'') is null then 'occupation_unclassified'
  when not exists(select 1 from public.occupation_master where code=p_code) then 'occupation_invalid_code'
  when nullif(btrim(p_evidence),'') is null then 'occupation_missing_evidence'
  when nullif(btrim(p_source),'') is null then 'occupation_missing_source'
  when position(lower(normalize(btrim(p_evidence), NFC)) in lower(normalize(p_source, NFC)))=0 then 'occupation_evidence_not_in_source'
  else 'ok' end;
$$;

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

update public.job_posting_rules
   set content = '공개 전 실제 업무를 공식 직업분류와 대조한다. 원문 근거로 확인 가능한 단계까지 공식 코드(1~5단계)를 붙이고, 세부 코드 미확정만으로 비공개하지 않는다. 코드 없음(업무 불명확)·원문 근거 누락·근거가 원문에 없음이면 관리자·수집·OCR 모두 비공개 보류. 미기재 업무(조립/기계 운전 등)를 추정해 세부 코드를 채우지 않는다. OCR 성공은 업무 확인이 아님.',
       decided_on = date '2026-10-18'
 where rule_key = 'R8_publication_requires_original_evidence';

commit;
