-- 대표 이미지 고정 배정 칸(Lee 2026-11-27 "representative_image_id 전용 칸 추가 방향을 승인한다", 설계: 직무 중심 대표 이미지 #1179·#1180).
-- 실제 업체 사진 자리(image_url·images·company_domain)를 건드리지 않고, 우리가 고른 대표 이미지(data/industry-photos/manifest.json의 id)를 공고에 한 번 정해 두는 칸이다.
-- 값이 있으면 화면이 그 이미지를 그대로 쓰므로 이미지가 추가돼도 기존 배정은 바뀌지 않는다. 값이 없으면 화면이 지금처럼 그때그때 계산한다.
-- 쓰기는 기계 경로(기존 30분 처리 단계, DB 소유자)만 한다 — 이 migration은 공개 조회(select)만 열고 수정 권한은 주지 않는다. 새 표·새 함수·새 트리거 없음.
-- 데이터 변경 없음: 새 칸은 모든 기존 공고에서 null(배정 전). ocr_check는 쓰지 않는다(Lee 지시).
do $pre$
begin
  if to_regclass('public.local_jobs') is null then raise exception 'representative_image_id: local_jobs 없음'; end if;
  if exists (select 1 from information_schema.columns where table_schema = 'public' and table_name = 'local_jobs' and column_name = 'representative_image_id') then
    raise exception 'representative_image_id: 이미 적용됨';
  end if;
end $pre$;

alter table public.local_jobs add column representative_image_id text;
alter table public.local_jobs add constraint local_jobs_representative_image_id_shape
  check (representative_image_id is null or representative_image_id ~ '^[a-z0-9_-]{1,80}$');
comment on column public.local_jobs.representative_image_id is '고정 배정된 대표 이미지 번호(data/industry-photos/manifest.json의 id). null = 배정 전. 실제 업체 사진(image_url·images)과 별개(Lee 2026-11-27).';
grant select (representative_image_id) on public.local_jobs to anon, authenticated;
