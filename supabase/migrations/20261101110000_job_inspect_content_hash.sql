-- 검사표가 "지금 내용"을 검사했는지 DB가 강제한다 (2026-11-01 Lee: 규정이 있어도 화면에 틀린 공고가 나오는 구조를 고친다).
--
-- 1) job_inspect_content_hash(j): 화면에 나가는 공고 내용의 지문(md5).
--    to_jsonb(j)에서 키를 골라 만들기 때문에 열이 없는 시험용 표에서도 생성·실행된다(없는 열은 null).
-- 2) 공개(active=true)는 아래 경우에만 허용한다.
--    - 이미 공개 중이고 내용 지문이 그대로인 경우(위치·검사 기록 등 내용 외 변경)
--    - 검사 기록(ocr_check.inspect)의 content_hash가 지금 내용과 같고 publishable=true인 경우
--    그 외에 공개를 요청하면 비공개로 바꾸고 ocr_check.inspect_hold=true를 남긴다.
--    검사기(scripts/ops/job-inspect.mjs)가 같은 내용으로 통과(publishable)를 기록하면 inspect_hold 공고를 다시 공개한다.
-- 3) 다른 공개 규정(R4 정책, R7 OCR, R8 직업분류 등)은 각자 트리거가 그대로 강제한다. 이 트리거는 비공개로만 바꾼다.
-- 위치 데이터(job_work_locations)는 바꾸지 않는다.

create or replace function public.job_inspect_content_hash(j public.local_jobs) returns text
language sql stable set search_path = pg_catalog, public as $$
  select md5(coalesce((
    select jsonb_object_agg(k, to_jsonb(j) -> k)
    from unnest(array[
      'title','company','salary','salary_min','salary_max','salary_period',
      'description','images','source_text','ocr_text','location',
      'employer_phone','contact_zalo','category','occupation_code',
      'hours','work_days','age_requirement','gender_requirement',
      'education','preference','num_hires','language_requirement','required_documents',
      'shuttle_bus','dormitory','meal_provided'
    ]) as k
  ), '{}'::jsonb)::text)
$$;
revoke all on function public.job_inspect_content_hash(public.local_jobs) from public, anon, authenticated;

create or replace function public.enforce_job_inspect_current() returns trigger
language plpgsql set search_path = pg_catalog, public as $$
declare
  h text;
begin
  if coalesce(new.origin, '') not in ('crawler', 'admin') then return new; end if;

  if not coalesce(new.active, false) then
    -- 누군가 공개 중인 공고를 직접 내리면 검사기가 되살리지 않는다.
    if tg_op = 'UPDATE' and coalesce(old.active, false) then
      new.ocr_check := coalesce(new.ocr_check, '{}'::jsonb) - 'inspect_hold';
    end if;
    return new;
  end if;

  h := public.job_inspect_content_hash(new);
  -- 공개 중 + 내용 그대로: 내용 외 변경은 막지 않는다.
  if tg_op = 'UPDATE' and coalesce(old.active, false) and h = public.job_inspect_content_hash(old) then
    return new;
  end if;
  -- 지금 내용으로 검사 통과한 기록이 있으면 공개 허용.
  if new.ocr_check -> 'inspect' ->> 'content_hash' = h
     and coalesce((new.ocr_check -> 'inspect' ->> 'publishable')::boolean, false) then
    return new;
  end if;

  new.active := false;
  new.ocr_check := coalesce(new.ocr_check, '{}'::jsonb) || jsonb_build_object('inspect_hold', true);
  return new;
end $$;
revoke all on function public.enforce_job_inspect_current() from public, anon, authenticated;

drop trigger if exists trg_zzz_inspect_current on public.local_jobs;
create trigger trg_zzz_inspect_current before insert or update on public.local_jobs
for each row execute function public.enforce_job_inspect_current();
