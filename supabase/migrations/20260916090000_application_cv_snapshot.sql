-- 기업이 자기 공고 지원자의 "지원 당시 제출 정보"만 볼 수 있게 한다.
-- - applications.cv_snapshot: 지원 시점의 user_cvs.cv_data 스냅샷(jsonb). 이후
--   구직자가 프로필/CV를 수정해도 이 값은 절대 바뀌지 않는다 — BEFORE INSERT
--   트리거로 딱 한 번만 채워지고, 이 컬럼을 바꿀 수 있는 UPDATE 정책은 구직자
--   쪽에 전혀 없다(seeker는 UPDATE 정책 자체가 없음 — INSERT/SELECT/DELETE만
--   가능. employer는 status/status_history만 바꿀 수 있는 WITH CHECK가 이미
--   있어 이 컬럼을 건드리지 않음).
-- - applications.cv_photo_snapshot_path: 지원 시점 CV 사진의 스냅샷 복사본
--   경로(cv-photos 버킷, applications/<job_id>/<seeker_id>/ 하위). 원본
--   user_cvs 사진 경로(<user_id>/profile.ext)는 재업로드 시 덮어써지므로,
--   스냅샷은 그 경로를 그대로 참조하지 않고 지원 시점에 별도 경로로 복사한
--   사본을 가리킨다.
-- applications 테이블 자체의 SELECT RLS(applications_select: seeker_id =
-- auth.uid() OR employer_id = auth.uid())가 이미 "자기 공고 지원자만" 규칙을
-- 강제하므로, 이 두 컬럼에 대해 별도 RLS는 필요 없다(행 단위 정책이 이미 컬럼
-- 전체를 덮는다). profiles/user_profiles 전체 공개나 공개 구직자 검색 기능은
-- 이 마이그레이션에 포함하지 않는다.

alter table public.applications
  add column if not exists cv_snapshot jsonb,
  add column if not exists cv_photo_snapshot_path text;

create or replace function public.applications_set_cv_snapshot()
returns trigger
language plpgsql
security invoker
set search_path = public
as $$
begin
  if new.cv_snapshot is null then
    select cv_data into new.cv_snapshot
    from public.user_cvs
    where user_id = new.seeker_id;
  end if;
  return new;
end;
$$;

drop trigger if exists applications_cv_snapshot_trigger on public.applications;
create trigger applications_cv_snapshot_trigger
  before insert on public.applications
  for each row
  execute function public.applications_set_cv_snapshot();

-- cv-photos 버킷의 "applications/<job_id>/<seeker_id>/..." 하위 경로에 대한
-- 정책 — 기존 "<user_id>/..." 하위 정책(cv_photos_*_own)과는 별개 네임스페이스.
-- INSERT: 본인(seeker)만 자기 job_id+seeker_id 조합 경로에 스냅샷을 쓸 수 있다.
create policy cv_photos_insert_application_snapshot
  on storage.objects
  for insert
  with check (
    is_account_active(auth.uid())
    and bucket_id = 'cv-photos'
    and (storage.foldername(name))[1] = 'applications'
    and (storage.foldername(name))[3] = auth.uid()::text
  );

-- SELECT: 그 job_id의 소유 기업(employer_id = auth.uid())이거나, 스냅샷을 낸
-- 본인(seeker)만 조회 가능 — 공개 URL 없이 항상 이 정책을 통과해야 다운로드된다.
create policy cv_photos_select_application_snapshot
  on storage.objects
  for select
  using (
    is_account_active(auth.uid())
    and bucket_id = 'cv-photos'
    and (storage.foldername(name))[1] = 'applications'
    and (
      (storage.foldername(name))[3] = auth.uid()::text
      or exists (
        select 1 from public.applications a
        where a.job_id::text = (storage.foldername(name))[2]
          and a.seeker_id::text = (storage.foldername(name))[3]
          and a.employer_id = auth.uid()
      )
    )
  );
