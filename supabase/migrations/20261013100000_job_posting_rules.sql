-- 채용공고 규칙 표 + 자동 차단 장치 (2026-10-13 사용자 결정)
-- 목적: AI가 지시를 잊거나 어겨도 DB가 막는다. 적용은 PR 병합 시 GitHub Actions(job-rules-apply.yml)가 한다.
-- 멱등: 여러 번 실행해도 같은 결과(if not exists / create or replace / on conflict).

-- ── 1. 규칙 표 ─────────────────────────────────────────────
create table if not exists public.job_posting_rules (
  id bigint generated always as identity primary key,
  rule_key text not null unique,
  content text not null,                       -- 내용(한국어)
  decided_on date not null,                    -- 결정일
  incidents text,                              -- 발생사례
  machine_checkable text not null check (machine_checkable in ('가능','불가능')),
  block_mode text not null check (block_mode in ('저장거부','보류','없음')),
  implementation text,                         -- 구현위치(함수·트리거 이름)
  last_tested_at timestamptz,                  -- 마지막시험일 (자동 시험만 채움)
  last_test_result text check (last_test_result in ('통과','실패'))
);
comment on table public.job_posting_rules is '채용공고 규칙 표. 쓰기는 마이그레이션(테이블 소유자)으로만. 앱·AI(service_role 포함) 쓰기 금지. last_test_*는 supabase/tests/job_posting_rules_test.sql만 채운다.';

alter table public.job_posting_rules enable row level security;
revoke all on public.job_posting_rules from public, anon, authenticated, service_role;
grant select on public.job_posting_rules to service_role;   -- STATUS 생성기가 읽기만 한다

-- ── 2. 공고 표 칸 추가 ─────────────────────────────────────
alter table public.local_jobs
  add column if not exists source_text text,
  add column if not exists ocr_text text,
  add column if not exists ocr_check jsonb,
  add column if not exists contact_name text,
  add column if not exists age_min smallint,
  add column if not exists age_max smallint;
do $$ begin
  if not exists (select 1 from pg_constraint where conname = 'local_jobs_age_range_check') then
    alter table public.local_jobs add constraint local_jobs_age_range_check
      check ((age_min is null or age_min between 0 and 100) and (age_max is null or age_max between 0 and 100));
  end if;
end $$;
comment on column public.local_jobs.source_text is '원문 글자 그대로(포스터·게시글을 옮겨 적은 것). 규칙 R3·R5·R6의 근거.';
comment on column public.local_jobs.ocr_text is 'OCR(Tesseract vie)이 이미지에서 읽은 글자. 기계(DB 소유자 계정, Actions)만 쓴다. 트리거가 그 외 쓰기를 거부(규칙 R7).';
comment on column public.local_jobs.ocr_check is 'R7 옮겨 적기 대조 결과 {status, checked_at, images_hash, mismatches[]}. 기계만 쓴다.';
comment on column public.local_jobs.contact_name is '연락처 이름. 원문 표기 그대로(규칙 R5).';
comment on column public.local_jobs.age_min is '원문에 적힌 최소 연령(규칙 R6).';
comment on column public.local_jobs.age_max is '원문에 적힌 최대 연령(규칙 R6).';

-- ── 3. 함수 ────────────────────────────────────────────────
-- R1: 숫자만 남긴다. 번호 비교도 이 함수로만 한다.
create or replace function public.job_phone_digits(x text) returns text
language sql immutable set search_path = pg_catalog, public as $f$
  select nullif(regexp_replace(coalesce(x,''), '[^0-9]', '', 'g'), '')
$f$;
create or replace function public.job_phones_equal(a text, b text) returns boolean
language sql immutable set search_path = pg_catalog, public as $f$
  select public.job_phone_digits(a) is not distinct from public.job_phone_digits(b)
     and public.job_phone_digits(a) is not null
$f$;

-- R5: 대소문자만 무시, 성조 표시는 구별. 유니코드 합성 방식(NFC/NFD)·공백 길이 차이는 같은 글자로 본다.
create or replace function public.job_text_norm(x text) returns text
language sql immutable set search_path = pg_catalog, public as $f$
  select lower(regexp_replace(normalize(coalesce(x,''), NFC), '\s+', ' ', 'g'))
$f$;
create or replace function public.job_source_contains(src text, val text) returns boolean
language sql immutable set search_path = pg_catalog, public as $f$
  select position(public.job_text_norm(trim(val)) in public.job_text_norm(src)) > 0
$f$;

-- R6: 원문에 "14-50t", "18-35 tuổi", "tuổi: 18-35" 같은 연령 범위가 있는가.
create or replace function public.job_source_has_age_range(src text) returns boolean
language sql immutable set search_path = pg_catalog, public as $f$
  select public.job_text_norm(src) ~ '(^|[^0-9])[0-9]{2}\s*[-–~]\s*[0-9]{2}\s*(t|tuổi|tuoi)(?![[:alpha:]])'
      or public.job_text_norm(src) ~ '(tuổi|tuoi)\s*:?\s*(từ\s*)?[0-9]{2}\s*[-–~]\s*[0-9]{2}'
$f$;

-- ── 4. 트리거 ──────────────────────────────────────────────
-- 이름이 trg_enforce_job_posting_policy(2026-10-12 정책 트리거)보다 알파벳 뒤라서 항상 마지막에 실행된다.
create or replace function public.enforce_job_posting_rules() returns trigger
language plpgsql set search_path = pg_catalog, public as $f$
declare
  src_changed boolean;
  n_img int;
begin
  -- R7 보호: ocr_text / ocr_check는 기계(DB 소유자 계정)만 쓴다. AI·앱(service_role 포함)은 거부.
  if current_user not in ('postgres','supabase_admin') and (
       (TG_OP = 'INSERT' and (NEW.ocr_text is not null or NEW.ocr_check is not null))
    or (TG_OP = 'UPDATE' and (NEW.ocr_text is distinct from OLD.ocr_text or NEW.ocr_check is distinct from OLD.ocr_check))) then
    raise exception 'job_rule_R7: ocr_text/ocr_check는 기계만 쓸 수 있음' using errcode = 'insufficient_privilege';
  end if;

  -- R1 전화번호: 항상 숫자만
  NEW.employer_phone := public.job_phone_digits(NEW.employer_phone);
  NEW.contact_zalo   := public.job_phone_digits(NEW.contact_zalo);

  -- R2 판정 칸은 코드만: 입력값을 버리고 항상 함수로 다시 계산
  NEW.policy_decision := public.job_policy_decision(NEW.title, NEW.company, NEW.description, NEW.category, NEW.salary);

  if NEW.origin in ('crawler','admin') then
    -- 기존 행의 다른 칸(만료 처리 등) 수정은 막지 않는다: 근거 칸이 바뀌었거나 새 행이거나 새로 공개될 때만 검사.
    if TG_OP = 'INSERT' then src_changed := true;
    else
      src_changed := NEW.origin is distinct from OLD.origin
        or NEW.source_text is distinct from OLD.source_text or NEW.source_url is distinct from OLD.source_url
        or NEW.images is distinct from OLD.images or NEW.company is distinct from OLD.company
        or NEW.contact_name is distinct from OLD.contact_name or NEW.industrial_park is distinct from OLD.industrial_park
        or NEW.age_min is distinct from OLD.age_min or NEW.age_max is distinct from OLD.age_max
        or (coalesce(NEW.active,false) and not NEW.admin_hidden
            and not (coalesce(OLD.active,false) and not OLD.admin_hidden));
    end if;

    -- R7 공개 전 대조: images가 있는 공고는 OCR 대조가 'ok'(현재 images와 같은 해시)가 되기 전까지 비공개로 강제.
    -- 이미 공개 중이고 근거 칸이 안 바뀐 행(만료 처리 등 일반 수정)은 건드리지 않는다.
    if (TG_OP = 'INSERT' or src_changed) and coalesce(NEW.active, false)
       and jsonb_typeof(NEW.images) = 'array' and jsonb_array_length(NEW.images) > 0
       and not (coalesce(NEW.ocr_check->>'status','') = 'ok' and NEW.ocr_check->>'images_hash' = md5(NEW.images::text)) then
      NEW.active := false;
    end if;

    if src_changed then
      -- R3 원문 근거 필수
      if nullif(trim(coalesce(NEW.source_text,'')),'') is null then
        raise exception 'job_rule_R3: source_text(원문)가 비어 있음' using errcode = 'check_violation';
      end if;
      n_img := case when jsonb_typeof(NEW.images) = 'array' then jsonb_array_length(NEW.images) else 0 end;
      if nullif(trim(coalesce(NEW.source_url,'')),'') is null and n_img = 0 then
        raise exception 'job_rule_R3: source_url과 images가 둘 다 없음' using errcode = 'check_violation';
      end if;
      -- R5 원문 그대로
      if nullif(trim(coalesce(NEW.company,'')),'') is not null and not public.job_source_contains(NEW.source_text, NEW.company) then
        raise exception 'job_rule_R5: company "%" 가 source_text에 같은 글자로 없음', NEW.company using errcode = 'check_violation';
      end if;
      if nullif(trim(coalesce(NEW.contact_name,'')),'') is not null and not public.job_source_contains(NEW.source_text, NEW.contact_name) then
        raise exception 'job_rule_R5: contact_name "%" 가 source_text에 같은 글자로 없음', NEW.contact_name using errcode = 'check_violation';
      end if;
      if nullif(trim(coalesce(NEW.industrial_park,'')),'') is not null and not public.job_source_contains(NEW.source_text, NEW.industrial_park) then
        raise exception 'job_rule_R5: industrial_park "%" 가 source_text에 같은 글자로 없음', NEW.industrial_park using errcode = 'check_violation';
      end if;
      -- R6 원문 연령 보존
      if public.job_source_has_age_range(NEW.source_text) and (NEW.age_min is null or NEW.age_max is null) then
        raise exception 'job_rule_R6: 원문에 연령 범위가 있는데 age_min/age_max가 비어 있음' using errcode = 'check_violation';
      end if;
    end if;
  end if;
  -- U2 (미정): age_min이 15 미만이면 비공개 보류. 게시 허용 여부는 사용자 결정 전까지 미정.
  if NEW.age_min is not null and NEW.age_min < 15 then
    NEW.active := false;
  end if;

  return NEW;
end $f$;

drop trigger if exists trg_zz_enforce_job_posting_rules on public.local_jobs;
create trigger trg_zz_enforce_job_posting_rules
  before insert or update on public.local_jobs
  for each row execute function public.enforce_job_posting_rules();

-- ── 5. 규칙 등록 (last_test_*는 건드리지 않는다) ────────────
insert into public.job_posting_rules (rule_key, content, decided_on, incidents, machine_checkable, block_mode, implementation) values
('R1_phone_digits_only','employer_phone, contact_zalo는 저장 시 숫자만 남긴다. 번호 비교도 숫자로만 한다.','2026-10-13','2026-10-13: 08.778.807.56과 0877 880 756을 AI가 "다르다"고 판정(둘 다 0877880756)','가능','없음','trigger trg_zz_enforce_job_posting_rules / job_phone_digits() / job_phones_equal()'),
('R2_decision_columns_code_only','policy_decision은 트리거가 항상 다시 계산해 덮어쓴다(직접 넣은 값 무효).','2026-10-13',null,'가능','없음','trigger trg_zz_enforce_job_posting_rules / job_policy_decision()'),
('R2b_publish_gate_reason_code_only','publish_gate_reason도 코드만 채운다. 현재 계산이 DB 밖(crawler/job_quality.py gate_auto_publish)에 있어 DB 강제는 미구현 — 계산을 DB로 옮길지 사용자 결정 필요.','2026-10-13',null,'불가능','없음','미구현'),
('R3_source_evidence_required','origin이 crawler/admin인 공고는 source_text가 있어야 하고, source_url 또는 images 중 하나는 있어야 한다.','2026-10-13',null,'가능','저장거부','trigger trg_zz_enforce_job_posting_rules'),
('R5_verbatim_names','company, contact_name, industrial_park는 source_text 안에 같은 글자로 있어야 한다(대소문자 무시, 성조 구별).','2026-10-13','2026-10-13: 원문 "NGOC ANH DUONG"을 AI가 "Ngọc Anh Dương"으로 성조를 붙여 씀','가능','저장거부','trigger trg_zz_enforce_job_posting_rules / job_source_contains()'),
('R6_age_preserved','source_text에 "14-50t", "18-35 tuổi" 같은 연령 범위가 있는데 age_min·age_max가 비어 있으면 저장 거부.','2026-10-13','2026-10-13: 원문 "14-50t"를 AI가 "연령 확인 필요"로 바꿔 씀','가능','저장거부','trigger trg_zz_enforce_job_posting_rules / job_source_has_age_range()'),
('R4_policy_exclusion_trigger','공고 제외 정책 판정 트리거(2026-10-12 승인). 이 규칙 표에는 등록만 하고 동작은 바꾸지 않았다.','2026-10-12',null,'가능','저장거부','trigger trg_enforce_job_posting_policy / enforce_job_posting_policy()'),
('R7_ocr_crosscheck','[공개 전 대조] images가 있는 crawler/admin 공고는 ocr_check.status가 ok(현재 images와 같은 해시)가 되기 전까지 트리거가 active=false로 강제한다(읽기불가·불일치도 비공개 유지, OCR 통과 후에만 공개 판정으로 넘어감). 급여는 310k=310000=310.000처럼 k·천 단위 표기를 같은 숫자로 본다. 이미지 저장 시 Tesseract(vie)로 따로 읽어 ocr_text에 저장하고, 전화번호(숫자만)·급여 숫자·contact_name·company·연령이 ocr_text에도 있는지 대조. 없는 항목이 있으면 그 공고만 보류(active=false)하고 어긋난 항목을 ocr_check에 기록. OCR도 틀릴 수 있어 저장 거부는 하지 않는다. 이름은 OCR이 성조를 자주 놓쳐 성조 무시로 비교(R5가 성조 포함 원문 대조를 따로 담당).','2026-10-13',null,'가능','보류','workflow job-ocr-check.yml / scripts/ocr/ocr-check.mjs + ocr-compare.mjs; trigger가 ocr_text/ocr_check 쓰기를 기계 계정으로 제한 + 공개 전 active=false 강제'),
('U1_industrial_park_pin_publish','미정: 공단명만 있는 공고의 "공단 입구 대표 핀"을 공개 조건(좌표 정확 요구)에서 어떻게 취급할지. 사용자 결정 전까지 구현 안 함.','2026-10-13',null,'불가능','없음','미구현(미정)'),
('U2_age_min_under_15','미정: age_min이 15 미만인 공고를 게시할지. 사용자 결정 전까지 트리거가 active=false로 강제(보류). 게시 허용 여부 자체는 미정.','2026-10-13','2026-10-13: 원문 14-50t','가능','보류','trigger trg_zz_enforce_job_posting_rules (미정 — 결정 시 변경)')
on conflict (rule_key) do update set
  content = excluded.content, decided_on = excluded.decided_on, incidents = excluded.incidents,
  machine_checkable = excluded.machine_checkable, block_mode = excluded.block_mode, implementation = excluded.implementation;
