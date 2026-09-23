-- Community 게시글에 첨부하는 사진. 공개 게시판이라 버킷 자체는 public이고,
-- 업로드/수정/삭제만 본인 폴더(userId/...)로 제한한다.

begin;

insert into storage.buckets (
  id,
  name,
  public,
  file_size_limit,
  allowed_mime_types
)
values (
  'community-photos',
  'community-photos',
  true,
  8388608,
  array['image/jpeg', 'image/png', 'image/webp']
)
on conflict (id) do update set
  public = excluded.public,
  file_size_limit = excluded.file_size_limit,
  allowed_mime_types = excluded.allowed_mime_types;

drop policy if exists community_photos_select on storage.objects;
drop policy if exists community_photos_insert_own on storage.objects;
drop policy if exists community_photos_update_own on storage.objects;
drop policy if exists community_photos_delete_own on storage.objects;

create policy community_photos_select on storage.objects
  for select
  to anon, authenticated
  using (bucket_id = 'community-photos');

create policy community_photos_insert_own on storage.objects
  for insert
  to authenticated
  with check (
    bucket_id = 'community-photos'
    and (storage.foldername(name))[1] = auth.uid()::text
  );

create policy community_photos_update_own on storage.objects
  for update
  to authenticated
  using (
    bucket_id = 'community-photos'
    and (storage.foldername(name))[1] = auth.uid()::text
  )
  with check (
    bucket_id = 'community-photos'
    and (storage.foldername(name))[1] = auth.uid()::text
  );

create policy community_photos_delete_own on storage.objects
  for delete
  to authenticated
  using (
    bucket_id = 'community-photos'
    and (storage.foldername(name))[1] = auth.uid()::text
  );

commit;
