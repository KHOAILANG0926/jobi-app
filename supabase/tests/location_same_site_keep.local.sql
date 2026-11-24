-- 20261124150000 시험(폐기용 DB): 같은 사업장 확정 좌표는 표기 변경으로 지워지지 않고, 실제 이전·다른 지점은 기존대로 무효화된다.
do $t$ declare n int;
 function_ok boolean;
begin
 -- 판정 함수: 번지 규칙(기존) + 번지 없는 주소는 '지역만 덧붙음'일 때만
 if not location_private.same_site_address('152 Trần Hưng Đạo','152 Trần Hưng Đạo, TP. Bắc Ninh, Bắc Ninh',null) then raise exception 'numbered prefix must match'; end if;
 if location_private.same_site_address('12 Lê Lợi','112 Lê Lợi',null) then raise exception '12 vs 112 must differ'; end if;
 if not location_private.same_site_address('KCN Quế Võ','KCN Quế Võ, Huyện Quế Võ, Bắc Ninh',array['Bắc Ninh','Huyện Quế Võ']) then raise exception 'region-only tail must match'; end if;
 if not location_private.same_site_address('KCN Quế Võ, Bắc Ninh','KCN Quế Võ',array['Bắc Ninh']) then raise exception 'region-only tail must match both ways'; end if;
 if location_private.same_site_address('KCN Quế Võ','KCN Quế Võ 2, Bắc Ninh',array['Bắc Ninh','Huyện Quế Võ']) then raise exception 'park suffix number is another park'; end if;
 if location_private.same_site_address('KCN Quế Võ','KCN Quế Võ mở rộng, Bắc Ninh',array['Bắc Ninh']) then raise exception 'park extension is another site'; end if;
 if location_private.same_site_address('KCN Quế Võ','KCN Quế Võ, Bắc Ninh',null) then raise exception 'unknown region must not be assumed'; end if;
 if location_private.same_site_address('KCN Quế Võ','Lô A2 KCN Quế Võ, Bắc Ninh',array['Bắc Ninh']) then raise exception 'same park name alone is not the same site'; end if;
 if location_private.same_site_address('KCN Quế Võ, Bắc Ninh','KCN Yên Phong, Bắc Ninh',array['Bắc Ninh']) then raise exception 'different parks in one province'; end if;
 if location_private.same_site_address('KCN Yên','KCN Yên Phong',array['Huyện Yên Phong']) then raise exception 'partial region word must not match'; end if;

 -- 1) 번지 주소 + 지역 덧붙임: 확정 좌표 유지, 줄 글자 그대로
 update public.local_jobs set location='152 Trần Hưng Đạo, TP. Bắc Ninh, Bắc Ninh' where id=992001;
 if not exists(select 1 from public.job_work_locations where job_id=992001 and lat is not null and location_verified and raw_address='152 Trần Hưng Đạo') then raise exception '1: numbered same site lost its confirmed point'; end if;
 -- 2) 번지 없는 공단 주소 + 저장된 지역만 덧붙음: 유지
 update public.local_jobs set location='KCN Quế Võ, Huyện Quế Võ, Bắc Ninh' where id=992002;
 if not exists(select 1 from public.job_work_locations where job_id=992002 and lat is not null and location_verified) then raise exception '2: park address with region tail lost its confirmed point'; end if;
 -- 3) 같은 공단 이름이지만 로트가 붙음: 같은 사업장으로 보지 않는다 → 기존대로 무효화
 update public.local_jobs set location='Lô A2 KCN Quế Võ, Bắc Ninh' where id=992003;
 if exists(select 1 from public.job_work_locations where job_id=992003 and lat is not null) then raise exception '3: park name alone kept a point'; end if;
 -- 4) 공단 번호가 다름: 무효화
 update public.local_jobs set location='KCN Quế Võ 2, Bắc Ninh' where id=992004;
 if exists(select 1 from public.job_work_locations where job_id=992004 and lat is not null) then raise exception '4: different park kept a point'; end if;
 -- 5) 실제 이전(다른 주소): 무효화, 줄 글자는 새 주소
 update public.local_jobs set location='99 Hai Bà Trưng, Hà Nội' where id=992005;
 if not exists(select 1 from public.job_work_locations where job_id=992005 and lat is null and point_kind='unresolved' and raw_address='99 Hai Bà Trưng, Hà Nội') then raise exception '5: relocation must invalidate'; end if;
 -- 6) 회사 이름 표기만 바뀜(성조·대소문자·문장부호): 검증 좌표 유지
 update public.local_jobs set company='CONG TY TNHH SAO MAI.' where id=992006;
 if not exists(select 1 from public.job_work_locations where job_id=992006 and lat is not null and location_verified) then raise exception '6: company notation change lost the point'; end if;
 -- 7) 회사가 실제로 바뀜: 무효화
 update public.local_jobs set company='Công ty TNHH Hoa Sen' where id=992007;
 if exists(select 1 from public.job_work_locations where job_id=992007 and lat is not null) then raise exception '7: different company kept a point'; end if;
 -- 8) 관리자 확정 줄: 회사 표기 변경·주소 지역 덧붙임 모두 유지(회사 재확인이 기존대로 재사용 표시로 다시 쓰므로 권한 표시는 둘 다 허용), 실제 다른 회사면 무효화
 update public.local_jobs set company='Cong ty TNHH Sao Mai' where id=992008;
 if not exists(select 1 from public.job_work_locations where job_id=992008 and lat is not null and point_authority in ('admin_confirmed','auto_reuse') and point_candidate_id is not null) then raise exception '8a: admin row lost on company notation change'; end if;
 update public.local_jobs set location='Số 9 Lý Thái Tổ, Bắc Ninh, Việt Nam' where id=992008;
 if not exists(select 1 from public.job_work_locations where job_id=992008 and lat is not null and point_authority in ('admin_confirmed','auto_reuse') and raw_address='Số 9 Lý Thái Tổ, Bắc Ninh') then raise exception '8b: admin row lost on address notation change'; end if;
 update public.local_jobs set company='Công ty Khác' where id=992012;
 if exists(select 1 from public.job_work_locations where job_id=992012 and lat is not null) then raise exception '8c: admin row kept for a different company'; end if;
 -- 9) 확정이 아닌 줄: 기존대로(무효화 + 새 글자)
 update public.local_jobs set location='KCN Quế Võ, Bắc Ninh' where id=992009;
 if not exists(select 1 from public.job_work_locations where job_id=992009 and lat is null and raw_address='KCN Quế Võ, Bắc Ninh') then raise exception '9: unconfirmed row must follow the existing path'; end if;
 -- 10) 번지 없는 주소에 지역 정보가 줄에 없으면 추정하지 않는다 → 무효화
 update public.local_jobs set location='Trần Phú, Bắc Ninh' where id=992010;
 if exists(select 1 from public.job_work_locations where job_id=992010 and lat is not null) then raise exception '10: unknown region tail kept a point'; end if;
 -- 11) 다시 수집 쓰기(replace)도 같은 판정: 번지 없는 공단 주소 + 지역 덧붙임은 확정 줄을 그대로 쓴다(새 줄·삭제 없음)
 perform location_private.write_location(992011,'replace','[{"address":"KCN Yên Phong, Huyện Yên Phong, Bắc Ninh"}]'::jsonb);
 select count(*) into n from public.job_work_locations where job_id=992011;
 if n<>1 or not exists(select 1 from public.job_work_locations where job_id=992011 and lat is not null and location_verified and raw_address='KCN Yên Phong') then raise exception '11: recollect lost the confirmed park row (rows %)', n; end if;
 perform location_private.write_location(992013,'replace','[{"address":"KCN Yên Phong mở rộng, Bắc Ninh"}]'::jsonb);
 if exists(select 1 from public.job_work_locations where job_id=992013 and lat is not null) then raise exception '11b: another park site reused the confirmed row'; end if;
end $t$;
