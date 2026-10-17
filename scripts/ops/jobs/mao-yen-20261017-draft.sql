begin;
insert into public.local_jobs(title,company,origin,source,source_url,source_text,description,
 category,occupation_code,occupation_evidence,salary,salary_min,salary_currency,salary_period,
 salary_note,location,hours,employer_phone,images,image_url,active,admin_hidden,posted_at)
select 'Tuyển công nhân sản xuất dây truyền dữ liệu, dây mạng','','admin',
 'manual:poster:20261017-070909','https://raw.githubusercontent.com/KHOAILANG0926/jobi-app/6f05097cf8386442f3a11c087a23257dcbe989ab/scripts/ops/jobs/mao-yen-20261017.png','TUYỂN CÔNG NHÂN
CHÍNH THỨC & THỜI VỤ
Gắn bó lâu dài
Việc làm ổn định
Thu nhập tốt
Môi trường thoải mái
MỨC LƯƠNG & PHỤ CẤP
Lương cơ bản: 5.500.000đ/tháng
Phụ cấp: 1.200.000đ/tháng
Thâm niên sau 2 tháng: +200.000đ
Thâm niên sau 4 tháng: +300.000đ
CÔNG VIỆC
Sản xuất dây truyền dữ liệu, dây mạng.
QUYỀN LỢI & MÔI TRƯỜNG LÀM VIỆC
Chuyên ca ngày.
Làm ngồi, thoải mái.
Không bắt buộc tăng ca.
Tuyển cả công nhân chính thức và thời vụ, ưu tiên người muốn làm lâu dài.
YÊU CẦU
Nhanh nhẹn, chăm chỉ, chịu khó.
Có tinh thần trách nhiệm trong công việc.
THÔNG TIN CÔNG TY
ĐỊA CHỈ
Khu phố Mao Yên, phường Phương Liễu, Bắc Ninh.
LIÊN HỆ
0342017663
Ai có nhu cầu tìm việc, vui lòng liên hệ trực tiếp để trao đổi và nhận việc nhé!
Mọi người chia sẻ giúp để ai đang cần việc làm biết đến ạ!','## Công việc
- Sản xuất dây truyền dữ liệu, dây mạng.
## Yêu cầu
- Nhanh nhẹn, chăm chỉ, chịu khó.
- Có tinh thần trách nhiệm trong công việc.
## Thời gian làm việc
- Chuyên ca ngày.
- Tuyển cả công nhân chính thức và thời vụ, ưu tiên người muốn làm lâu dài.
## Lương và phúc lợi
- Lương cơ bản: 5.500.000đ/tháng.
- Phụ cấp: 1.200.000đ/tháng.
- Thâm niên sau 2 tháng: +200.000đ; sau 4 tháng: +300.000đ.
- Làm ngồi, thoải mái. Không bắt buộc tăng ca.
## Địa điểm làm việc
- Khu phố Mao Yên, phường Phương Liễu, Bắc Ninh.
## Liên hệ
- Điện thoại: 0342017663.',
 'san_xuat_xay_dung',null,null,'5.500.000đ/tháng',5500000,'VND','month',
 'Phụ cấp: 1.200.000đ/tháng; thâm niên sau 2 tháng: +200.000đ, sau 4 tháng: +300.000đ.',
 'Khu phố Mao Yên, phường Phương Liễu, Bắc Ninh','Chuyên ca ngày','0342017663',
 '["https://raw.githubusercontent.com/KHOAILANG0926/jobi-app/6f05097cf8386442f3a11c087a23257dcbe989ab/scripts/ops/jobs/mao-yen-20261017.png","https://raw.githubusercontent.com/KHOAILANG0926/jobi-app/6f05097cf8386442f3a11c087a23257dcbe989ab/scripts/ops/jobs/mao-yen-20261017-source.png"]'::jsonb,'https://raw.githubusercontent.com/KHOAILANG0926/jobi-app/6f05097cf8386442f3a11c087a23257dcbe989ab/scripts/ops/jobs/mao-yen-20261017.png',false,false,current_date
where not exists(select 1 from public.local_jobs where source='manual:poster:20261017-070909');
commit;
select id,title,active,admin_hidden,occupation_code,
 public.job_occupation_publish_reason(occupation_code,occupation_evidence,source_text) as occupation_review
from public.local_jobs where source='manual:poster:20261017-070909';