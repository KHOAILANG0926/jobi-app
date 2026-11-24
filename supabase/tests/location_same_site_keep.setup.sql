-- 시험 DB 준비(폐기용, 운영 아님): 20261124150000_location_same_site_keep 시험.
-- 대역이 아니라 운영 본문을 쓴다: 위치 쓰기 함수(multi_branch_conversion.setup이 옮겨 둔 운영 write_location) + 20261124130000 패치,
-- 관리자 확정 자격 view 두 개(20261110160000 글자 그대로), 회사 재확인 reconcile_company·트리거 job_identity_changed(20261026231445 글자 그대로).
\i supabase/tests/multi_branch_conversion.setup.sql
\i supabase/migrations/20261124130000_location_same_store_keep.sql
alter table public.job_location_candidates add column if not exists created_at timestamptz default now();
drop view location_private.valid_memory_targets;
create view location_private.eligible_memory with (security_invoker = true) as
 select location_private.company_identity(c.company_snapshot) company_identity,
  public.admin_location_key(c.address_snapshot) address_key,
  c.id source_candidate_id, c.lat, c.lng, c.place_precision, c.reviewed_at approved_at, c.reviewed_by approved_by
 from public.job_location_candidates c
 join public.admin_confirmed_location_memory m on m.source_candidate_id = c.id and m.active
 join public.local_jobs origin_job on origin_job.id = c.job_id
 where c.status = 'approved' and c.reviewed_by is not null and c.reviewed_at is not null
 and c.evidence not like 'AUTO REUSE:%'
 and c.place_precision in ('entrance', 'building', 'site') and nullif(btrim(c.evidence), '') is not null
 and c.lat between 8 and 24 and c.lng between 102 and 110
 and m.approved_by = c.reviewed_by and m.approved_at = c.reviewed_at and m.lat = c.lat and m.lng = c.lng and m.place_precision = c.place_precision
 and m.address_key = public.admin_location_key(c.address_snapshot)
 and location_private.company_identity(origin_job.company) = location_private.company_identity(c.company_snapshot)
 and (public.admin_location_key(origin_job.location) = public.admin_location_key(c.address_snapshot)
  or exists(select 1 from public.job_work_locations ow where ow.job_id = origin_job.id
   and public.admin_location_key(ow.raw_address) = public.admin_location_key(c.address_snapshot)));

create or replace view location_private.valid_memory_targets with (security_invoker = true) as
with targets as (
 select j.id job_id, j.company, w.raw_address address, w.id work_location_id from public.local_jobs j
 join public.job_work_locations w on w.job_id = j.id
 union all select j.id, j.company, j.location, null::bigint from public.local_jobs j
 where nullif(btrim(j.location), '') is not null and not exists(select 1 from public.job_work_locations w where w.job_id = j.id)
), eligible as (
 select t.*, e.source_candidate_id, e.lat, e.lng, e.place_precision, e.approved_at, e.approved_by,
 row_number() over(partition by t.job_id, public.admin_location_key(t.address) order by e.approved_at desc, e.source_candidate_id desc) preference
 from targets t join location_private.eligible_memory e
 on e.company_identity = location_private.company_identity(t.company)
 and e.address_key = public.admin_location_key(t.address)
)
select * from eligible where preference = 1;
grant select on location_private.eligible_memory, location_private.valid_memory_targets, public.admin_confirmed_location_memory to location_writer;
create policy canonical_read_memory on public.admin_confirmed_location_memory for select to location_writer using(true);
create function location_private.reconcile_company(p_company text) returns integer
language plpgsql security definer set search_path=pg_catalog as $$declare j record;w record;t record;n int:=0;begin
 -- Index bounds the fanout by strict company identity, including stale descendants.
 perform pg_advisory_xact_lock(20261026,27);
 for j in select distinct x.id from public.local_jobs x
 where location_private.company_identity(x.company)=p_company
 or exists(select 1 from public.job_work_locations sw where sw.job_id=x.id and sw.point_company_key=p_company)
 order by x.id loop
  perform 1 from public.local_jobs where id=j.id for update;
  for w in select * from public.job_work_locations where job_id=j.id and point_candidate_id is not null order by id loop
   if not exists(select 1 from location_private.valid_memory_targets v where v.job_id=j.id
    and public.admin_location_key(v.address)=public.admin_location_key(w.raw_address) and v.source_candidate_id=w.point_candidate_id) then
    perform location_private.write_location(j.id,'invalidate',jsonb_build_object('address',w.raw_address));
   end if;
  end loop;
  for t in select * from location_private.valid_memory_targets where job_id=j.id order by address loop
   perform location_private.write_location(j.id,'upsert',jsonb_build_object('address',t.address,'authority','auto_reuse','memory_id',t.source_candidate_id));n:=n+1;
  end loop;
 end loop;
 return n;
end$$;
create function location_private.job_identity_changed() returns trigger language plpgsql security definer set search_path=pg_catalog as $$declare w record;begin
 if tg_op='UPDATE' and new.company is not distinct from old.company and new.location is not distinct from old.location then return null;end if;
 if tg_op='UPDATE' then
  -- Parent text changes invalidate the corresponding source, through the writer.
  for w in select * from public.job_work_locations where job_id=new.id order by id loop
   if location_private.company_identity(new.company) is distinct from location_private.company_identity(old.company)
    or (public.admin_location_key(w.raw_address)=public.admin_location_key(old.location)
      and public.admin_location_key(new.location)<>public.admin_location_key(old.location)) then
    if public.admin_location_key(w.raw_address)=public.admin_location_key(old.location)
     and nullif(btrim(new.location),'') is null then
     perform location_private.write_location(new.id,'delete',jsonb_build_object('work_location_id',w.id));
    elsif public.admin_location_key(w.raw_address)=public.admin_location_key(old.location)
     and nullif(btrim(new.location),'') is not null then
     if exists(select 1 from public.job_work_locations other where other.job_id=new.id and other.id<>w.id
      and public.admin_location_key(other.raw_address)=public.admin_location_key(new.location)) then
      perform location_private.write_location(new.id,'delete',jsonb_build_object('work_location_id',w.id));
     else
      perform location_private.write_location(new.id,'invalidate',jsonb_build_object('address',w.raw_address,'new_address',new.location));
     end if;
    else
     perform location_private.write_location(new.id,'invalidate',jsonb_build_object('address',w.raw_address));
    end if;
   end if;
  end loop;
  perform location_private.reconcile_company(location_private.company_identity(old.company));
 end if;
 perform location_private.reconcile_company(location_private.company_identity(new.company));
 return null;
end$$;
create trigger trg_01_canonical_job_identity after insert or update of company,location on public.local_jobs
 for each row execute function location_private.job_identity_changed();
-- 시험 공고: 위치 글자 = 근무지 줄 글자. 확정 줄은 운영 쓰기 함수로 만든다(Google 검증 좌표 = source_verified, 관리자 확정 = 승인 후보 + 기억표).
create or replace function public.w6_verified(p_job bigint, p_addr text, p_region jsonb default '{}') returns bigint language sql as $f$
 select location_private.write_location(p_job,'upsert',jsonb_build_object('address',p_addr,'lat',21.1,'lng',106.1,'authority','source_verified',
  'evidence',jsonb_build_object('source','Google place','checkedAt',now(),'evidence','same name one place')) || p_region) $f$;
insert into public.local_jobs(id,company,location) values
 (992001,'Công ty TNHH Sao Mai','152 Trần Hưng Đạo'),
 (992002,'Công ty TNHH Sao Mai','KCN Quế Võ'),
 (992003,'Công ty TNHH Sao Mai','KCN Quế Võ'),
 (992004,'Công ty TNHH Sao Mai','KCN Quế Võ'),
 (992005,'Công ty TNHH Sao Mai','12 Lê Lợi, Hà Nội'),
 (992006,'Công ty TNHH Sao Mai','Số 5 Nguyễn Trãi, Hà Nội'),
 (992007,'Công ty TNHH Sao Mai','Số 5 Nguyễn Trãi, Hà Nội'),
 (992008,'Công ty TNHH Sao Mai','Số 9 Lý Thái Tổ, Bắc Ninh'),
 (992009,'Công ty TNHH Sao Mai','KCN Quế Võ'),
 (992010,'Công ty TNHH Sao Mai','Trần Phú'),
 (992011,'Công ty TNHH Sao Mai','KCN Yên Phong'),
 (992012,'Công ty TNHH Sao Mai','Số 7 Ngô Gia Tự, Bắc Ninh'),
 (992013,'Công ty TNHH Sao Mai','KCN Yên Phong')
on conflict (id) do nothing;
-- 일부러 무효화하는 시험 공고는 비공개로 둔다(적용 전후 대조 public-location-diff는 공개 공고가 핀을 조용히 잃는 것만 실패로 본다 — 그 검사는 그대로).
update public.local_jobs set active=false where id in (992003,992004,992005,992007,992010,992012,992013);
select public.w6_verified(992001,'152 Trần Hưng Đạo');
select public.w6_verified(992002,'KCN Quế Võ','{"province":"Bắc Ninh","district":"Huyện Quế Võ"}');
select public.w6_verified(992003,'KCN Quế Võ','{"province":"Bắc Ninh","district":"Huyện Quế Võ"}');
select public.w6_verified(992004,'KCN Quế Võ','{"province":"Bắc Ninh","district":"Huyện Quế Võ"}');
select public.w6_verified(992005,'12 Lê Lợi, Hà Nội');
select public.w6_verified(992006,'Số 5 Nguyễn Trãi, Hà Nội');
select public.w6_verified(992007,'Số 5 Nguyễn Trãi, Hà Nội');
select location_private.write_location(992009,'upsert','{"address":"KCN Quế Võ","province":"Bắc Ninh"}');
select public.w6_verified(992010,'Trần Phú');
select public.w6_verified(992011,'KCN Yên Phong','{"province":"Bắc Ninh","district":"Huyện Yên Phong"}');
select public.w6_verified(992013,'KCN Yên Phong','{"province":"Bắc Ninh","district":"Huyện Yên Phong"}');
-- 관리자 확정 줄(992008·992012): 승인 후보 + 기억표 → admin_confirmed
insert into public.job_location_candidates(job_id,company_snapshot,address_snapshot,lat,lng,place_precision,source,evidence,status,reviewed_by,reviewed_at)
 select j.id,j.company,j.location,21.18,106.07,'site','admin','Google Maps link','approved','00000000-0000-0000-0000-000000000001',now()-interval '1 day'
 from public.local_jobs j where j.id in (992008,992012);
insert into public.admin_confirmed_location_memory(source_candidate_id,address_key,company_key,lat,lng,place_precision,approved_by,approved_at,source_address)
 select c.id,public.admin_location_key(c.address_snapshot),'sao mai',c.lat,c.lng,c.place_precision,c.reviewed_by,c.reviewed_at,c.address_snapshot
 from public.job_location_candidates c where c.job_id in (992008,992012);
select location_private.write_location(c.job_id,'upsert',jsonb_build_object('address',c.address_snapshot,'authority','admin_confirmed','candidate_id',c.id))
 from public.job_location_candidates c where c.job_id in (992008,992012) order by c.job_id;
