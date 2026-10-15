-- 2026-10-15 [2026-10-15 사용자 승인 — 병합 시 occupation-r8-apply.yml 로 적용] 규칙 R8: 공고 직업군 = 공식 직업코드(QĐ 34/2020) + 원문 근거.
--
-- 바뀌는 것 (local_jobs에 칸 2개 추가, 기존 칸·데이터·RLS·기존 규칙 R1~R7은 그대로)
--   occupation_code      공식 코드(occupation_master, 4·5단계). 비어 있으면 '미분류' — 'other' 같은 기본값 없음.
--   occupation_evidence  그 코드를 붙인 근거 글자. 제목·원문·설명 안에 실제로 있어야 한다.
-- R8 트리거
--   - 없는 코드: 외래키가 거부. 1~3단계 코드: 거부(너무 넓음).
--   - 코드가 있는데 근거가 비었거나 원문에 없는 글자: 거부 (job_rule_R8).
--   - 근거만 있고 코드가 없음: 거부.
--   - 코드는 그대로인데 제목·원문 수정으로 근거가 사라짐: 수정은 허용하고 직업군만 비운다(미분류로 되돌림).
-- 화면 영향: 없음. 공개/비공개(active·admin_hidden)를 바꾸지 않는다. 기존 공고는 전부 미분류로 시작.
-- 공개 읽기: 두 칸은 anon·authenticated가 읽을 수 있게 열 권한을 준다(20261014100000 열 권한 방식).
-- 롤백: 20261015120000_local_jobs_occupation_r8_rollback.sql
-- 승인 전에는 아무것도 적용하지 않는다. 적용 후 supabase/migrations/ 로 옮기고 기록한다.

begin;

alter table public.local_jobs add column if not exists occupation_code text references public.occupation_master(code);
alter table public.local_jobs add column if not exists occupation_evidence text;
create index if not exists local_jobs_occupation_code_idx on public.local_jobs (occupation_code);

comment on column public.local_jobs.occupation_code is '공식 직업코드(QĐ 34/2020, occupation_master 4·5단계). null = 미분류. 규칙 R8.';
comment on column public.local_jobs.occupation_evidence is 'occupation_code 근거: 제목·원문·설명에 실제로 있는 글자 그대로. 규칙 R8.';

create or replace function public.local_jobs_occupation_r8()
returns trigger
language plpgsql
set search_path = public
as $$
declare
  haystack text;
  code_level smallint;
begin
  if new.occupation_code is null then
    if nullif(trim(coalesce(new.occupation_evidence, '')), '') is not null then
      raise exception 'job_rule_R8: 직업코드 없이 근거만 저장할 수 없음' using errcode = 'check_violation';
    end if;
    new.occupation_evidence := null;
    return new;
  end if;

  select level into code_level from public.occupation_master where code = new.occupation_code;
  if code_level is not null and code_level < 4 then
    raise exception 'job_rule_R8: 직업코드는 4·5단계만 허용 (받은 값 %, %단계)', new.occupation_code, code_level
      using errcode = 'check_violation';
  end if;

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

drop trigger if exists trg_zzz_local_jobs_occupation_r8 on public.local_jobs;
create trigger trg_zzz_local_jobs_occupation_r8   -- 이름 순서로 실행: 기존 trg_enforce_job_posting_policy·trg_zz_enforce_job_posting_rules 다음(정리된 글로 검사)
  before insert or update of occupation_code, occupation_evidence, title, source_text, description
  on public.local_jobs
  for each row execute function public.local_jobs_occupation_r8();

grant select (occupation_code, occupation_evidence) on public.local_jobs to anon, authenticated;

commit;
