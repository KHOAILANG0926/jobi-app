-- 시험 DB 준비(폐기용, 운영 아님): 20261124120000_multi_branch_conversion 시험.
-- 운영 함수 중 이 전환이 부르는 두 개만 대역으로 둔다: write_location의 'delete' 갈래(운영 본문 20261026231445와 같은 보관 순서 — retained_rows → write_log → 삭제)와
-- ingest_job의 '기존 공고 고치기'(update_fields 칸만, 원문 필수). 그 밖의 갈래는 부르면 실패한다(이 전환이 쓰지 않음을 확인).
alter table public.local_jobs add column if not exists title text, add column if not exists source text, add column if not exists source_url text,
  add column if not exists source_text text, add column if not exists active boolean default true, add column if not exists admin_hidden boolean default false;
alter table public.job_work_locations add column if not exists normalized_address text, add column if not exists point_kind text default 'unresolved',
  add column if not exists point_authority text default 'unresolved';
create schema if not exists location_private;
create table if not exists location_private.retained_rows (id bigint generated always as identity primary key, relation_name text, job_id bigint, row_data jsonb, reason text, retained_at timestamptz default now());
create table if not exists location_private.write_log (id bigint generated always as identity primary key, job_id bigint, work_location_id bigint, operation text, previous_row jsonb, next_row jsonb, request_payload jsonb);
create table if not exists public.research_artifacts (kind text not null, name text not null, payload jsonb, meta jsonb, unique (kind, name));
create table if not exists public.mbc_test_ingest_calls (p jsonb);
create or replace function location_private.write_location(p_job_id bigint, p_operation text, p_payload jsonb) returns bigint language plpgsql as $f$
declare w public.job_work_locations;
begin
  if p_operation <> 'delete' then raise exception 'test stub: % not used by conversion', p_operation; end if;
  select * into w from public.job_work_locations where job_id = p_job_id and id = (p_payload->>'work_location_id')::bigint for update;
  if not found then return null; end if;
  insert into location_private.retained_rows(relation_name, job_id, row_data, reason) values ('job_work_locations', p_job_id, to_jsonb(w), 'writer_delete');
  insert into location_private.write_log(job_id, work_location_id, operation, previous_row) values (p_job_id, w.id, 'delete', to_jsonb(w));
  delete from public.job_work_locations where id = w.id;
  return w.id;
end $f$;
create or replace function public.ingest_job(p jsonb) returns bigint language plpgsql as $f$
begin
  if coalesce(btrim(p->>'source_text'), '') = '' then raise exception 'ingest: source_text(원문) 필요'; end if;
  if p->>'channel' is distinct from 'sql_file' or p->'update_fields' is distinct from '["location"]'::jsonb or not (p ? 'job_id') then
    raise exception 'test stub: only existing-job location fix expected, got %', p; end if;
  insert into public.mbc_test_ingest_calls values (p);
  update public.local_jobs set location = p->>'location' where id = (p->>'job_id')::bigint;
  return (p->>'job_id')::bigint;
end $f$;
-- dry-run(45314812701)과 같은 모양: 확정 지점 없음 4곳(#4825형) · 첫 지점 대략·둘째 확정(#5992형) · 첫 지점 확정·둘째 대략(#5994형) · 한 곳(전환 안 함)
insert into public.local_jobs(id, company, title, location, source, source_url, source_text, active, admin_hidden) values
 (9101, 'CTY KTCN', 'Kỹ sư MEP', 'Cảng hàng không', 'chotot', 'https://example.test/a', 'nguyên văn A', false, false),
 (9102, 'KRIK', 'KRIK tuyển', '152 Trần Hưng Đạo, Kinh Bắc, Bắc Ninh', null, null, 'nguyên văn B', true, false),
 (9103, 'MEDIAMART', 'MediaMart tuyển', 'Số 37 Lý Thái Tổ, Bắc Ninh', null, null, 'nguyên văn C', true, false),
 (9104, 'Solo', 'Một chỗ', '1 Ngô Gia Tự', null, null, 'nguyên văn D', true, false);
insert into public.job_work_locations(id, job_id, raw_address, sort_order, lat, lng, location_verified, point_kind, point_authority) values
 (91011, 9101, 'Cảng hàng không', 0, null, null, false, 'unresolved', 'unresolved'),
 (91012, 9101, 'Sân bay Quảng Trị', 1, null, null, false, 'unresolved', 'unresolved'),
 (91013, 9101, 'Cảng HKQT Long Thành', 2, null, null, false, 'unresolved', 'unresolved'),
 (91014, 9101, 'Dự án Becamex Bình Dương', 3, null, null, false, 'unresolved', 'unresolved'),
 (91021, 9102, '152 Trần Hưng Đạo, Kinh Bắc, Bắc Ninh', 0, 21.18, 106.07, false, 'area', 'auto_area'),
 (91022, 9102, '148 Trần Phú, Từ Sơn, Bắc Ninh', 1, 21.117, 105.96, true, 'exact', 'source_verified'),
 (91031, 9103, 'Số 37 Lý Thái Tổ, Bắc Ninh', 0, 21.18, 106.06, true, 'exact', 'source_verified'),
 (91032, 9103, 'Đường Trần Phú, Phường Từ Sơn, Bắc Ninh', 1, 21.12, 105.96, false, 'area', 'auto_area'),
 (91041, 9104, '1 Ngô Gia Tự', 0, 21.18, 106.07, true, 'exact', 'source_verified');
create table public.mbc_test_before as select id, job_id, to_jsonb(w) as row_data from public.job_work_locations w where job_id between 9101 and 9104;
