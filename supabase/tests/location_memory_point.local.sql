-- 시험 DB 전용 확인(폐기용 DB). 한 트랜잭션 안에서 시험 자료를 넣고 끝에 되돌린다.
begin;
insert into public.local_jobs(id, company, location) values
 (990001, 'Công ty TNHH Alpha', 'Lô A1 KCN Quế Võ, Bắc Ninh'),
 (990002, 'Công ty TNHH Beta', 'Số 5 Lý Thái Tổ, Bắc Ninh'),
 (990003, 'công ty tnhh  Alpha', 'Lô A1, KCN Quế Võ - Bắc Ninh'),
 (990004, 'Công ty TNHH Alpha', 'Lô B2 KCN Quế Võ, Bắc Ninh');
insert into public.job_location_candidates(job_id, company_snapshot, address_snapshot, lat, lng, place_precision, evidence, status, reviewed_by, reviewed_at)
values
 (990001, 'Công ty TNHH Alpha', 'Lô A1 KCN Quế Võ, Bắc Ninh', 21.15, 106.15, 'building', 'Google Maps link', 'approved', '00000000-0000-0000-0000-000000000001', '2026-11-01 00:00+00'),
 (990002, 'Công ty TNHH Beta', 'Số 5 Lý Thái Tổ, Bắc Ninh', 21.18, 106.07, 'building', 'Google Maps link', 'approved', '00000000-0000-0000-0000-000000000001', '2026-11-01 00:00+00');
insert into public.admin_confirmed_location_memory(source_candidate_id, address_key, company_key, lat, lng, place_precision, approved_by, approved_at, source_address, active)
select c.id, public.admin_location_key(c.address_snapshot), public.admin_location_key(c.company_snapshot), c.lat, c.lng, c.place_precision,
 c.reviewed_by, c.reviewed_at, c.address_snapshot, c.job_id = 990001
from public.job_location_candidates c where c.job_id in (990001, 990002);
do $$
declare n int;
begin
 -- 같은 회사 + 같은 주소(띄어쓰기·대소문자·성조만 다름) → 확정 위치 1곳
 select count(*) into n from public.location_memory_point('Công ty TNHH Alpha', array['lô a1  KCN Que Vo, Bac Ninh']);
 if n <> 1 then raise exception 'same company + same address must match (got %)', n; end if;
 -- 같은 회사 다른 지점(주소 다름) → 맞지 않음
 select count(*) into n from public.location_memory_point('Công ty TNHH Alpha', array['Lô B2 KCN Quế Võ, Bắc Ninh']);
 if n <> 0 then raise exception 'other branch address must not match (got %)', n; end if;
 -- 다른 회사 같은 주소 → 맞지 않음
 select count(*) into n from public.location_memory_point('Công ty TNHH Gamma', array['Lô A1 KCN Quế Võ, Bắc Ninh']);
 if n <> 0 then raise exception 'other company must not match (got %)', n; end if;
 -- 기억표에서 꺼진(active=false) 확정 → 맞지 않음
 select count(*) into n from public.location_memory_point('Công ty TNHH Beta', array['Số 5 Lý Thái Tổ, Bắc Ninh']);
 if n <> 0 then raise exception 'inactive memory must not match (got %)', n; end if;
 -- 빈 회사·빈 주소 → 맞지 않음
 select count(*) into n from public.location_memory_point('', array['Lô A1 KCN Quế Võ, Bắc Ninh']);
 if n <> 0 then raise exception 'empty company must not match'; end if;
 select count(*) into n from public.location_memory_point('Công ty TNHH Alpha', array['', '  ']);
 if n <> 0 then raise exception 'empty address must not match'; end if;
 -- 등록 뒤 자동 재사용(view)과 위치 확인 조회가 같은 자격·같은 확정 위치를 고른다
 select count(*) into n from location_private.valid_memory_targets where job_id = 990003;
 if n <> 1 then raise exception 'new job with same company+address must get reuse target (got %)', n; end if;
 select count(*) into n from location_private.valid_memory_targets where job_id = 990004;
 if n <> 0 then raise exception 'other branch job must not get reuse target (got %)', n; end if;
 select count(*) into n from location_private.valid_memory_targets t
  where not exists(select 1 from public.location_memory_point(t.company, array[t.address]) p where p.candidate_id = t.source_candidate_id);
 if n <> 0 then raise exception 'view and precheck lookup disagree (% rows)', n; end if;
end $$;
rollback;
