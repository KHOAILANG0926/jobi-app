-- 지점별 독립 공고(Lee 2026-11-23 확정, 이슈 #988): 한 원문 글의 지점 A·B·C는 공고 3개다. 같은 공고 판정은 (원본 식별자 + 정규화 위치 식별자)의 쌍.
-- 지금 입구(ingest_job)는 같은 글이면(내용 해시·source_url·같은 원문+연락처+회사) 지점이 달라도 같은 공고로 보고 두 번째부터 duplicate_of로 막는다.
-- 그리고 중복 판정(dedupe_private.verdict)은 같은 회사·같은 일·같은 공단이면 나중 공고를 꺼서(active=false) 형제 지점이 서로를 끈다.
-- 이 파일은 새 칸·새 표 없이 기존 함수 세 개만 고친다(기존 공고 데이터는 건드리지 않는다 — 기존 다중 근무지 공고 전환은 별도 승인).
--   ① 지점 위치 식별자 = admin_location_key(원문 주소)  → ingest_private.branch_key (부르는 쪽 권한과 무관하게 같은 값)
--   ② ingest_private.find_existing: 지점 위치(p_branch)가 오면 같은 글이라도 그 지점의 근무지 줄이 있는 공고만 같은 공고. 지점 위치가 없으면 예전과 똑같다.
--   ③ ingest_job: 내용 해시에 지점 위치를 더하고 find_existing에 넘긴다(payload 칸 branch_location — local_jobs 칸이 아니라서 저장되지 않음).
--   ④ dedupe_private.verdict: 같은 source_url(= 같은 원문 글)에서 나온 공고끼리는 서로 중복·의심이 아니다.
-- 되돌리기: 이전 함수 본문(20261029010000_ingest_one_door·20261108000000_agency_workplace_dedup)으로 복원하는 새 migration. 데이터 변경 없음.
do $pre$
begin
  if to_regprocedure('public.ingest_job(jsonb)') is null then raise exception 'branch identity: ingest_job 없음'; end if;
  if to_regprocedure('ingest_private.find_existing(bigint,text,text,text,text,text)') is null then raise exception 'branch identity: find_existing(6) 없음 — 이미 적용됐거나 입구가 없음'; end if;
  if to_regprocedure('dedupe_private.verdict(bigint)') is null then raise exception 'branch identity: 중복 판정 함수 없음'; end if;
  if to_regprocedure('public.admin_location_key(text)') is null then raise exception 'branch identity: admin_location_key 없음'; end if;
  if not exists (select 1 from information_schema.columns where table_schema = 'public' and table_name = 'local_jobs' and column_name = 'source_url') then
    raise exception 'branch identity: local_jobs.source_url 없음';
  end if;
  if not exists (select 1 from information_schema.columns where table_schema = 'public' and table_name = 'job_work_locations' and column_name = 'normalized_address') then
    raise exception 'branch identity: job_work_locations.normalized_address 없음';
  end if;
end $pre$;

-- ① 지점 위치 식별자
create function ingest_private.branch_key(p_text text) returns text
language sql stable security definer set search_path = pg_catalog, public as $$
  select nullif(public.admin_location_key(p_text), '')
$$;

-- ② 같은 공고 찾기(지점 위치 식별자 포함). p_branch가 비면 6개 자리 예전 함수와 같은 결과.
create function ingest_private.find_existing(p_raw bigint, p_hash text, p_source_url text, p_phone text, p_company text, p_source_text text, p_branch text)
returns bigint language sql stable security definer set search_path = pg_catalog, public as $$
  select coalesce(
    (select r.job_id from public.job_ingest_raw r join public.local_jobs j on j.id = r.job_id
      where r.id <> p_raw and (r.content_hash = p_hash
        or (ingest_private.branch_key(p_branch) is null and nullif(p_source_url, '') is not null and r.source_url = p_source_url))
      order by r.id limit 1),
    (select j.id from public.local_jobs j
      where nullif(p_source_url, '') is not null and j.source_url = p_source_url
        and (ingest_private.branch_key(p_branch) is null
             or exists (select 1 from public.job_work_locations w where w.job_id = j.id and w.normalized_address = ingest_private.branch_key(p_branch)))
      order by j.id limit 1),
    (select j.id from public.local_jobs j
      where nullif(trim(p_source_text), '') is not null and j.source_text is not null and md5(j.source_text) = md5(p_source_text)
        and coalesce(public.job_phone_digits(j.employer_phone), '') = coalesce(public.job_phone_digits(p_phone), '')
        and lower(coalesce(j.company, '')) = lower(coalesce(p_company, ''))
        and (ingest_private.branch_key(p_branch) is null
             or exists (select 1 from public.job_work_locations w where w.job_id = j.id and w.normalized_address = ingest_private.branch_key(p_branch)))
      order by j.id limit 1));
$$;
revoke all on function ingest_private.branch_key(text), ingest_private.find_existing(bigint,text,text,text,text,text,text) from public;
grant execute on function ingest_private.branch_key(text), ingest_private.find_existing(bigint,text,text,text,text,text,text) to anon, authenticated, service_role;

-- ③ ingest_job 본문의 두 줄만 바꾼다(앞선 패치 20261112020000과 같은 방식 — 줄이 없거나 둘이면 RAISE로 전체 취소).
do $patch$
declare definition text;
 old_hash text := 'hash := md5(coalesce(public.job_phone_digits(p->>''employer_phone''), '''') || ''|'' || lower(coalesce(p->>''company'', '''')) || ''|'' || md5(p->>''source_text''));';
 new_hash text := 'hash := md5(coalesce(public.job_phone_digits(p->>''employer_phone''), '''') || ''|'' || lower(coalesce(p->>''company'', '''')) || ''|'' || md5(p->>''source_text'') || coalesce(''|'' || ingest_private.branch_key(p->>''branch_location''), ''''));';
 old_call text := 'target := ingest_private.find_existing(raw_id, hash, p->>''source_url'', p->>''employer_phone'', p->>''company'', p->>''source_text'');';
 new_call text := 'target := ingest_private.find_existing(raw_id, hash, p->>''source_url'', p->>''employer_phone'', p->>''company'', p->>''source_text'', p->>''branch_location'');';
begin
 select pg_get_functiondef('public.ingest_job(jsonb)'::regprocedure) into definition;
 if position(old_hash in definition) = 0 then raise exception 'branch identity: ingest_job 해시 줄을 찾지 못함'; end if;
 if position(old_hash in substr(definition, position(old_hash in definition) + 1)) > 0 then raise exception 'branch identity: ingest_job 해시 줄이 둘 이상'; end if;
 if position(old_call in definition) = 0 then raise exception 'branch identity: ingest_job find_existing 호출 줄을 찾지 못함'; end if;
 if position(old_call in substr(definition, position(old_call in definition) + 1)) > 0 then raise exception 'branch identity: ingest_job find_existing 호출 줄이 둘 이상'; end if;
 execute replace(replace(definition, old_hash, new_hash), old_call, new_call);
end $patch$;
-- 이제 6개 자리 find_existing은 어디서도 부르지 않는다 → 지운다(같은 일을 하는 함수를 둘 두지 않음).
drop function ingest_private.find_existing(bigint,text,text,text,text,text);

-- ④ 중복 판정: 같은 원문 글(source_url)에서 나온 형제 지점 공고는 서로 비교하지 않는다.
do $patch$
declare definition text;
 old_line text := '     where j.id < p_job and j.active and not coalesce(j.admin_hidden, false)';
 new_line text := '     where j.id < p_job and j.active and not coalesce(j.admin_hidden, false)' || chr(10) ||
   '       and not (j.source_url is not null and j.source_url = (select s.source_url from public.local_jobs s where s.id = p_job))   -- 같은 원문 글의 형제 지점(Lee 2026-11-23)';
begin
 select pg_get_functiondef('dedupe_private.verdict(bigint)'::regprocedure) into definition;
 if position(old_line in definition) = 0 then raise exception 'branch identity: verdict 비교 대상 줄을 찾지 못함'; end if;
 if position(old_line in substr(definition, position(old_line in definition) + 1)) > 0 then raise exception 'branch identity: verdict 비교 대상 줄이 둘 이상'; end if;
 execute replace(definition, old_line, new_line);
end $patch$;
