-- Lee 2026-10-28: privileged source confirmation; preserve original R1/R5/R6/R7.
begin;
do $$ begin
 if not exists(select 1 from public.job_posting_rules where rule_key='R3_source_evidence_required') then
  raise exception 'R3 preflight: existing rule missing';
 end if;
end $$;
create or replace function public.enforce_job_posting_rules() returns trigger
language plpgsql set search_path = pg_catalog, public as $f$
declare
  src_changed boolean;
  n_img int;
  lee_confirmed boolean;
  attestation_changed boolean;
begin
  -- R7 보호: ocr_text / ocr_check는 기계(DB 소유자 계정)만 쓴다. AI·앱(service_role 포함)은 거부.
  if current_user not in ('postgres','supabase_admin') and (
       (TG_OP = 'INSERT' and (NEW.ocr_text is not null or NEW.ocr_check is not null))
    or (TG_OP = 'UPDATE' and (NEW.ocr_text is distinct from OLD.ocr_text or NEW.ocr_check is distinct from OLD.ocr_check))) then
    raise exception 'job_rule_R7: ocr_text/ocr_check는 기계만 쓸 수 있음' using errcode = 'insufficient_privilege';
  end if;

  lee_confirmed := NEW.origin = 'admin' and coalesce(NEW.source,'') ~ '^Lee 확인\(원문 Facebook, 작성자 [^()[:cntrl:]]+\)( · Lee 제공 포스터에서 옮김)?$';
  if TG_OP = 'INSERT' then attestation_changed := true;
  else attestation_changed := NEW.source is distinct from OLD.source or NEW.origin is distinct from OLD.origin
    or NEW.source_text is distinct from OLD.source_text;
  end if;
  if coalesce(NEW.source,'') like 'Lee 확인%' and attestation_changed and current_user not in ('postgres','supabase_admin') then
    raise exception 'job_rule_R3: Lee 확인 기록은 승인된 migration 경로에서만 작성' using errcode = 'check_violation';
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
      src_changed := NEW.origin is distinct from OLD.origin or NEW.source is distinct from OLD.source
        or NEW.source_text is distinct from OLD.source_text or NEW.source_url is distinct from OLD.source_url
        or NEW.images is distinct from OLD.images or NEW.company is distinct from OLD.company
        or NEW.contact_name is distinct from OLD.contact_name
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
      if nullif(trim(coalesce(NEW.source_url,'')),'') is null and n_img = 0 and not lee_confirmed then
        raise exception 'job_rule_R3: source_url·images·유효한 Lee 확인 기록이 모두 없음' using errcode = 'check_violation';
      end if;
      -- R5 원문 그대로
      if nullif(trim(coalesce(NEW.company,'')),'') is not null and not public.job_source_contains(NEW.source_text, NEW.company) then
        raise exception 'job_rule_R5: company "%" 가 source_text에 같은 글자로 없음', NEW.company using errcode = 'check_violation';
      end if;
      if nullif(trim(coalesce(NEW.contact_name,'')),'') is not null and not public.job_source_contains(NEW.source_text, NEW.contact_name) then
        raise exception 'job_rule_R5: contact_name "%" 가 source_text에 같은 글자로 없음', NEW.contact_name using errcode = 'check_violation';
      end if;
      -- R6 원문 연령 보존
      if public.job_source_has_age_range(NEW.source_text) and (NEW.age_min is null or NEW.age_max is null) then
        raise exception 'job_rule_R6: 원문에 연령 범위가 있는데 age_min/age_max가 비어 있음' using errcode = 'check_violation';
      end if;
    end if;
  end if;
  return NEW;
end $f$;

insert into public.job_posting_rules(rule_key,content,decided_on,machine_checkable,block_mode,implementation) values
('R3_source_evidence_required','source_text 원문 필수. source_url 또는 images 또는 Lee가 직접 가져와 승인된 migration 경로에 기록한 Lee 확인(원문 Facebook, 작성자 이름)을 출처로 인정. 이미지 저장은 선택. Lee 확인은 admin 공고만 허용하며 앱·service_role은 생성/변경할 수 없다.',date '2026-10-28','가능','저장거부','enforce_job_posting_rules'),
('R9_application_relevant_only','게시 시각은 계산·저장·추정 표시하지 않는다. 구직자의 지원 결정에 필요 없는 게시 시각·작성자 계정 종류·AI 콘텐츠 표시 등에 시간·사용량을 쓰지 않는다. created_at은 시스템 등록 시각이며 원문 게시 시각으로 위장하지 않는다.',date '2026-10-28','불가능','없음','CLAUDE.md / AGENTS.md: 작업 규칙, 전체 동작 자동 강제 아님'),
('R10_multi_role_conditions','한 원문의 여러 직무는 공고 1개로 유지하고 상세요강에 직무별 급여·시간·복리후생을 구별한다. 상단 급여는 Theo vị trí — xem chi tiết. 서로 다른 직무/시급/협의급여를 통합한 숫자 범위를 만들지 않는다. 단일 직업코드는 근거가 확인된 대표 직무만 뜻하며 다른 직무에 그 코드를 적용했다고 주장하지 않는다.',date '2026-10-28','불가능','없음','등록·상세요강 검토, 단일 코드 의미 자동 검증 아님'),
('R11_original_hours_review','10h - 10h처럼 시작·종료가 같은 근무시간은 원문 그대로 두고 관리자 확인 대상으로 검사표에 남긴다. 임의 보정 금지. 확인 전 전체 통과가 아님.',date '2026-10-28','가능','보류','src/lib/jobInspect.ts hours_review (검사표 실패, 자동 공개 차단과 구분)'),
('R12_location_precision_review','번지 없는 주소는 상호명+도로 수준의 실제 근거가 있을 때만 해당 정확도를 표시한다. 미확정이면 canonical location writer의 unresolved 상태로 관리자 위치 확정 목록에 남긴다. 임의 좌표·정확한 매장 핀 생성 금지.',date '2026-10-28','불가능','없음','canonical location writer / 관리자 위치 확정, 주소 의미 자동 검증 아님')
on conflict(rule_key) do update set content=excluded.content,decided_on=excluded.decided_on,machine_checkable=excluded.machine_checkable,block_mode=excluded.block_mode,implementation=excluded.implementation;
commit;
