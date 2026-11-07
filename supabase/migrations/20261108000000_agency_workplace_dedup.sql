-- 소개소 공고 중복 판정에 실제 근무 공장·공단 비교(Lee 2026-11-07 A, "3번가자": 새 칸에 저장, 화면에는 쓰지 않음).
-- 소개소 공고는 회사 이름=소개소, 위치=소개소 사무실이라 다른 공장 공고가 같은 공고로 판정됐다.
-- agency_workplace_key: 원문에서 읽은 공장·공단 이름의 접은 글자(src/lib/companyReader.readWorkplace 한 곳). 수집 입구가 소개소일 때만 채운다.
-- 같은 내용을 적는 기존 칸 없음(확인: recruitment_regions=모집 지역, job_work_locations=지도 핀). 공개 조회 권한은 주지 않는다.
do $pre$
begin
  if to_regclass('public.local_jobs') is null then raise exception 'agency_workplace: local_jobs 없음'; end if;
  if to_regprocedure('dedupe_private.verdict(bigint)') is null then raise exception 'agency_workplace: 중복 판정 함수 없음'; end if;
  if not exists (select 1 from information_schema.columns where table_schema = 'public' and table_name = 'local_jobs' and column_name = 'recruitment_type') then
    raise exception 'agency_workplace: 채용 형태 칸 없음';
  end if;
  if exists (select 1 from information_schema.columns where table_schema = 'public' and table_name = 'local_jobs' and column_name = 'agency_workplace_key') then
    raise exception 'agency_workplace: 이미 적용됨';
  end if;
end $pre$;

alter table public.local_jobs add column agency_workplace_key text check (agency_workplace_key is null or length(agency_workplace_key) between 1 and 120);
comment on column public.local_jobs.agency_workplace_key is '소개소 공고의 실제 근무 공장·공단(접은 글자, 중복 판정에만 — 화면 미사용). Lee 2026-11-07.';

-- 판정만(쓰지 않음): 'duplicate' | 'suspect' | 'new' + 상대 공고 + 이유
create or replace function dedupe_private.verdict(p_job bigint, out verdict text, out other bigint, out reason text)
language plpgsql stable set search_path = pg_catalog, public as $$
declare me record; o record; job_v text; loc_v text; my_parks text[]; o_parks text[];
begin
  verdict := 'new';
  select j.id, j.company_id, nullif(btrim(j.occupation_code), '') as occ, j.recruitment_type as rt, nullif(btrim(j.agency_workplace_key), '') as plant
    into me from public.local_jobs j where j.id = p_job;
  if me.company_id is null then return; end if;
  select coalesce(array_agg(distinct lower(btrim(w.industrial_park))) filter (where nullif(btrim(w.industrial_park), '') is not null), '{}')
    into my_parks from public.job_work_locations w where w.job_id = p_job;
  for o in
    select j.id, nullif(btrim(j.occupation_code), '') as occ, j.recruitment_type as rt, nullif(btrim(j.agency_workplace_key), '') as plant from public.local_jobs j
     where j.id < p_job and j.active and not coalesce(j.admin_hidden, false)
       and (j.company_id = me.company_id
            or exists (select 1 from public.job_company_phones a join public.job_company_phones b on a.phone = b.phone
                        join public.job_companies ca on ca.id = a.company_id join public.job_companies cb on cb.id = b.company_id
                       where a.company_id = me.company_id and b.company_id = j.company_id
                         and (ca.core ~ '^p0[0-9]{8,10}$' or cb.core ~ '^p0[0-9]{8,10}$')))   -- 한쪽이 이름 없는 공고면 번호로 같은 회사
     order by j.id
  loop
    -- 같은 일
    if me.occ is null or o.occ is null then job_v := 'unknown';
    elsif length(me.occ) >= 4 and length(o.occ) >= 4 then job_v := case when me.occ = o.occ then 'same' else 'different' end;
    else job_v := case when left(me.occ, 1) = left(o.occ, 1) then 'unknown' else 'different' end;
    end if;
    continue when job_v = 'different';
    -- 같은 위치
    select coalesce(array_agg(distinct lower(btrim(w.industrial_park))) filter (where nullif(btrim(w.industrial_park), '') is not null), '{}')
      into o_parks from public.job_work_locations w where w.job_id = o.id;
    if my_parks && o_parks then loc_v := 'same';
    elsif not exists (select 1 from dedupe_private.precise_points(p_job)) or not exists (select 1 from dedupe_private.precise_points(o.id)) then loc_v := 'unknown';
    elsif exists (select 1 from dedupe_private.precise_points(p_job) a, dedupe_private.precise_points(o.id) b
                   where dedupe_private.meters(a.lat, a.lng, b.lat, b.lng) <= 200) then loc_v := 'same';
    else loc_v := 'different';
    end if;
    continue when loc_v = 'different';
    -- 소개소 공고끼리(Lee 2026-11-07 A): 회사(소개소)·위치(사무실)가 같아도 실제 근무 공장·공단이 다르면 다른 공고.
    -- 한쪽이라도 공장·공단을 모르면 확정하지 않는다(애매 → 관리자 확인).
    if me.rt = 'agency' and o.rt = 'agency' then
      continue when me.plant is not null and o.plant is not null and me.plant <> o.plant;
      if me.plant is null or o.plant is null then loc_v := 'unknown'; end if;
    end if;
    if job_v = 'same' and loc_v = 'same' then
      verdict := 'duplicate'; other := o.id; reason := 'same_company_job_location'; return;
    end if;
    if verdict = 'new' then
      verdict := 'suspect'; other := o.id;
      reason := case when job_v = 'unknown' and loc_v = 'unknown' then 'job_and_location_unclear'
                     when job_v = 'unknown' then 'job_unclear' else 'location_unclear' end;
    end if;
  end loop;
end $$;

