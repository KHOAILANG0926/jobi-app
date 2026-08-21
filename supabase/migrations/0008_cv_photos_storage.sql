-- Private CV photos. Each authenticated user owns the first path segment.

begin;

insert into storage.buckets (
  id,
  name,
  public,
  file_size_limit,
  allowed_mime_types
)
values (
  'cv-photos',
  'cv-photos',
  false,
  1572864,
  array['image/jpeg', 'image/png', 'image/webp']
)
on conflict (id) do update set
  public = excluded.public,
  file_size_limit = excluded.file_size_limit,
  allowed_mime_types = excluded.allowed_mime_types;

drop policy if exists cv_photos_select_own on storage.objects;
drop policy if exists cv_photos_insert_own on storage.objects;
drop policy if exists cv_photos_update_own on storage.objects;
drop policy if exists cv_photos_delete_own on storage.objects;

create policy cv_photos_select_own on storage.objects
  for select to authenticated
  using (
    bucket_id = 'cv-photos'
    and (storage.foldername(name))[1] = auth.uid()::text
  );

create policy cv_photos_insert_own on storage.objects
  for insert to authenticated
  with check (
    bucket_id = 'cv-photos'
    and (storage.foldername(name))[1] = auth.uid()::text
  );

create policy cv_photos_update_own on storage.objects
  for update to authenticated
  using (
    bucket_id = 'cv-photos'
    and (storage.foldername(name))[1] = auth.uid()::text
  )
  with check (
    bucket_id = 'cv-photos'
    and (storage.foldername(name))[1] = auth.uid()::text
  );

create policy cv_photos_delete_own on storage.objects
  for delete to authenticated
  using (
    bucket_id = 'cv-photos'
    and (storage.foldername(name))[1] = auth.uid()::text
  );

commit;
