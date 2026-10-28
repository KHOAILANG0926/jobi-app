-- Lee 2026-10-28: one announcement, two role-specific sets of conditions.
-- Normal migrations-apply path; rule migration must precede this one.
-- No capture/publication timestamp, fabricated image/URL or unverified coordinates.
-- Official 9402 (Người phụ bếp) covers CÔ RỬA BÁT, the first role.
-- Official 5131 (Bồi bàn) also reviewed for CHẠY BÀN; the single stored code does not classify both roles.
begin;
do $register$
declare target bigint; matches integer;
begin
 if not exists(select 1 from public.job_posting_rules where rule_key='R3_source_evidence_required' and content like '%Lee 확인%') then
  raise exception 'Bomunttl preflight: Lee source rule not applied';
 end if;
 if not exists(select 1 from public.occupation_master where code='9402' and level=4 and name_vi='Người phụ bếp')
 or not exists(select 1 from public.occupation_master where code='5131' and level=4 and name_vi='Bồi bàn') then
  raise exception 'Bomunttl preflight: official occupations missing or changed';
 end if;
 select count(*),min(id) into matches,target from public.local_jobs
 where company='Bomunttl' and public.job_phone_digits(employer_phone)='0365447485';
 if matches>1 then raise exception 'Bomunttl conflict: multiple existing announcements'; end if;
 if matches=1 then
  if not exists(select 1 from public.local_jobs where id=target
   and source='Lee 확인(원문 Facebook, 작성자 Ngọc Mai) · Lee 제공 포스터에서 옮김'
   and source_text='Bomunttl
Nhà hàng nướng
Ngô Tất Tố - TP. Bắc Ninh
TUYỂN NHÂN SỰ NHÀ HÀNG
Bạn đang tìm một công việc ổn định – vui vẻ – thu nhập tốt?
Chúng tôi đang cần bạn!
CÔ RỬA BÁT FULL TIME
(tg: 10h - 10h)
Lương thỏa thuận + thưởng
Tháng nghỉ 4 ngày
Nghỉ trưa hơn 2 tiếng
Bao ăn 2 bữa
Được thưởng vào các ngày lễ
Hết khách sớm được về sớm, ít tăng ca
NHÂN VIÊN NAM/NỮ CHẠY BÀN PART TIME
(tg: 17h - 22h)
Mức lương: 30k-35k/ 1h
+ thưởng + tip
Yêu cầu: nhanh nhẹn, dễ hòa nhập, có ý thức trong công việc
Ưu tiên ứng viên có kinh nghiệm phục vụ nhà hàng
QUYỀN LỢI:
Môi trường làm việc vui vẻ – thân thiện
Ổn định, lâu dài
Được đào tạo khi chưa có kinh nghiệm
Liên hệ ngay: 0365 447 485
Gia nhập đội ngũ Bomunttl ngay thôi!
Ứng tuyển sớm để giữ chỗ!' and description='Công việc
CÔ RỬA BÁT FULL TIME
NHÂN VIÊN NAM/NỮ CHẠY BÀN PART TIME
Yêu cầu
NHÂN VIÊN NAM/NỮ CHẠY BÀN PART TIME — Yêu cầu: nhanh nhẹn, dễ hòa nhập, có ý thức trong công việc
NHÂN VIÊN NAM/NỮ CHẠY BÀN PART TIME — Ưu tiên ứng viên có kinh nghiệm phục vụ nhà hàng
Thời gian làm việc
CÔ RỬA BÁT FULL TIME — (tg: 10h - 10h)
CÔ RỬA BÁT FULL TIME — Tháng nghỉ 4 ngày
CÔ RỬA BÁT FULL TIME — Nghỉ trưa hơn 2 tiếng
CÔ RỬA BÁT FULL TIME — Hết khách sớm được về sớm, ít tăng ca
NHÂN VIÊN NAM/NỮ CHẠY BÀN PART TIME — (tg: 17h - 22h)
Thu nhập
CÔ RỬA BÁT FULL TIME — Lương thỏa thuận + thưởng
CÔ RỬA BÁT FULL TIME — Được thưởng vào các ngày lễ
NHÂN VIÊN NAM/NỮ CHẠY BÀN PART TIME — Mức lương: 30k-35k/ 1h
NHÂN VIÊN NAM/NỮ CHẠY BÀN PART TIME — + thưởng + tip
Quyền lợi
CÔ RỬA BÁT FULL TIME — Bao ăn 2 bữa
Môi trường làm việc vui vẻ – thân thiện
Ổn định, lâu dài
Được đào tạo khi chưa có kinh nghiệm
Quy trình tuyển dụng
Gia nhập đội ngũ Bomunttl ngay thôi!
Ứng tuyển sớm để giữ chỗ!
Thông tin khác
Nhà hàng nướng
TUYỂN NHÂN SỰ NHÀ HÀNG
Bạn đang tìm một công việc ổn định – vui vẻ – thu nhập tốt?
Chúng tôi đang cần bạn!'
   and category='am_thuc_do_uong' and posted_at is null and title='Bomunttl tuyển cô rửa bát full time và nhân viên chạy bàn part time' and origin='admin' and occupation_code='9402'
   and occupation_evidence='CÔ RỬA BÁT' and salary='Theo vị trí — xem chi tiết'
   and salary_min is null and salary_max is null and hours is null
   and meal_provided is null and location='Ngô Tất Tố - TP. Bắc Ninh') then
   raise exception 'Bomunttl conflict: existing content differs; entire transaction cancelled';
  end if;
  return;
 end if;
 insert into public.local_jobs(title,company,category,origin,source,source_text,source_url,images,
  description,posted_at,salary,salary_min,salary_max,salary_currency,salary_period,
  employer_phone,contact_zalo,contact_name,location,hours,meal_provided,
  occupation_code,occupation_evidence,active,admin_hidden)
 values('Bomunttl tuyển cô rửa bát full time và nhân viên chạy bàn part time','Bomunttl','am_thuc_do_uong','admin',
  'Lee 확인(원문 Facebook, 작성자 Ngọc Mai) · Lee 제공 포스터에서 옮김','Bomunttl
Nhà hàng nướng
Ngô Tất Tố - TP. Bắc Ninh
TUYỂN NHÂN SỰ NHÀ HÀNG
Bạn đang tìm một công việc ổn định – vui vẻ – thu nhập tốt?
Chúng tôi đang cần bạn!
CÔ RỬA BÁT FULL TIME
(tg: 10h - 10h)
Lương thỏa thuận + thưởng
Tháng nghỉ 4 ngày
Nghỉ trưa hơn 2 tiếng
Bao ăn 2 bữa
Được thưởng vào các ngày lễ
Hết khách sớm được về sớm, ít tăng ca
NHÂN VIÊN NAM/NỮ CHẠY BÀN PART TIME
(tg: 17h - 22h)
Mức lương: 30k-35k/ 1h
+ thưởng + tip
Yêu cầu: nhanh nhẹn, dễ hòa nhập, có ý thức trong công việc
Ưu tiên ứng viên có kinh nghiệm phục vụ nhà hàng
QUYỀN LỢI:
Môi trường làm việc vui vẻ – thân thiện
Ổn định, lâu dài
Được đào tạo khi chưa có kinh nghiệm
Liên hệ ngay: 0365 447 485
Gia nhập đội ngũ Bomunttl ngay thôi!
Ứng tuyển sớm để giữ chỗ!',null,'[]'::jsonb,
  'Công việc
CÔ RỬA BÁT FULL TIME
NHÂN VIÊN NAM/NỮ CHẠY BÀN PART TIME
Yêu cầu
NHÂN VIÊN NAM/NỮ CHẠY BÀN PART TIME — Yêu cầu: nhanh nhẹn, dễ hòa nhập, có ý thức trong công việc
NHÂN VIÊN NAM/NỮ CHẠY BÀN PART TIME — Ưu tiên ứng viên có kinh nghiệm phục vụ nhà hàng
Thời gian làm việc
CÔ RỬA BÁT FULL TIME — (tg: 10h - 10h)
CÔ RỬA BÁT FULL TIME — Tháng nghỉ 4 ngày
CÔ RỬA BÁT FULL TIME — Nghỉ trưa hơn 2 tiếng
CÔ RỬA BÁT FULL TIME — Hết khách sớm được về sớm, ít tăng ca
NHÂN VIÊN NAM/NỮ CHẠY BÀN PART TIME — (tg: 17h - 22h)
Thu nhập
CÔ RỬA BÁT FULL TIME — Lương thỏa thuận + thưởng
CÔ RỬA BÁT FULL TIME — Được thưởng vào các ngày lễ
NHÂN VIÊN NAM/NỮ CHẠY BÀN PART TIME — Mức lương: 30k-35k/ 1h
NHÂN VIÊN NAM/NỮ CHẠY BÀN PART TIME — + thưởng + tip
Quyền lợi
CÔ RỬA BÁT FULL TIME — Bao ăn 2 bữa
Môi trường làm việc vui vẻ – thân thiện
Ổn định, lâu dài
Được đào tạo khi chưa có kinh nghiệm
Quy trình tuyển dụng
Gia nhập đội ngũ Bomunttl ngay thôi!
Ứng tuyển sớm để giữ chỗ!
Thông tin khác
Nhà hàng nướng
TUYỂN NHÂN SỰ NHÀ HÀNG
Bạn đang tìm một công việc ổn định – vui vẻ – thu nhập tốt?
Chúng tôi đang cần bạn!',null,'Theo vị trí — xem chi tiết',null,null,'VND',null,
  '0365447485',null,null,'Ngô Tất Tố - TP. Bắc Ninh',null,null,
  '9402','CÔ RỬA BÁT',true,false) returning id into target;
 -- Preserve source address only. Actual source-backed street point can be confirmed later.
 perform location_private.write_location(target,'upsert',jsonb_build_object(
  'raw_address','Ngô Tất Tố - TP. Bắc Ninh','province','Bắc Ninh','country','VN',
  'authority','unresolved','address_evidence','Lee 제공 포스터: Ngô Tất Tố - TP. Bắc Ninh; 번지 없음. 상호명+도로 위치 관리자 확인 대기.'));
end $register$;
commit;
