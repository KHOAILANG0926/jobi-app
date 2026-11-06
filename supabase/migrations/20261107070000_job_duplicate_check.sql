-- 공고 중복 판정 (Lee 2026-11-07 중복 4단계 "시작해").
-- 중복 = 같은 회사 · 같은 일 · 같은 위치 (Lee 2026-11-06). 회사 코드는 3단계 회사 코드표(job_companies).
--  - 확실한 중복이면 버린다: 비공개로 두고 "duplicate"와 어느 공고와 같은지 남긴다(원문·입구 기록은 그대로 보관).
--  - 확실히 다르면 그대로 둔다(공개).
--  - 애매하면 공개하지 않고 관리자 「분류 못 한 줄 고르기」 게시판의 중복 의심 항목으로 보낸다(Lee: 애매하면 게시판).
--    애매 = 회사는 같은데, 일(한쪽이라도 큰 분류뿐) 또는 위치(한쪽이라도 정확한 점 없음)를 확정할 수 없음.
--  - 정상 공고가 잘못 버려지면 안 된다(Lee): 셋 다 확실할 때만 버린다. 일 = 세부 직업분류 코드(4자리 이상)까지 같음,
--    위치 = 정확한 점(번지·공단 정문·관리자 확정)끼리 200m 안 또는 같은 공단.
--  - 비교 대상: 이 공고보다 먼저 등록된 공개 공고만(동시에 들어온 두 공고가 서로를 숨기지 않게).
--  - 범위: 이 규칙 적용 뒤 새로 등록되는 공고(기존 공고는 자동 작업이 건드리지 않는다). 보류 공고가 공개될 때도 같은 판정.
-- 판정은 저장 직후 위치 찾기(api/location-hook)가 회사 코드를 붙인 다음 부른다(모든 등록 경로 공통, 위치가 정해진 뒤).

do $pre$
begin
  if to_regclass('public.job_companies') is null then raise exception 'duplicate check: 회사 코드표(3단계) 없음'; end if;
  if exists (select 1 from information_schema.columns where table_schema='public' and table_name='local_jobs'
             and column_name in ('duplicate_status','duplicate_of','duplicate_reason')) then
    raise exception 'duplicate check: local_jobs 중복 칸이 이미 있음';
  end if;
end $pre$;

create schema if not exists dedupe_private;
revoke all on schema dedupe_private from public, anon, authenticated;

-- 큰 분류(업종 맞음 판단용): 소분류 업종이면 그 큰 분류, 큰 분류 업종이면 자기 자신, 이름 낱말 업종(부동산 등)은 null
alter table public.job_companies add column kind_category text;
comment on column public.job_companies.kind_category is '업종의 큰 분류(소분류면 그 위, 큰 분류면 자기). 업종 맞음: 같거나, 큰 분류↔그 아래 소분류(Lee 2026-11-06).';

-- 3단계에서 이미 등록한 회사의 큰 분류 채우기(사이트 분류표 src/data/subcategories.ts 그대로, jobIdentity.kindCategory와 같음)
update public.job_companies c set kind_category = m.cat
  from (values ('am_thuc_do_uong','am_thuc_do_uong'),('quan_ly_ban_hang','quan_ly_ban_hang'),('dich_vu','dich_vu'),('van_phong','van_phong'),('cskh_kinh_doanh','cskh_kinh_doanh'),('san_xuat_xay_dung','san_xuat_xay_dung'),('cntt_ky_thuat','cntt_ky_thuat'),('thiet_ke','thiet_ke'),('truyen_thong','truyen_thong'),('lai_xe_giao_hang','lai_xe_giao_hang'),('y_te_dieu_duong','y_te_dieu_duong'),('giao_duc_giang_day','giao_duc_giang_day'),('phuc_vu_ban','am_thuc_do_uong'),('dau_bep','am_thuc_do_uong'),('phu_bep_rua_bat','am_thuc_do_uong'),('barista','am_thuc_do_uong'),('tho_lam_banh','am_thuc_do_uong'),('quan_an_binh_dan','am_thuc_do_uong'),('nha_hang','am_thuc_do_uong'),('nha_hang_gia_dinh','am_thuc_do_uong'),('thuc_an_nhanh','am_thuc_do_uong'),('ga_ran_pizza','am_thuc_do_uong'),('quan_ca_phe','am_thuc_do_uong'),('kem_trang_mieng','am_thuc_do_uong'),('tiem_banh','am_thuc_do_uong'),('quan_bia','am_thuc_do_uong'),('bar','am_thuc_do_uong'),('suat_an_cong_nghiep','am_thuc_do_uong'),('com_hop','am_thuc_do_uong'),('thu_ngan','quan_ly_ban_hang'),('pg_pb','quan_ly_ban_hang'),('md_tmdt','quan_ly_ban_hang'),('ttm_tm','quan_ly_ban_hang'),('sieu_thi','quan_ly_ban_hang'),('cho_truyen_thong','quan_ly_ban_hang'),('cua_hang_tien_loi','quan_ly_ban_hang'),('quan_ao_trang_suc','quan_ly_ban_hang'),('my_pham_suc_khoe','quan_ly_ban_hang'),('dien_thoai_thiet_bi','quan_ly_ban_hang'),('noi_that','quan_ly_ban_hang'),('do_gia_dung','quan_ly_ban_hang'),('nha_sach_van_phong_pham','quan_ly_ban_hang'),('nong_san_thuy_san','quan_ly_ban_hang'),('cua_hang_hoa','quan_ly_ban_hang'),('phong_hoc_nhom','quan_ly_ban_hang'),('quan_net','quan_ly_ban_hang'),('karaoke','quan_ly_ban_hang'),('bowling_billiard','quan_ly_ban_hang'),('golf_man_hinh','quan_ly_ban_hang'),('phong_chieu_phim_da_nang','quan_ly_ban_hang'),('khu_vui_choi_dien_tu','quan_ly_ban_hang'),('ca_phe_chu_de','quan_ly_ban_hang'),('ca_phe_tre_em','quan_ly_ban_hang'),('sauna_spa','quan_ly_ban_hang'),('gym_the_thao','quan_ly_ban_hang'),('tram_dung_nghi','quan_ly_ban_hang'),('cong_vien_giai_tri','dich_vu'),('khach_san_resort','dich_vu'),('du_lich_cam_trai','dich_vu'),('rap_chieu_phim','dich_vu'),('trien_lam_hoi_nghi','dich_vu'),('le_tan','dich_vu'),('huong_dan_do_xe','dich_vu'),('bao_ve','dich_vu'),('cay_xang_rua_xe','dich_vu'),('cho_thue_xe','dich_vu'),('phat_to_roi','dich_vu'),('ve_sinh_don_dep','dich_vu'),('quan_ly_cho_thue_as','dich_vu'),('caddy_golf','dich_vu'),('toc_lam_dep_nail','dich_vu'),('cham_soc_da_massage','dich_vu'),('cham_soc_thu_cung','dich_vu'),('trong_tre_giup_viec','dich_vu'),('tiec_cuoi_tang_le','dich_vu'),('nhan_vien_su_kien','dich_vu'),('thuyet_minh_quang_cao','dich_vu'),('nguoi_mau_thu_do','dich_vu'),('moi_gioi_bds','dich_vu'),('tro_ly_van_phong','van_phong'),('soan_thao_van_ban','van_phong'),('thu_thap_du_lieu','van_phong'),('tro_ly_ke_toan','van_phong'),('nhan_su_hanh_chinh','van_phong'),('marketing_quang_cao','van_phong'),('marketing_sns','van_phong'),('bien_dich_phien_dich','van_phong'),('photocopy_in_an','van_phong'),('bien_tap_hieu_dinh','van_phong'),('co_quan_nha_nuoc','van_phong'),('truong_hoc_thu_vien','van_phong'),('cskh_inbound','cskh_kinh_doanh'),('telesale_outbound','cskh_kinh_doanh'),('cskh_tmdt','cskh_kinh_doanh'),('kinh_doanh_tai_chinh','cskh_kinh_doanh'),('ban_hang_truc_tiep','cskh_kinh_doanh'),('khao_sat_nghien_cuu','cskh_kinh_doanh'),('quan_ly_tong_dai','cskh_kinh_doanh'),('ho_tro_kinh_doanh','cskh_kinh_doanh'),('san_xuat_gia_cong','san_xuat_xay_dung'),('dong_goi_kiem_tra','san_xuat_xay_dung'),('xuat_nhap_kho','san_xuat_xay_dung'),('boc_xep_hang','san_xuat_xay_dung'),('nhat_hang_logistics','san_xuat_xay_dung'),('lai_xe_nang','san_xuat_xay_dung'),('khuon_mau_ep_nhua','san_xuat_xay_dung'),('san_xuat_ban_dan','san_xuat_xay_dung'),('van_hanh_may_moc','san_xuat_xay_dung'),('bao_tri_sua_chua','san_xuat_xay_dung'),('dien_co_so_vat_chat','san_xuat_xay_dung'),('van_chuyen_lap_dat','san_xuat_xay_dung'),('cong_truong_xay_dung','san_xuat_xay_dung'),('thi_cong_dien_ong_nuoc','san_xuat_xay_dung'),('noi_that_sua_chua_nha','san_xuat_xay_dung'),('nha_may_dong_tau','san_xuat_xay_dung'),('cat_may','san_xuat_xay_dung'),('len_ke_hoach_web','cntt_ky_thuat'),('quan_tri_website','cntt_ky_thuat'),('lap_trinh_vien','cntt_ky_thuat'),('lap_trinh_html','cntt_ky_thuat'),('kiem_thu_phan_mem','cntt_ky_thuat'),('he_thong_mang_bao_mat','cntt_ky_thuat'),('lap_dat_thiet_bi_so','cntt_ky_thuat'),('thiet_ke_web_mobile','thiet_ke'),('thiet_ke_do_hoa_video','thiet_ke'),('thiet_ke_san_pham','thiet_ke'),('cad_cam_noi_that','thiet_ke'),('thiet_ke_nhan_vat','thiet_ke'),('thiet_ke_thoi_trang','thiet_ke'),('dien_vien_quan_chung','truyen_thong'),('nhan_vien_hau_truong','truyen_thong'),('quay_dung_video','truyen_thong'),('chup_anh_chinh_sua','truyen_thong'),('anh_sang_am_thanh','truyen_thong'),('dai_truyen_hinh','truyen_thong'),('bao_tap_chi_xuat_ban','truyen_thong'),('van_chuyen_chuyen_nha','lai_xe_giao_hang'),('tai_xe_giao_hang','lai_xe_giao_hang'),('tai_xe_giao_dai_ly','lai_xe_giao_hang'),('xe_chuyen_dung','lai_xe_giao_hang'),('do_xe_ho','lai_xe_giao_hang'),('taxi_lai_xe_ho','lai_xe_giao_hang'),('lai_xe_buyt','lai_xe_giao_hang'),('giao_hang_nhanh','lai_xe_giao_hang'),('giao_do_an_shipper','lai_xe_giao_hang'),('giao_hang_di_bo','lai_xe_giao_hang'),('dieu_duong_y_ta','y_te_dieu_duong'),('ky_thuat_vien_y_te','y_te_dieu_duong'),('cham_soc_benh_nhan','y_te_dieu_duong'),('hanh_chinh_benh_vien','y_te_dieu_duong'),('tro_ly_khoa_kham','y_te_dieu_duong'),('ky_thuat_vien_thu_y','y_te_dieu_duong'),('tro_ly_thi_nghiem','y_te_dieu_duong'),('thu_nghiem_lam_sang','y_te_dieu_duong'),('trung_tam_luyen_thi','giao_duc_giang_day'),('trung_tam_ngoai_ngu','giao_duc_giang_day'),('trung_tam_doc_sach','giao_duc_giang_day'),('tin_hoc_cntt','giao_duc_giang_day'),('giao_vien_yoga','giao_duc_giang_day'),('hlv_the_hinh','giao_duc_giang_day'),('giao_vien_the_thao','giao_duc_giang_day'),('giao_vien_nang_khieu','giao_duc_giang_day'),('mam_non_mau_giao','giao_duc_giang_day'),('ho_tro_dua_don','giao_duc_giang_day'),('gia_su_tai_nha','giao_duc_giang_day'),('tro_giang','giao_duc_giang_day'),('trung_tam_chung_chi','giao_duc_giang_day'),('co_so_dao_tao_nghe','giao_duc_giang_day'),('ho_tro_van_hanh_trung_tam','giao_duc_giang_day'),('bien_soan_giao_trinh','giao_duc_giang_day')) as m(kind, cat)
 where c.kind = m.kind and c.kind_category is distinct from m.cat;

alter table public.local_jobs
  add column duplicate_status text check (duplicate_status in ('suspect', 'duplicate', 'cleared')),
  add column duplicate_of bigint references public.local_jobs(id) on delete set null,
  add column duplicate_reason text;
comment on column public.local_jobs.duplicate_status is
  '중복 판정(Lee 2026-11-07): duplicate=확실한 중복(비공개, 버림), suspect=애매(비공개, 관리자 게시판), cleared=관리자가 중복 아님으로 확인.';

-- 업종 맞음(src/lib/jobIdentity.ts kindsCompatible과 같은 규칙)
create function dedupe_private.kinds_compatible(a text, acat text, b text, bcat text) returns boolean
language sql immutable set search_path = pg_catalog as $$
  select case
    when a is null or b is null or a = b then true
    when a in ('cua_hang', 'quan') or b in ('cua_hang', 'quan') then true
    when a = acat and b = bcat then false                                   -- 큰 분류끼리 다름
    when a = acat then bcat is null or bcat = a                              -- 큰 분류 ↔ 그 아래 소분류
    when b = bcat then acat is null or acat = b
    else false end
$$;

-- 회사 코드 붙이기: 회사 찾기(핵심 이름 + 업종 맞음, 이름 없으면 번호) → 없으면 등록 → 이름·번호·지점 기록 → 공고에 연결.
create function public.job_identity_attach(p_job bigint, p_core text, p_kind text, p_kind_category text, p_branch text,
                                           p_name text, p_phones text[]) returns bigint
language plpgsql security definer set search_path = pg_catalog, public as $$
declare cid bigint; c record; bid bigint; ph text;
begin
  if p_core is null or p_core !~ '^[a-z0-9]+$' then raise exception 'identity: 핵심 이름 형식 오류'; end if;
  if p_core ~ '^p0[0-9]{8,10}$' then                                          -- 이름 없는 공고: 번호가 곧 회사
    select p.company_id into cid from public.job_company_phones p where p.phone = any(coalesce(p_phones, '{}')) order by p.company_id limit 1;
  end if;
  if cid is null then
    for c in select * from public.job_companies where core = p_core order by id loop
      if dedupe_private.kinds_compatible(c.kind, c.kind_category, p_kind, p_kind_category) then cid := c.id;
        -- 처음 정한 업종 기억: 큰 분류 → 그 아래 소분류로만 구체화
        if c.kind is not null and c.kind = c.kind_category and p_kind is not null and p_kind <> p_kind_category and p_kind_category = c.kind then
          update public.job_companies set kind = p_kind, kind_category = p_kind_category, updated_at = now() where id = cid;
        elsif c.kind is null and p_kind is not null then
          update public.job_companies set kind = p_kind, kind_category = p_kind_category, updated_at = now() where id = cid;
        end if;
        exit;
      end if;
    end loop;
  end if;
  if cid is null then
    insert into public.job_companies(core, kind, kind_category) values (p_core, p_kind, p_kind_category) returning id into cid;
  end if;
  if nullif(btrim(coalesce(p_name, '')), '') is not null then
    insert into public.job_company_names(company_id, raw_name) values (cid, btrim(p_name)) on conflict do nothing;
  end if;
  foreach ph in array coalesce(p_phones, '{}') loop
    if ph ~ '^0[0-9]{8,10}$' then insert into public.job_company_phones(company_id, phone) values (cid, ph) on conflict do nothing; end if;
  end loop;
  insert into public.job_company_branches(company_id, branch) values (cid, coalesce(p_branch, '')) on conflict do nothing;
  select id into bid from public.job_company_branches where company_id = cid and branch = coalesce(p_branch, '');
  update public.local_jobs set company_id = cid, company_branch_id = bid
   where id = p_job and (company_id is distinct from cid or company_branch_id is distinct from bid);
  return cid;
end $$;
revoke all on function public.job_identity_attach(bigint, text, text, text, text, text, text[]) from public, anon, authenticated;
grant execute on function public.job_identity_attach(bigint, text, text, text, text, text, text[]) to service_role;

-- 정확한 점: 번지(exact)·공단 정문(gate)·관리자 확정. (대략 위치·Google 업체 자리는 출처가 저장되지 않아 확정 못 함 → 애매)
create function dedupe_private.precise_points(p_job bigint) returns table(lat double precision, lng double precision)
language sql stable set search_path = pg_catalog, public as $$
  select w.lat, w.lng from public.job_work_locations w
   where w.job_id = p_job and w.lat is not null and w.lng is not null
     and (w.point_kind in ('exact', 'gate') or w.point_authority = 'admin_confirmed')
$$;
create function dedupe_private.meters(alat double precision, alng double precision, blat double precision, blng double precision)
returns double precision language sql immutable set search_path = pg_catalog as $$
  select 2 * 6371000 * asin(sqrt(power(sin(radians(blat - alat) / 2), 2)
       + cos(radians(alat)) * cos(radians(blat)) * power(sin(radians(blng - alng) / 2), 2)))
$$;

-- 판정만(쓰지 않음): 'duplicate' | 'suspect' | 'new' + 상대 공고 + 이유
create function dedupe_private.verdict(p_job bigint, out verdict text, out other bigint, out reason text)
language plpgsql stable set search_path = pg_catalog, public as $$
declare me record; o record; job_v text; loc_v text; my_parks text[]; o_parks text[];
begin
  verdict := 'new';
  select j.id, j.company_id, nullif(btrim(j.occupation_code), '') as occ into me from public.local_jobs j where j.id = p_job;
  if me.company_id is null then return; end if;
  select coalesce(array_agg(distinct lower(btrim(w.industrial_park))) filter (where nullif(btrim(w.industrial_park), '') is not null), '{}')
    into my_parks from public.job_work_locations w where w.job_id = p_job;
  for o in
    select j.id, nullif(btrim(j.occupation_code), '') as occ from public.local_jobs j
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

-- 판정 + 기록(저장 직후 위치 찾기가 회사 코드를 붙인 뒤 부름). 이미 판정됐거나 관리자가 확인한 공고는 건드리지 않는다.
create function public.job_duplicate_check(p_job bigint) returns text
language plpgsql security definer set search_path = pg_catalog, public as $$
declare j record; v record;
begin
  select id, duplicate_status, created_at, active, admin_hidden into j from public.local_jobs where id = p_job;
  if not found then return 'missing'; end if;
  if j.duplicate_status is not null then return 'decided:' || j.duplicate_status; end if;
  if j.created_at < timestamptz '2026-11-07 07:00:00+07' then return 'before_rule'; end if;   -- 기존 공고는 건드리지 않음
  select * into v from dedupe_private.verdict(p_job);
  if v.verdict = 'new' then return 'new'; end if;
  update public.local_jobs set duplicate_status = v.verdict, duplicate_of = v.other, duplicate_reason = v.reason, active = false
   where id = p_job;
  return v.verdict || ':' || v.other || ':' || v.reason;
end $$;
revoke all on function public.job_duplicate_check(bigint) from public, anon, authenticated;
grant execute on function public.job_duplicate_check(bigint) to service_role;

-- 비공개 유지: 중복·의심 공고는 다른 작업이 공개로 바꿔도 비공개로 남는다. 보류였다가 공개되는 순간에도 같은 판정.
create function dedupe_private.hold_on_publish() returns trigger
language plpgsql security definer set search_path = pg_catalog, public as $$
declare v record;
begin
  if tg_op = 'INSERT' then
    -- 등록 때 판정 칸은 받지 않는다(입구·화면이 써 넣지 못하게)
    new.duplicate_status := null; new.duplicate_of := null; new.duplicate_reason := null;
    return new;
  end if;
  if new.active and not coalesce(old.active, false) then
    if new.duplicate_status in ('suspect', 'duplicate') then new.active := false; return new; end if;
    if new.duplicate_status is null and new.company_id is not null and new.created_at >= timestamptz '2026-11-07 07:00:00+07' then
      select * into v from dedupe_private.verdict(new.id);
      if v.verdict <> 'new' then
        new.active := false; new.duplicate_status := v.verdict; new.duplicate_of := v.other; new.duplicate_reason := v.reason;
      end if;
    end if;
  end if;
  return new;
end $$;
create trigger trg_zzzzz_duplicate_hold before insert or update of active, duplicate_status on public.local_jobs
  for each row execute function dedupe_private.hold_on_publish();

-- 관리자 결정(게시판 버튼): not_duplicate → 중복 아님(공개 시도, 다른 공개 규칙은 그대로), duplicate → 버림(비공개 유지)
create function public.job_duplicate_decide(p_job bigint, p_decision text) returns text
language plpgsql security definer set search_path = pg_catalog, public as $$
declare st text;
begin
  if not (current_user in ('postgres', 'supabase_admin', 'service_role') or (auth.uid() is not null and public.is_admin())) then
    raise exception 'duplicate decide: 관리자만' using errcode = 'insufficient_privilege';
  end if;
  select duplicate_status into st from public.local_jobs where id = p_job;
  if st is distinct from 'suspect' then raise exception 'duplicate decide: 중복 의심 공고가 아님'; end if;
  if p_decision = 'not_duplicate' then
    update public.local_jobs set duplicate_status = 'cleared', duplicate_reason = coalesce(duplicate_reason, '') || ':admin_not_duplicate' where id = p_job;
    update public.local_jobs set active = true where id = p_job;
    return 'cleared';
  elsif p_decision = 'duplicate' then
    update public.local_jobs set duplicate_status = 'duplicate', duplicate_reason = coalesce(duplicate_reason, '') || ':admin_duplicate', active = false where id = p_job;
    return 'duplicate';
  end if;
  raise exception 'duplicate decide: 알 수 없는 결정 %', p_decision;
end $$;
revoke all on function public.job_duplicate_decide(bigint, text) from public, anon;
grant execute on function public.job_duplicate_decide(bigint, text) to authenticated, service_role;

revoke all on all functions in schema dedupe_private from public, anon, authenticated;
