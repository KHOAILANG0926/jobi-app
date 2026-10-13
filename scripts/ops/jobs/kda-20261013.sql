-- KDA · KCN Yên Phong 포스터 공고 (사용자 제공 포스터 + 게시글 상단 연락처, 2026-10-13)
-- 규칙 트리거를 그대로 거친다. images가 있으므로 R7이 OCR 대조 'ok' 전까지 비공개로 강제하고,
-- job-ocr-check.yml이 포스터를 따로 읽어 대조한 뒤 통과하면 자동 공개한다.
with j as (
  insert into public.local_jobs (
    title, company, origin, source, active, admin_hidden,
    source_text, images, contact_name, age_min, age_max,
    location, description,
    salary, salary_min, salary_max, salary_currency, salary_period,
    shuttle_bus, employer_phone
  ) values (
    'CTY KDA tuyển nam, nữ làm linh kiện tai nghe tại KCN Yên Phong',
    'CTY KDA',
    'admin',
    'manual:poster',
    true,
    false,
    E'Liên hệ 08.778.807.56 ( NGOC ANH DUONG)\n\nKCN YÊN PHONG\nCTY KDA\nTUYỂN FULL\nNAM , NỮ (14-50t)\nLàm ngồi linh kiện tai nghe\nMỨC LƯƠNG\nCa ngày: 310k/11h\nCa đếm: 360k/11h\nChuyên cần 50k/tuần\nLương tính và thanh toán theo ngày\nCó xe đưa đón\nĐược mang điện thoại vào xưởng\nThu nhập ổn định\nCông việc lâu dài!\nMôi trường sạch sẽ\n- Quy trình rõ ràng\n- Công việc ổn định\nNhanh tay ứng tuyển để có công việc tốt nhé!\nLiên hệ: 0877 880 756',
    '["kda/kda-20261013.png"]'::jsonb,
    'NGOC ANH DUONG',
    14, 50,
    'KCN Yên Phong, Bắc Ninh',
    E'Công việc\n- Làm ngồi linh kiện tai nghe.\n\nYêu cầu\n- Tuyển nam, nữ (14-50 tuổi).\n\nLương và phúc lợi\n- Ca ngày: 310k/11h.\n- Ca đêm: 360k/11h.\n- Chuyên cần: 50k/tuần.\n- Lương tính và thanh toán theo ngày.\n- Có xe đưa đón.\n- Được mang điện thoại vào xưởng.\n\nĐịa điểm làm việc\n- KCN Yên Phong, Bắc Ninh.\n\nLiên hệ\n- NGOC ANH DUONG: 0877 880 756',
    '310k/11h ca ngày, 360k/11h ca đêm',
    310000, 360000, 'VND', 'day',
    true,
    '0877880756'
  )
  returning id
)
insert into public.job_work_locations (job_id, raw_address, province, industrial_park, address_evidence)
select id, 'KCN YÊN PHONG', 'Bắc Ninh', 'KCN Yên Phong',
       'Poster chỉ ghi "KCN YÊN PHONG", không có địa chỉ nhà xưởng.'
from j
returning job_id;
