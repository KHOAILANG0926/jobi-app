# #717 B안 — 업직종 선택 ↔ 공식 직업분류 대응표 (초안)

- 작성: 2026-11-25, 이슈 #717 B안(Lee 지시 "기존 공식 직업분류 코드를 활용한 업직종 대응표 초안을 준비한다").
- 상태: **초안(DRAFT)**. 코드·DB·화면 변경 없음. 이 표는 시행된 규칙이 아니다.

## 1. 목적과 원칙

- 고용주 작성 화면(`src/pages/PostJob.tsx` CategoryPicker)의 대분류(`src/data/categories.ts`)·소분류(`src/data/subcategories.ts`) 선택에 대해, 이미 있는 공식 직업분류(QĐ 34/2020, `occupation_master`, seed `supabase/migrations/20261015100100_occupation_master_seed.sql`)에서 **후보** 코드를 미리 찾아 둔다.
- **선택만으로 코드를 확정하지 않는다.** 근거는 여전히 고용주가 쓴 업무 내용(Nội dung công việc) 원문이며, 공개 판정은 기존 그대로다:
  - `job_occupation_publish_reason()`(최신 `20261018090000_occupation_code_any_level.sql`): 코드 없음 / `occupation_master`에 없는 코드 / `occupation_evidence` 없음 / `source_text` 없음 / 근거가 원문에 없음 → 비공개. 1~5단계 모두 허용.
  - `trg_zzzz_occupation_publication`·R8(`local_jobs_occupation_r8`) 변경 없음.
- 후보 코드와 `name_vi`는 seed에서 그대로 복사했다(158개 소분류의 모든 후보 코드를 seed와 기계 대조, 없는 코드 0건). 새 코드·새 명칭 없음.
- 업무 내용이 받쳐 주는 가장 높은(넓은) 단계까지만 쓴다(CLAUDE.md 「공고 등록 전 직업분류 확인」). 표의 단계(L1~L5)는 "선택+업무 내용이 일치할 때 최대"이지 기본값이 아니다.
- 역방향 대조: DB는 코드에서 메뉴 칸을 다시 계산해 덮어쓴다(`trg_00/zzzy_occupation_category` → `category_for_job()` → `category_for_occupation()`, 규칙 원본 `data/occupations/category_rules.json`, 가장 긴 앞자리 일치). 코드 `5`는 `ocr_check.business_type.kind`(fnb→am_thuc_do_uong, retail→quan_ly_ban_hang, 그 밖→dich_vu)로 정한다(`20261101200000_business_kind_category.sql`). 표의 `⚠→칸`은 그 코드를 넣으면 고용주가 고른 대분류가 아니라 그 칸으로 바뀐다는 뜻이다.

판정 기호: **A** 단일 후보(그 단계까지만) / **B** 상위 코드만(세부는 업무 내용 필요) / **C** 후보 여러 개·대표 확인 필요 / **D** 직업이 아니라 업장 종류(업무 내용으로만 판정).
D 줄의 `5`는 CLAUDE.md 2026-11-01 Wallace 예외(업무 미기재 가게 공고 → 코드 5)를 따를 때만 쓸 수 있는 최상위 후보이며, 그 예외의 업종 확인 근거(가게 낱말·Google 업체 종류·검색 인용)와 `business_type`이 필요하다. 선택만으로는 붙이지 않는다.

## 2. 대응표 (소분류 158개 + khac)

### am_thuc_do_uong

| 대분류 | 소분류 | 표시 이름 | 후보 공식 코드 · name_vi (단계) | 판정 | 비고 |
|---|---|---|---|---|---|
| am_thuc_do_uong | phuc_vu_ban | Phục vụ bàn | 5131 Bồi bàn (L4) | A 단일 후보(그 단계까지만) | 5단계(51311~51313)는 업무 내용 필요 |
| am_thuc_do_uong | dau_bep | Đầu bếp · Phụ bếp chính | 5120 Đầu bếp (L4)<br>3434 Đầu bếp trưởng (L4) | C 후보 여러 개·대표 확인 필요 | 일반 요리사 vs 주방장 |
| am_thuc_do_uong | phu_bep_rua_bat | Phụ bếp · Rửa bát | 9402 Người phụ bếp (L4) | A 단일 후보(그 단계까지만) | Rửa bát 단독 업무가 9402에 드는지 대표 확인 |
| am_thuc_do_uong | barista | Pha chế · Barista | 5132 Nhân viên pha chế (L4) | A 단일 후보(그 단계까지만) |  |
| am_thuc_do_uong | tho_lam_banh | Thợ làm bánh | 7512 Thợ nướng bánh, thợ làm bánh ngọt và bánh kẹo (L4) ⚠→san_xuat_xay_dung | A 단일 후보(그 단계까지만) | 5단계(75121~75123)는 업무 내용 필요 |
| am_thuc_do_uong | quan_an_binh_dan | Quán ăn bình dân | 5 Nhân viên dịch vụ và bán hàng (L1) · business_type 필요 | D 직업이 아니라 업장 종류(업무 내용으로만 판정) |  |
| am_thuc_do_uong | nha_hang | Nhà hàng | 5 Nhân viên dịch vụ và bán hàng (L1) · business_type 필요 | D 직업이 아니라 업장 종류(업무 내용으로만 판정) |  |
| am_thuc_do_uong | nha_hang_gia_dinh | Nhà hàng gia đình | 5 Nhân viên dịch vụ và bán hàng (L1) · business_type 필요 | D 직업이 아니라 업장 종류(업무 내용으로만 판정) |  |
| am_thuc_do_uong | thuc_an_nhanh | Cửa hàng thức ăn nhanh | 5 Nhân viên dịch vụ và bán hàng (L1) · business_type 필요 | D 직업이 아니라 업장 종류(업무 내용으로만 판정) |  |
| am_thuc_do_uong | ga_ran_pizza | Cửa hàng gà rán · Pizza | 5 Nhân viên dịch vụ và bán hàng (L1) · business_type 필요 | D 직업이 아니라 업장 종류(업무 내용으로만 판정) |  |
| am_thuc_do_uong | quan_ca_phe | Quán cà phê | 5 Nhân viên dịch vụ và bán hàng (L1) · business_type 필요 | D 직업이 아니라 업장 종류(업무 내용으로만 판정) |  |
| am_thuc_do_uong | kem_trang_mieng | Kem · Tráng miệng | 5 Nhân viên dịch vụ và bán hàng (L1) · business_type 필요 | D 직업이 아니라 업장 종류(업무 내용으로만 판정) |  |
| am_thuc_do_uong | tiem_banh | Tiệm bánh · Donut · Bánh truyền thống | 5 Nhân viên dịch vụ và bán hàng (L1) · business_type 필요 | D 직업이 아니라 업장 종류(업무 내용으로만 판정) |  |
| am_thuc_do_uong | quan_bia | Quán bia · Quán nhậu | 5 Nhân viên dịch vụ và bán hàng (L1) · business_type 필요 | D 직업이 아니라 업장 종류(업무 내용으로만 판정) |  |
| am_thuc_do_uong | bar | Bar · Quầy rượu | 5 Nhân viên dịch vụ và bán hàng (L1) · business_type 필요 | D 직업이 아니라 업장 종류(업무 내용으로만 판정) |  |
| am_thuc_do_uong | suat_an_cong_nghiep | Suất ăn công nghiệp · Bếp ăn tập thể | 5 Nhân viên dịch vụ và bán hàng (L1) · business_type 필요 | D 직업이 아니라 업장 종류(업무 내용으로만 판정) |  |
| am_thuc_do_uong | com_hop | Cơm hộp · Đồ ăn kèm | 5 Nhân viên dịch vụ và bán hàng (L1) · business_type 필요 | D 직업이 아니라 업장 종류(업무 내용으로만 판정) |  |

### quan_ly_ban_hang

| 대분류 | 소분류 | 표시 이름 | 후보 공식 코드 · name_vi (단계) | 판정 | 비고 |
|---|---|---|---|---|---|
| quan_ly_ban_hang | thu_ngan | Thu ngân · Quầy tính tiền | 5230 Nhân viên thu ngân và bán vé (L4) | A 단일 후보(그 단계까지만) |  |
| quan_ly_ban_hang | pg_pb | Nhân viên PG/PB quảng bá sản phẩm | 5242 Nhân viên thuyết minh giới thiệu hàng hóa (L4) | A 단일 후보(그 단계까지만) |  |
| quan_ly_ban_hang | md_tmdt | MD · Vận hành sàn TMĐT | 3323 Nhân viên/đại lý mua hàng (L4) ⚠→cskh_kinh_doanh<br>5249 Nhân viên bán hàng khác chưa được phân vào đâu (L4) | C 후보 여러 개·대표 확인 필요 | 상품기획(구매) vs 판매 운영 |
| quan_ly_ban_hang | ttm_tm | Trung tâm thương mại | 5 Nhân viên dịch vụ và bán hàng (L1) · business_type 필요 | D 직업이 아니라 업장 종류(업무 내용으로만 판정) |  |
| quan_ly_ban_hang | sieu_thi | Siêu thị · Cửa hàng phân phối | 5 Nhân viên dịch vụ và bán hàng (L1) · business_type 필요 | D 직업이 아니라 업장 종류(업무 내용으로만 판정) |  |
| quan_ly_ban_hang | cho_truyen_thong | Bán buôn - bán lẻ · Chợ truyền thống | 5 Nhân viên dịch vụ và bán hàng (L1) · business_type 필요 | D 직업이 아니라 업장 종류(업무 내용으로만 판정) |  |
| quan_ly_ban_hang | cua_hang_tien_loi | Cửa hàng tiện lợi | 5 Nhân viên dịch vụ và bán hàng (L1) · business_type 필요 | D 직업이 아니라 업장 종류(업무 내용으로만 판정) |  |
| quan_ly_ban_hang | quan_ao_trang_suc | Cửa hàng quần áo · Phụ kiện · Trang sức | 5 Nhân viên dịch vụ và bán hàng (L1) · business_type 필요 | D 직업이 아니라 업장 종류(업무 내용으로만 판정) |  |
| quan_ly_ban_hang | my_pham_suc_khoe | Cửa hàng mỹ phẩm · Sức khỏe | 5 Nhân viên dịch vụ và bán hàng (L1) · business_type 필요 | D 직업이 아니라 업장 종류(업무 내용으로만 판정) |  |
| quan_ly_ban_hang | dien_thoai_thiet_bi | Cửa hàng điện thoại · Thiết bị điện tử | 5 Nhân viên dịch vụ và bán hàng (L1) · business_type 필요 | D 직업이 아니라 업장 종류(업무 내용으로만 판정) |  |
| quan_ly_ban_hang | noi_that | Nội thất · Chăn ga gối · Trang trí nhà | 5 Nhân viên dịch vụ và bán hàng (L1) · business_type 필요 | D 직업이 아니라 업장 종류(업무 내용으로만 판정) |  |
| quan_ly_ban_hang | do_gia_dung | Cửa hàng đồ gia dụng | 5 Nhân viên dịch vụ và bán hàng (L1) · business_type 필요 | D 직업이 아니라 업장 종류(업무 내용으로만 판정) |  |
| quan_ly_ban_hang | nha_sach_van_phong_pham | Nhà sách · Văn phòng phẩm · Đồ lưu niệm | 5 Nhân viên dịch vụ và bán hàng (L1) · business_type 필요 | D 직업이 아니라 업장 종류(업무 내용으로만 판정) |  |
| quan_ly_ban_hang | nong_san_thuy_san | Nông sản · Thủy hải sản · Thịt tươi sống | 5 Nhân viên dịch vụ và bán hàng (L1) · business_type 필요 | D 직업이 아니라 업장 종류(업무 내용으로만 판정) |  |
| quan_ly_ban_hang | cua_hang_hoa | Cửa hàng hoa | 5 Nhân viên dịch vụ và bán hàng (L1) · business_type 필요 | D 직업이 아니라 업장 종류(업무 내용으로만 판정) |  |
| quan_ly_ban_hang | phong_hoc_nhom | Phòng học nhóm · Phòng tự học · KTX ôn thi | 5 Nhân viên dịch vụ và bán hàng (L1) · business_type 필요 | D 직업이 아니라 업장 종류(업무 내용으로만 판정) | 판매점 아님(kind≠retail이면 메뉴 이동) |
| quan_ly_ban_hang | quan_net | Quán net · Phòng máy chơi game | 5 Nhân viên dịch vụ và bán hàng (L1) · business_type 필요 | D 직업이 아니라 업장 종류(업무 내용으로만 판정) | 판매점 아님 |
| quan_ly_ban_hang | karaoke | Karaoke | 5 Nhân viên dịch vụ và bán hàng (L1) · business_type 필요 | D 직업이 아니라 업장 종류(업무 내용으로만 판정) | 판매점 아님 |
| quan_ly_ban_hang | bowling_billiard | Bowling · Billiard | 5 Nhân viên dịch vụ và bán hàng (L1) · business_type 필요 | D 직업이 아니라 업장 종류(업무 내용으로만 판정) | 판매점 아님 |
| quan_ly_ban_hang | golf_man_hinh | Golf màn hình · Mô phỏng bóng chày | 5 Nhân viên dịch vụ và bán hàng (L1) · business_type 필요 | D 직업이 아니라 업장 종류(업무 내용으로만 판정) | 판매점 아님 |
| quan_ly_ban_hang | phong_chieu_phim_da_nang | Phòng chiếu phim · Multi-room · Cà phê truyện tranh | 5 Nhân viên dịch vụ và bán hàng (L1) · business_type 필요 | D 직업이 아니라 업장 종류(업무 내용으로만 판정) | 판매점 아님 |
| quan_ly_ban_hang | khu_vui_choi_dien_tu | Khu vui chơi điện tử · Game center | 5 Nhân viên dịch vụ và bán hàng (L1) · business_type 필요 | D 직업이 아니라 업장 종류(업무 내용으로만 판정) | 판매점 아님 |
| quan_ly_ban_hang | ca_phe_chu_de | Cà phê chủ đề độc đáo | 5 Nhân viên dịch vụ và bán hàng (L1) · business_type 필요 | D 직업이 아니라 업장 종류(업무 내용으로만 판정) | 음식점이면 kind=fnb → am_thuc |
| quan_ly_ban_hang | ca_phe_tre_em | Cà phê trẻ em · Khu vui chơi trẻ em | 5 Nhân viên dịch vụ và bán hàng (L1) · business_type 필요 | D 직업이 아니라 업장 종류(업무 내용으로만 판정) | 판매점 아님 |
| quan_ly_ban_hang | sauna_spa | Nhà tắm hơi · Sauna · Spa | 5 Nhân viên dịch vụ và bán hàng (L1) · business_type 필요 | D 직업이 아니라 업장 종류(업무 내용으로만 판정) | 판매점 아님 |
| quan_ly_ban_hang | gym_the_thao | Phòng gym · Thể thao | 5 Nhân viên dịch vụ và bán hàng (L1) · business_type 필요 | D 직업이 아니라 업장 종류(업무 내용으로만 판정) | 판매점 아님 |
| quan_ly_ban_hang | tram_dung_nghi | Trạm dừng nghỉ cao tốc | 5 Nhân viên dịch vụ và bán hàng (L1) · business_type 필요 | D 직업이 아니라 업장 종류(업무 내용으로만 판정) | 판매점 아님 |

### dich_vu

| 대분류 | 소분류 | 표시 이름 | 후보 공식 코드 · name_vi (단계) | 판정 | 비고 |
|---|---|---|---|---|---|
| dich_vu | cong_vien_giai_tri | Công viên giải trí | 5 Nhân viên dịch vụ và bán hàng (L1) · business_type 필요 | D 직업이 아니라 업장 종류(업무 내용으로만 판정) |  |
| dich_vu | khach_san_resort | Khách sạn · Resort · Lưu trú | 5 Nhân viên dịch vụ và bán hàng (L1) · business_type 필요 | D 직업이 아니라 업장 종류(업무 내용으로만 판정) |  |
| dich_vu | du_lich_cam_trai | Du lịch · Cắm trại · Thể thao giải trí | 5 Nhân viên dịch vụ và bán hàng (L1) · business_type 필요 | D 직업이 아니라 업장 종류(업무 내용으로만 판정) |  |
| dich_vu | rap_chieu_phim | Rạp chiếu phim · Nhà hát | 5 Nhân viên dịch vụ và bán hàng (L1) · business_type 필요 | D 직업이 아니라 업장 종류(업무 내용으로만 판정) |  |
| dich_vu | trien_lam_hoi_nghi | Triển lãm · Hội nghị · Hội thảo | 5 Nhân viên dịch vụ và bán hàng (L1) · business_type 필요 | D 직업이 아니라 업장 종류(업무 내용으로만 판정) |  |
| dich_vu | le_tan | Lễ tân · Quầy hướng dẫn | 4224 Nhân viên lễ tân khách sạn (L4)<br>4226 Lễ tân (tổng hợp) (L4) ⚠→cskh_kinh_doanh | C 후보 여러 개·대표 확인 필요 | 호텔 lễ tân vs 일반 lễ tân |
| dich_vu | huong_dan_do_xe | Hướng dẫn đỗ xe | 962 Lao động giản đơn khác (L3) | B 상위 코드만(세부는 업무 내용 필요) | 공식 명칭에 주차 안내 없음 [추정] |
| dich_vu | bao_ve | Bảo vệ · An ninh | 5401 Nhân viên an ninh (trừ công an) (L4) | A 단일 후보(그 단계까지만) |  |
| dich_vu | cay_xang_rua_xe | Cây xăng · Rửa xe | 5245 Nhân viên phục vụ ở các trạm dịch vụ (L4) ⚠→quan_ly_ban_hang<br>9122 Thợ rửa xe cộ (L4) | C 후보 여러 개·대표 확인 필요 | 주유소 직원 vs 세차 |
| dich_vu | cho_thue_xe | Cho thuê xe · Quản lý xe | 5 Nhân viên dịch vụ và bán hàng (L1) · business_type 필요 | D 직업이 아니라 업장 종류(업무 내용으로만 판정) |  |
| dich_vu | phat_to_roi | Phát tờ rơi | 9510 Lao động trên đường phố và lao động có liên quan (L4) | A 단일 후보(그 단계까지만) |  |
| dich_vu | ve_sinh_don_dep | Vệ sinh · Dọn dẹp | 9111 Người quét dọn và giúp việc gia đình (L4)<br>9112 Người quét dọn và giúp việc trong văn phòng, khách sạn và các cơ sở khác (L4) | C 후보 여러 개·대표 확인 필요 | 가정 vs 사무실·호텔 |
| dich_vu | quan_ly_cho_thue_as | Quản lý cho thuê · Bảo hành sửa chữa | 3334 Nhân viên môi giới bất động sản và quản lý tài sản/bất động sản (L4) ⚠→cskh_kinh_doanh<br>7421 Thợ cơ khí và thợ dịch vụ điện tử (L4) ⚠→san_xuat_xay_dung | C 후보 여러 개·대표 확인 필요 | 임대 관리 vs A/S 수리 |
| dich_vu | caddy_golf | Caddy sân golf | 9629 Lao động giản đơn khác chưa được phân vào đâu (L4) | C 후보 여러 개·대표 확인 필요 | 공식 명칭에 caddy 없음, 9629는 [추정] |
| dich_vu | toc_lam_dep_nail | Tiệm tóc · Làm đẹp · Nail | 5141 Thợ làm đầu (L4)<br>5142 Nhân viên làm đẹp và nhân viên có liên quan (L4) | C 후보 여러 개·대표 확인 필요 | 미용(머리) vs 피부·네일 |
| dich_vu | cham_soc_da_massage | Chăm sóc da · Massage | 5142 Nhân viên làm đẹp và nhân viên có liên quan (L4)<br>3255 Kỹ thuật viên vật lý trị liệu và phụ tá (L4) ⚠→y_te_dieu_duong | C 후보 여러 개·대표 확인 필요 | 미용 vs 물리치료 |
| dich_vu | cham_soc_thu_cung | Chăm sóc thú cưng | 5164 Nhân viên chăm sóc và làm đẹp động vật (L4) | A 단일 후보(그 단계까지만) |  |
| dich_vu | trong_tre_giup_viec | Trông trẻ · Giúp việc nhà | 5311 Nhân viên chăm sóc trẻ em (L4)<br>9111 Người quét dọn và giúp việc gia đình (L4) | C 후보 여러 개·대표 확인 필요 | 아이 돌봄 vs 가사 |
| dich_vu | tiec_cuoi_tang_le | Hỗ trợ tiệc cưới · Tiệc · Tang lễ | 5163 Người làm nghề phục vụ tang lễ và ướp xác (L4)<br>5246 Nhân viên phục vụ đồ ăn uống (L4) ⚠→quan_ly_ban_hang | C 후보 여러 개·대표 확인 필요 | 장례 vs 연회 음식 서빙 |
| dich_vu | nhan_vien_su_kien | Nhân viên sự kiện | 3332 Nhân viên tổ chức hội thảo và sự kiện (L4) ⚠→cskh_kinh_doanh | C 후보 여러 개·대표 확인 필요 | 3332는 '행사 기획' 직무 — 단순 행사 보조와 다를 수 있음 |
| dich_vu | thuyet_minh_quang_cao | Người thuyết minh quảng cáo | 5242 Nhân viên thuyết minh giới thiệu hàng hóa (L4) ⚠→quan_ly_ban_hang | A 단일 후보(그 단계까지만) |  |
| dich_vu | nguoi_mau_thu_do | Người mẫu thử đồ | 5241 Nhân viên làm mẫu (L4) ⚠→quan_ly_ban_hang | A 단일 후보(그 단계까지만) |  |
| dich_vu | moi_gioi_bds | Môi giới bất động sản | 3334 Nhân viên môi giới bất động sản và quản lý tài sản/bất động sản (L4) ⚠→cskh_kinh_doanh | A 단일 후보(그 단계까지만) |  |

### van_phong

| 대분류 | 소분류 | 표시 이름 | 후보 공식 코드 · name_vi (단계) | 판정 | 비고 |
|---|---|---|---|---|---|
| van_phong | tro_ly_van_phong | Trợ lý văn phòng | 4110 Nhân viên tổng hợp (L4)<br>3343 Thư ký hành chính và điều hành (L4) | C 후보 여러 개·대표 확인 필요 |  |
| van_phong | soan_thao_van_ban | Soạn thảo văn bản · Tìm tài liệu | 4131 Nhân viên đánh máy (L4)<br>4409 Nhân viên hỗ trợ văn phòng khác chưa được phân vào đâu (L4) | C 후보 여러 개·대표 확인 필요 |  |
| van_phong | thu_thap_du_lieu | Thu thập · Xử lý dữ liệu | 4132 Nhân viên nhập dữ liệu (L4)<br>4227 Phỏng vấn viên điều tra và nghiên cứu thị trường (L4) | C 후보 여러 개·대표 확인 필요 | 입력 vs 조사 |
| van_phong | tro_ly_ke_toan | Trợ lý kế toán | 4311 Nhân viên kế toán (L4) | A 단일 후보(그 단계까지만) |  |
| van_phong | nhan_su_hanh_chinh | Nhân sự · Hành chính | 4406 Nhân viên tổ chức nhân sự (L4)<br>2423 Nhà chuyên môn về nhân sự và nghề nghiệp (L4) | C 후보 여러 개·대표 확인 필요 | 사무원 vs 전문가 |
| van_phong | marketing_quang_cao | Marketing · Quảng cáo · PR | 2431 Nhà chuyên môn về quảng cáo và tiếp thị (L4) ⚠→truyen_thong<br>2432 Nhà chuyên môn về quan hệ công chúng (L4) ⚠→truyen_thong | C 후보 여러 개·대표 확인 필요 | 광고·마케팅 vs PR |
| van_phong | marketing_sns | Marketing viral · Mạng xã hội | 2431 Nhà chuyên môn về quảng cáo và tiếp thị (L4) ⚠→truyen_thong | A 단일 후보(그 단계까지만) |  |
| van_phong | bien_dich_phien_dich | Biên dịch · Phiên dịch | 2643 Nhà biên dịch, phiên dịch và nhà ngôn ngữ khác (L4) | A 단일 후보(그 단계까지만) | 5단계(26431 통역·26432 번역)는 업무 내용 필요 |
| van_phong | photocopy_in_an | Photocopy · In ấn · Đóng sách | 4405 Nhân viên văn thư và phô tô (L4)<br>7322 Thợ in (L4) ⚠→san_xuat_xay_dung | C 후보 여러 개·대표 확인 필요 | 복사 사무 vs 인쇄공 |
| van_phong | bien_tap_hieu_dinh | Biên tập · Hiệu đính | 2642 Nhà báo, biên tập viên (L4) ⚠→truyen_thong<br>4403 Nhân viên đánh mã, đọc và sửa bản in thử (L4) | C 후보 여러 개·대표 확인 필요 | 편집자 vs 교정 |
| van_phong | co_quan_nha_nuoc | Cơ quan nhà nước · Doanh nghiệp công · Hiệp hội | — (후보 없음) | D 직업이 아니라 업장 종류(업무 내용으로만 판정) | 기관 종류 — 업무 내용으로만 |
| van_phong | truong_hoc_thu_vien | Trường học · Thư viện · Cơ sở giáo dục | — (후보 없음) | D 직업이 아니라 업장 종류(업무 내용으로만 판정) | 기관 종류 — 업무 내용으로만(사서 업무면 4401) |

### cskh_kinh_doanh

| 대분류 | 소분류 | 표시 이름 | 후보 공식 코드 · name_vi (단계) | 판정 | 비고 |
|---|---|---|---|---|---|
| cskh_kinh_doanh | cskh_inbound | Chăm sóc khách hàng (inbound) | 4222 Nhân viên trung tâm thông tin liên lạc (L4)<br>4229 Nhân viên thông tin khách hàng chưa được phân vào đâu (L4) | C 후보 여러 개·대표 확인 필요 |  |
| cskh_kinh_doanh | telesale_outbound | Telesale (outbound) | 5244 Nhân viên bán hàng qua trung tâm liên lạc (L4) ⚠→quan_ly_ban_hang | A 단일 후보(그 단계까지만) |  |
| cskh_kinh_doanh | cskh_tmdt | CSKH sàn thương mại điện tử | 4222 Nhân viên trung tâm thông tin liên lạc (L4)<br>4229 Nhân viên thông tin khách hàng chưa được phân vào đâu (L4) | C 후보 여러 개·대표 확인 필요 |  |
| cskh_kinh_doanh | kinh_doanh_tai_chinh | Kinh doanh tài chính · Bảo hiểm | 3321 Nhân viên đại diện bảo hiểm (L4)<br>2412 Nhà tư vấn tài chính và đầu tư (L4) ⚠→van_phong | C 후보 여러 개·대표 확인 필요 | 보험 대리 vs 금융 상담 |
| cskh_kinh_doanh | ban_hang_truc_tiep | Kinh doanh · Bán hàng trực tiếp | 3322 Nhân viên đại diện bán hàng hóa thương mại (L4)<br>5243 Nhân viên bán hàng tận nhà (L4) ⚠→quan_ly_ban_hang | C 후보 여러 개·대표 확인 필요 | 기업 영업 vs 방문 판매 |
| cskh_kinh_doanh | khao_sat_nghien_cuu | Khảo sát · Nghiên cứu thị trường | 4227 Phỏng vấn viên điều tra và nghiên cứu thị trường (L4) ⚠→van_phong | A 단일 후보(그 단계까지만) |  |
| cskh_kinh_doanh | quan_ly_tong_dai | Quản lý · Giám sát tổng đài | 4222 Nhân viên trung tâm thông tin liên lạc (L4)<br>4223 Nhân viên vận hành tổng đài điện thoại (L4) | C 후보 여러 개·대표 확인 필요 |  |
| cskh_kinh_doanh | ho_tro_kinh_doanh | Quản lý · Hỗ trợ kinh doanh | 3339 Nhân viên/đại lý dịch vụ kinh doanh khác chưa được phân vào đâu (L4)<br>3341 Giám sát viên văn phòng (L4) ⚠→van_phong | C 후보 여러 개·대표 확인 필요 |  |

### san_xuat_xay_dung

| 대분류 | 소분류 | 표시 이름 | 후보 공식 코드 · name_vi (단계) | 판정 | 비고 |
|---|---|---|---|---|---|
| san_xuat_xay_dung | san_xuat_gia_cong | Sản xuất · Gia công · Lắp ráp | 8 Thợ lắp ráp và vận hành máy móc, thiết bị (L1)<br>82 Thợ lắp ráp (L2) | B 상위 코드만(세부는 업무 내용 필요) | 조립 명시면 82, 아니면 8까지만 |
| san_xuat_xay_dung | dong_goi_kiem_tra | Đóng gói · Kiểm tra chất lượng | 9321 Lao động đóng gói thủ công (L4)<br>8183 Thợ vận hành thiết bị đóng gói, đóng chai và dán nhãn (L4)<br>7543 Thợ phân loại và kiểm tra sản phẩm (trừ thực phẩm và đồ uống) (L4) | C 후보 여러 개·대표 확인 필요 | 수작업 포장 / 포장기 / 검사 |
| san_xuat_xay_dung | xuat_nhap_kho | Xuất nhập kho · Quản lý kho | 4321 Nhân viên ghi chép tồn kho (L4) ⚠→van_phong<br>9333 Người mang vác hàng (L4) | C 후보 여러 개·대표 확인 필요 | 재고 기록 vs 운반 |
| san_xuat_xay_dung | boc_xep_hang | Bốc xếp hàng · Phân loại bưu kiện | 9333 Người mang vác hàng (L4)<br>9621 Người đưa thư, người giao hàng và người khuân vác hành lý (L4) ⚠→lai_xe_giao_hang | C 후보 여러 개·대표 확인 필요 |  |
| san_xuat_xay_dung | nhat_hang_logistics | Nhặt hàng logistics · Đóng gói · Nhập liệu | 9333 Người mang vác hàng (L4)<br>9321 Lao động đóng gói thủ công (L4)<br>4132 Nhân viên nhập dữ liệu (L4) ⚠→van_phong | C 후보 여러 개·대표 확인 필요 |  |
| san_xuat_xay_dung | lai_xe_nang | Lái xe nâng | 8344 Thợ vận hành xe bốc dỡ (L4) | A 단일 후보(그 단계까지만) |  |
| san_xuat_xay_dung | khuon_mau_ep_nhua | Khuôn mẫu · Ép nhựa · Dập · Gia công cơ khí | 7211 Thợ tạo khuôn và lõi kim loại (L4)<br>8142 Thợ vận hành máy sản xuất sản phẩm nhựa (L4)<br>7223 Thợ lắp ráp và vận hành máy công cụ kim loại (L4) | C 후보 여러 개·대표 확인 필요 |  |
| san_xuat_xay_dung | san_xuat_ban_dan | Sản xuất bán dẫn · Linh kiện điện tử | 8202 Thợ lắp ráp thiết bị điện và điện tử (L4)<br>3114 Kỹ thuật viên kỹ thuật điện tử (L4) ⚠→cntt_ky_thuat | C 후보 여러 개·대표 확인 필요 | 조립공 vs 기술원 |
| san_xuat_xay_dung | van_hanh_may_moc | Vận hành máy móc | 81 Thợ vận hành máy móc và thiết bị (L2) | B 상위 코드만(세부는 업무 내용 필요) | 기계 종류는 업무 내용 필요(811~818) |
| san_xuat_xay_dung | bao_tri_sua_chua | Bảo trì · Sửa chữa · Lắp đặt | 7233 Thợ cơ khí và sửa chữa máy móc nông nghiệp và công nghiệp (L4)<br>7412 Thợ lắp ráp và thợ cơ khí điện (L4)<br>7421 Thợ cơ khí và thợ dịch vụ điện tử (L4) | C 후보 여러 개·대표 확인 필요 | 기계 / 전기 / 전자 |
| san_xuat_xay_dung | dien_co_so_vat_chat | Điện · Quản lý cơ sở vật chất | 7411 Thợ lắp điện cho tòa nhà và thợ điện có liên quan (L4)<br>5153 Người chăm sóc, bảo vệ tòa nhà (L4) ⚠→dich_vu | C 후보 여러 개·대표 확인 필요 |  |
| san_xuat_xay_dung | van_chuyen_lap_dat | Vận chuyển · Lắp đặt · Tháo dỡ | 9333 Người mang vác hàng (L4)<br>9313 Thợ phụ xây dựng (L4) | C 후보 여러 개·대표 확인 필요 |  |
| san_xuat_xay_dung | cong_truong_xay_dung | Công trường xây dựng | — (후보 없음) | D 직업이 아니라 업장 종류(업무 내용으로만 판정) | 현장 종류 — 업무 내용으로(9313·71 등) |
| san_xuat_xay_dung | thi_cong_dien_ong_nuoc | Thi công điện · Vách ngăn · Ống nước | 7411 Thợ lắp điện cho tòa nhà và thợ điện có liên quan (L4)<br>7126 Thợ ống nước (L4)<br>7123 Thợ thạch cao (L4) | C 후보 여러 개·대표 확인 필요 | 전기 / 배관 / 칸막이 |
| san_xuat_xay_dung | noi_that_sua_chua_nha | Nội thất · Sửa chữa nhà | 7115 Thợ mộc và thợ làm đồ gỗ (L4)<br>712 Thợ hoàn thiện công trình và thợ có liên quan (L3) | C 후보 여러 개·대표 확인 필요 |  |
| san_xuat_xay_dung | nha_may_dong_tau | Nhà máy đóng tàu | — (후보 없음) | D 직업이 아니라 업장 종류(업무 내용으로만 판정) | 공장 종류 — 업무 내용으로 |
| san_xuat_xay_dung | cat_may | Cắt may | 7532 Thợ tạo mẫu và cắt quần áo và các thợ có liên quan (L4)<br>7531 Thợ may, thợ làm da thú và thợ làm mũ (L4)<br>8153 Thợ vận hành máy may (L4) | C 후보 여러 개·대표 확인 필요 | 재단 / 봉제 / 미싱 운전 |

### cntt_ky_thuat

| 대분류 | 소분류 | 표시 이름 | 후보 공식 코드 · name_vi (단계) | 판정 | 비고 |
|---|---|---|---|---|---|
| cntt_ky_thuat | len_ke_hoach_web | Lập kế hoạch web · Nội dung | 2513 Nhà phát triển web và truyền thông đa phương tiện (L4)<br>2431 Nhà chuyên môn về quảng cáo và tiếp thị (L4) ⚠→truyen_thong | C 후보 여러 개·대표 확인 필요 |  |
| cntt_ky_thuat | quan_tri_website | Quản trị website · Hỗ trợ kỹ thuật | 3514 Kỹ thuật viên web (L4)<br>3512 Kỹ thuật viên hỗ trợ người sử dụng công nghệ thông tin và truyền thông (L4) | C 후보 여러 개·대표 확인 필요 |  |
| cntt_ky_thuat | lap_trinh_vien | Lập trình viên | 2512 Nhà phát triển phần mềm (L4)<br>2514 Nhà lập trình các ứng dụng (L4) | C 후보 여러 개·대표 확인 필요 |  |
| cntt_ky_thuat | lap_trinh_html | Lập trình HTML | 2513 Nhà phát triển web và truyền thông đa phương tiện (L4) | A 단일 후보(그 단계까지만) |  |
| cntt_ky_thuat | kiem_thu_phan_mem | Kiểm thử phần mềm | 2519 Nhà chuyên môn về phát triển phần mềm ứng dụng và nhà phân tích chưa được phân vào đâu (L4) | A 단일 후보(그 단계까지만) | 테스터가 2519(미분류 기타)에 드는지는 [추정] |
| cntt_ky_thuat | he_thong_mang_bao_mat | Hệ thống · Mạng · Bảo mật | 2522 Nhà quản trị hệ thống (L4)<br>2523 Nhà chuyên môn về mạng máy tính (L4)<br>3513 Kỹ thuật viên hệ thống và mạng máy tính (L4) | C 후보 여러 개·대표 확인 필요 |  |
| cntt_ky_thuat | lap_dat_thiet_bi_so | Lắp đặt · Quản lý máy tính, thiết bị số | 3512 Kỹ thuật viên hỗ trợ người sử dụng công nghệ thông tin và truyền thông (L4)<br>7422 Thợ lắp đặt và dịch vụ kỹ thuật thông tin và truyền thông (L4) ⚠→san_xuat_xay_dung | C 후보 여러 개·대표 확인 필요 |  |

### thiet_ke

| 대분류 | 소분류 | 표시 이름 | 후보 공식 코드 · name_vi (단계) | 판정 | 비고 |
|---|---|---|---|---|---|
| thiet_ke | thiet_ke_web_mobile | Thiết kế web · Mobile | 2166 Nhà thiết kế đồ họa và truyền thông đa phương tiện (L4)<br>2513 Nhà phát triển web và truyền thông đa phương tiện (L4) ⚠→cntt_ky_thuat | C 후보 여러 개·대표 확인 필요 | 디자인 vs 개발 |
| thiet_ke | thiet_ke_do_hoa_video | Thiết kế đồ họa · Video · Dựng phim | 2166 Nhà thiết kế đồ họa và truyền thông đa phương tiện (L4)<br>3521 Kỹ thuật viên truyền hình và nghe - nhìn (L4) ⚠→truyen_thong | C 후보 여러 개·대표 확인 필요 | 디자인 vs 영상 기술 |
| thiet_ke | thiet_ke_san_pham | Thiết kế sản phẩm · Công nghiệp | 2163 Nhà thiết kế sản phẩm và may mặc (L4) | A 단일 후보(그 단계까지만) |  |
| thiet_ke | cad_cam_noi_that | CAD/CAM · Thiết kế nội thất | 3432 Nhà thiết kế và trang trí nội thất (L4)<br>3118 Kỹ thuật viên phác thảo kỹ thuật (L4) ⚠→cntt_ky_thuat | C 후보 여러 개·대표 확인 필요 |  |
| thiet_ke | thiet_ke_nhan_vat | Thiết kế nhân vật · Hoạt hình | 2166 Nhà thiết kế đồ họa và truyền thông đa phương tiện (L4)<br>2651 Nghệ sỹ hình ảnh (L4) | C 후보 여러 개·대표 확인 필요 |  |
| thiet_ke | thiet_ke_thoi_trang | Thiết kế thời trang · Phụ kiện | 2163 Nhà thiết kế sản phẩm và may mặc (L4) | A 단일 후보(그 단계까지만) |  |

### truyen_thong

| 대분류 | 소분류 | 표시 이름 | 후보 공식 코드 · name_vi (단계) | 판정 | 비고 |
|---|---|---|---|---|---|
| truyen_thong | dien_vien_quan_chung | Diễn viên quần chúng · Khán giả trường quay | 2655 Diễn viên (L4) | A 단일 후보(그 단계까지만) | 엑스트라·방청객이 '배우'인지 대표 확인 |
| truyen_thong | nhan_vien_hau_truong | Nhân viên hậu trường · Trợ lý quay phim | 3521 Kỹ thuật viên truyền hình và nghe - nhìn (L4)<br>2654 Đạo diễn, nhà sản xuất phim, sân khấu và các nghề liên quan (L4) | C 후보 여러 개·대표 확인 필요 |  |
| truyen_thong | quay_dung_video | Quay · Dựng video | 3521 Kỹ thuật viên truyền hình và nghe - nhìn (L4)<br>2654 Đạo diễn, nhà sản xuất phim, sân khấu và các nghề liên quan (L4) | C 후보 여러 개·대표 확인 필요 |  |
| truyen_thong | chup_anh_chinh_sua | Chụp ảnh · Chỉnh sửa ảnh | 3431 Nhiếp ảnh gia (L4) | A 단일 후보(그 단계까지만) |  |
| truyen_thong | anh_sang_am_thanh | Ánh sáng · Âm thanh | 3521 Kỹ thuật viên truyền hình và nghe - nhìn (L4) | A 단일 후보(그 단계까지만) |  |
| truyen_thong | dai_truyen_hinh | Đài truyền hình · Công ty sản xuất | — (후보 없음) | D 직업이 아니라 업장 종류(업무 내용으로만 판정) | 회사 종류 — 업무 내용으로 |
| truyen_thong | bao_tap_chi_xuat_ban | Báo · Tạp chí · Xuất bản | — (후보 없음) | D 직업이 아니라 업장 종류(업무 내용으로만 판정) | 회사 종류 — 업무 내용으로 |

### lai_xe_giao_hang

| 대분류 | 소분류 | 표시 이름 | 후보 공식 코드 · name_vi (단계) | 판정 | 비고 |
|---|---|---|---|---|---|
| lai_xe_giao_hang | van_chuyen_chuyen_nha | Vận chuyển hàng hóa · Chuyển nhà | 8332 Lái xe tải hạng vừa và xe tải hạng nặng (L4)<br>9333 Người mang vác hàng (L4) ⚠→san_xuat_xay_dung | C 후보 여러 개·대표 확인 필요 | 운전 vs 운반 |
| lai_xe_giao_hang | tai_xe_giao_hang | Tài xế giao hàng · Bưu kiện | 8322 Lái xe con, taxi và xe tải hạng nhẹ (L4)<br>8321 Lái xe máy (L4) | C 후보 여러 개·대표 확인 필요 | 차 vs 오토바이 |
| lai_xe_giao_hang | tai_xe_giao_dai_ly | Tài xế giao hàng cho đại lý | 8322 Lái xe con, taxi và xe tải hạng nhẹ (L4)<br>8332 Lái xe tải hạng vừa và xe tải hạng nặng (L4) | C 후보 여러 개·대표 확인 필요 | 소형 vs 중대형 화물차 |
| lai_xe_giao_hang | xe_chuyen_dung | Xe chuyên dụng · Xe hạng nặng | 8332 Lái xe tải hạng vừa và xe tải hạng nặng (L4)<br>8342 Thợ vận hành máy đào đất và thợ vận hành thiết bị có liên quan (L4) ⚠→san_xuat_xay_dung<br>8343 Thợ vận hành cần trục và thợ vận hành các thiết bị có liên quan (L4) ⚠→san_xuat_xay_dung | C 후보 여러 개·대표 확인 필요 |  |
| lai_xe_giao_hang | do_xe_ho | Đỗ xe hộ | 8322 Lái xe con, taxi và xe tải hạng nhẹ (L4)<br>9629 Lao động giản đơn khác chưa được phân vào đâu (L4) ⚠→dich_vu | C 후보 여러 개·대표 확인 필요 |  |
| lai_xe_giao_hang | taxi_lai_xe_ho | Taxi · Lái xe hộ · Tài xế riêng | 8322 Lái xe con, taxi và xe tải hạng nhẹ (L4) | A 단일 후보(그 단계까지만) |  |
| lai_xe_giao_hang | lai_xe_buyt | Lái xe buýt · Xe đưa đón | 8331 Lái xe buýt và xe điện (L4) | A 단일 후보(그 단계까지만) |  |
| lai_xe_giao_hang | giao_hang_nhanh | Giao hàng nhanh | 8321 Lái xe máy (L4)<br>9621 Người đưa thư, người giao hàng và người khuân vác hành lý (L4) | C 후보 여러 개·대표 확인 필요 |  |
| lai_xe_giao_hang | giao_do_an_shipper | Giao đồ ăn · Shipper | 8321 Lái xe máy (L4)<br>83212 Người chở người, chở hàng bằng xe máy sử dụng các thiết bị di động cá nhân (lái xe máy công nghệ) (L5) | C 후보 여러 개·대표 확인 필요 | 앱 기사면 83212 |
| lai_xe_giao_hang | giao_hang_di_bo | Giao hàng đi bộ | 9621 Người đưa thư, người giao hàng và người khuân vác hành lý (L4) | A 단일 후보(그 단계까지만) |  |

### y_te_dieu_duong

| 대분류 | 소분류 | 표시 이름 | 후보 공식 코드 · name_vi (단계) | 판정 | 비고 |
|---|---|---|---|---|---|
| y_te_dieu_duong | dieu_duong_y_ta | Điều dưỡng · Y tá | 3221 Y tá/điều dưỡng, kỹ thuật viên chăm sóc bệnh nhân (L4)<br>2221 Y tá/Điều dưỡng (cao cấp) (L4) | C 후보 여러 개·대표 확인 필요 | 일반 vs 고급(cao cấp) |
| y_te_dieu_duong | ky_thuat_vien_y_te | Kỹ thuật viên y tế | 321 Kỹ thuật viên y tế và dược (L3) | B 상위 코드만(세부는 업무 내용 필요) | 분야(영상·검사·약제 등)는 업무 내용 필요 |
| y_te_dieu_duong | cham_soc_benh_nhan | Người chăm sóc bệnh nhân · người cao tuổi | 5321 Nhân viên hỗ trợ về chăm sóc sức khỏe (L4)<br>5322 Nhân viên chăm sóc cá nhân tại nhà (L4) | C 후보 여러 개·대표 확인 필요 | 기관 vs 가정 |
| y_te_dieu_duong | hanh_chinh_benh_vien | Hành chính bệnh viện · Điều phối viên | 3344 Thư ký y tế (L4) ⚠→van_phong<br>4229 Nhân viên thông tin khách hàng chưa được phân vào đâu (L4) ⚠→cskh_kinh_doanh | C 후보 여러 개·대표 확인 필요 |  |
| y_te_dieu_duong | tro_ly_khoa_kham | Trợ lý khoa khám · Trợ lý bệnh phòng | 5321 Nhân viên hỗ trợ về chăm sóc sức khỏe (L4)<br>3221 Y tá/điều dưỡng, kỹ thuật viên chăm sóc bệnh nhân (L4) | C 후보 여러 개·대표 확인 필요 |  |
| y_te_dieu_duong | ky_thuat_vien_thu_y | Kỹ thuật viên thú y | 3240 Kỹ thuật viên thú y và phụ tá (L4) | A 단일 후보(그 단계까지만) |  |
| y_te_dieu_duong | tro_ly_thi_nghiem | Trợ lý thí nghiệm · Nghiên cứu | 3212 Kỹ thuật viên phòng thí nghiệm y tế (L4)<br>3141 Kỹ thuật viên khoa học sự sống (không kể y tế) (L4)<br>3111 Kỹ thuật viên khoa học hóa học và vật lý (L4) ⚠→cntt_ky_thuat | C 후보 여러 개·대표 확인 필요 | 의료 / 생명과학 / 화학·물리 |
| y_te_dieu_duong | thu_nghiem_lam_sang | Thử nghiệm sinh khả dụng · Lâm sàng | — (후보 없음) | D 직업이 아니라 업장 종류(업무 내용으로만 판정) | 임상시험 참가자 모집이면 직업 아님 — 대표 확인 |

### giao_duc_giang_day

| 대분류 | 소분류 | 표시 이름 | 후보 공식 코드 · name_vi (단계) | 판정 | 비고 |
|---|---|---|---|---|---|
| giao_duc_giang_day | trung_tam_luyen_thi | Trung tâm luyện thi · Học thêm | — (후보 없음) | D 직업이 아니라 업장 종류(업무 내용으로만 판정) | 기관 종류 — 업무 내용으로 |
| giao_duc_giang_day | trung_tam_ngoai_ngu | Trung tâm ngoại ngữ | — (후보 없음) | D 직업이 아니라 업장 종류(업무 내용으로만 판정) | 기관 종류 — 외국어 교사면 2393 |
| giao_duc_giang_day | trung_tam_doc_sach | Trung tâm đọc sách · Luyện viết · Nói trước công chúng | — (후보 없음) | D 직업이 아니라 업장 종류(업무 내용으로만 판정) | 기관 종류 |
| giao_duc_giang_day | tin_hoc_cntt | Tin học · CNTT | 2396 Giáo viên công nghệ thông tin (L4) | A 단일 후보(그 단계까지만) |  |
| giao_duc_giang_day | giao_vien_yoga | Giáo viên Yoga · Pilates | 3423 Người hướng dẫn tập luyện và giải trí, người chỉ đạo chương trình (L4) ⚠→dich_vu | A 단일 후보(그 단계까지만) |  |
| giao_duc_giang_day | hlv_the_hinh | Huấn luyện viên thể hình | 34223 Nhân viên hướng dẫn tập thể hình (L5) ⚠→dich_vu | A 단일 후보(그 단계까지만) |  |
| giao_duc_giang_day | giao_vien_the_thao | Giáo viên thể thao giải trí | 3422 Huấn luyện viên, nhân viên hướng dẫn thể thao và làm việc trong lĩnh vực thể thao (L4) ⚠→dich_vu<br>2399 Nhà chuyên môn giảng dạy khác chưa được phân vào đâu (L4) | C 후보 여러 개·대표 확인 필요 |  |
| giao_duc_giang_day | giao_vien_nang_khieu | Giáo viên năng khiếu (nghệ thuật/thể thao) | 2394 Giáo viên âm nhạc khác (L4)<br>2395 Giáo viên nghệ thuật khác (L4) | C 후보 여러 개·대표 확인 필요 | 음악 vs 기타 예술(체육은 3422) |
| giao_duc_giang_day | mam_non_mau_giao | Mầm non · Mẫu giáo | 2342 Giáo viên mầm non (L4)<br>3620 Giáo viên mầm non (L4)<br>5311 Nhân viên chăm sóc trẻ em (L4) ⚠→dich_vu | C 후보 여러 개·대표 확인 필요 | 교사 단계 vs 보육 |
| giao_duc_giang_day | ho_tro_dua_don | Hỗ trợ đưa đón học sinh | 5312 Người phụ tá cho giáo viên (L4)<br>5311 Nhân viên chăm sóc trẻ em (L4) ⚠→dich_vu | C 후보 여러 개·대표 확인 필요 |  |
| giao_duc_giang_day | gia_su_tai_nha | Gia sư tại nhà · Học liệu | 2399 Nhà chuyên môn giảng dạy khác chưa được phân vào đâu (L4)<br>3642 Giáo viên đào tạo khác (L4) | C 후보 여러 개·대표 확인 필요 |  |
| giao_duc_giang_day | tro_giang | Trợ giảng | 5312 Người phụ tá cho giáo viên (L4) | A 단일 후보(그 단계까지만) |  |
| giao_duc_giang_day | trung_tam_chung_chi | Trung tâm đào tạo chứng chỉ · Kỹ năng nghề | — (후보 없음) | D 직업이 아니라 업장 종류(업무 내용으로만 판정) | 기관 종류 |
| giao_duc_giang_day | co_so_dao_tao_nghe | Cơ sở đào tạo nghề do nhà nước tài trợ | — (후보 없음) | D 직업이 아니라 업장 종류(업무 내용으로만 판정) | 기관 종류 |
| giao_duc_giang_day | ho_tro_van_hanh_trung_tam | Hỗ trợ vận hành trung tâm | 4110 Nhân viên tổng hợp (L4) ⚠→van_phong<br>5312 Người phụ tá cho giáo viên (L4) | C 후보 여러 개·대표 확인 필요 |  |
| giao_duc_giang_day | bien_soan_giao_trinh | Biên soạn giáo trình · Nội dung giáo dục | 2391 Chuyên gia về phương pháp giáo dục (L4)<br>2641 Nhà văn và nghề có liên quan (L4) ⚠→truyen_thong | C 후보 여러 개·대표 확인 필요 |  |

### khac

| 대분류 | 소분류 | 표시 이름 | 후보 공식 코드 · name_vi (단계) | 판정 | 비고 |
|---|---|---|---|---|---|
| khac | (소분류 없음) | Khác | — (후보 없음) | D 직업이 아니라 업장 종류(업무 내용으로만 판정) | 선택으로 정할 수 있는 직업 정보 없음. 업무 내용으로만 판정 |

## 3. 판정 건수

| 판정 | 건수 |
|---|---|
| A 단일 후보(그 단계까지만) | 33 |
| B 상위 코드만(세부는 업무 내용 필요) | 4 |
| C 후보 여러 개·대표 확인 필요 | 67 |
| D 직업이 아니라 업장 종류(업무 내용으로만 판정) | 55 (소분류 54 + khac) |
| 합계 | 159 |

## 4. 역방향 불일치 (후보 코드 → 다른 메뉴 칸)

`category_for_job(후보)` ≠ 고른 대분류인 후보 46건. 그 코드를 쓰면 공고가 고용주가 고른 칸이 아닌 오른쪽 칸 메뉴에 나온다.

| 소분류 | 후보 코드 | 실제 계산되는 칸 |
|---|---|---|
| am_thuc_do_uong.tho_lam_banh | 7512 Thợ nướng bánh, thợ làm bánh ngọt và bánh kẹo | san_xuat_xay_dung |
| quan_ly_ban_hang.md_tmdt | 3323 Nhân viên/đại lý mua hàng | cskh_kinh_doanh |
| dich_vu.le_tan | 4226 Lễ tân (tổng hợp) | cskh_kinh_doanh |
| dich_vu.cay_xang_rua_xe | 5245 Nhân viên phục vụ ở các trạm dịch vụ | quan_ly_ban_hang |
| dich_vu.quan_ly_cho_thue_as | 3334 Nhân viên môi giới bất động sản và quản lý tài sản/bất động sản | cskh_kinh_doanh |
| dich_vu.quan_ly_cho_thue_as | 7421 Thợ cơ khí và thợ dịch vụ điện tử | san_xuat_xay_dung |
| dich_vu.cham_soc_da_massage | 3255 Kỹ thuật viên vật lý trị liệu và phụ tá | y_te_dieu_duong |
| dich_vu.tiec_cuoi_tang_le | 5246 Nhân viên phục vụ đồ ăn uống | quan_ly_ban_hang |
| dich_vu.nhan_vien_su_kien | 3332 Nhân viên tổ chức hội thảo và sự kiện | cskh_kinh_doanh |
| dich_vu.thuyet_minh_quang_cao | 5242 Nhân viên thuyết minh giới thiệu hàng hóa | quan_ly_ban_hang |
| dich_vu.nguoi_mau_thu_do | 5241 Nhân viên làm mẫu | quan_ly_ban_hang |
| dich_vu.moi_gioi_bds | 3334 Nhân viên môi giới bất động sản và quản lý tài sản/bất động sản | cskh_kinh_doanh |
| van_phong.marketing_quang_cao | 2431 Nhà chuyên môn về quảng cáo và tiếp thị | truyen_thong |
| van_phong.marketing_quang_cao | 2432 Nhà chuyên môn về quan hệ công chúng | truyen_thong |
| van_phong.marketing_sns | 2431 Nhà chuyên môn về quảng cáo và tiếp thị | truyen_thong |
| van_phong.photocopy_in_an | 7322 Thợ in | san_xuat_xay_dung |
| van_phong.bien_tap_hieu_dinh | 2642 Nhà báo, biên tập viên | truyen_thong |
| cskh_kinh_doanh.telesale_outbound | 5244 Nhân viên bán hàng qua trung tâm liên lạc | quan_ly_ban_hang |
| cskh_kinh_doanh.kinh_doanh_tai_chinh | 2412 Nhà tư vấn tài chính và đầu tư | van_phong |
| cskh_kinh_doanh.ban_hang_truc_tiep | 5243 Nhân viên bán hàng tận nhà | quan_ly_ban_hang |
| cskh_kinh_doanh.khao_sat_nghien_cuu | 4227 Phỏng vấn viên điều tra và nghiên cứu thị trường | van_phong |
| cskh_kinh_doanh.ho_tro_kinh_doanh | 3341 Giám sát viên văn phòng | van_phong |
| san_xuat_xay_dung.xuat_nhap_kho | 4321 Nhân viên ghi chép tồn kho | van_phong |
| san_xuat_xay_dung.boc_xep_hang | 9621 Người đưa thư, người giao hàng và người khuân vác hành lý | lai_xe_giao_hang |
| san_xuat_xay_dung.nhat_hang_logistics | 4132 Nhân viên nhập dữ liệu | van_phong |
| san_xuat_xay_dung.san_xuat_ban_dan | 3114 Kỹ thuật viên kỹ thuật điện tử | cntt_ky_thuat |
| san_xuat_xay_dung.dien_co_so_vat_chat | 5153 Người chăm sóc, bảo vệ tòa nhà | dich_vu |
| cntt_ky_thuat.len_ke_hoach_web | 2431 Nhà chuyên môn về quảng cáo và tiếp thị | truyen_thong |
| cntt_ky_thuat.lap_dat_thiet_bi_so | 7422 Thợ lắp đặt và dịch vụ kỹ thuật thông tin và truyền thông | san_xuat_xay_dung |
| thiet_ke.thiet_ke_web_mobile | 2513 Nhà phát triển web và truyền thông đa phương tiện | cntt_ky_thuat |
| thiet_ke.thiet_ke_do_hoa_video | 3521 Kỹ thuật viên truyền hình và nghe - nhìn | truyen_thong |
| thiet_ke.cad_cam_noi_that | 3118 Kỹ thuật viên phác thảo kỹ thuật | cntt_ky_thuat |
| lai_xe_giao_hang.van_chuyen_chuyen_nha | 9333 Người mang vác hàng | san_xuat_xay_dung |
| lai_xe_giao_hang.xe_chuyen_dung | 8342 Thợ vận hành máy đào đất và thợ vận hành thiết bị có liên quan | san_xuat_xay_dung |
| lai_xe_giao_hang.xe_chuyen_dung | 8343 Thợ vận hành cần trục và thợ vận hành các thiết bị có liên quan | san_xuat_xay_dung |
| lai_xe_giao_hang.do_xe_ho | 9629 Lao động giản đơn khác chưa được phân vào đâu | dich_vu |
| y_te_dieu_duong.hanh_chinh_benh_vien | 3344 Thư ký y tế | van_phong |
| y_te_dieu_duong.hanh_chinh_benh_vien | 4229 Nhân viên thông tin khách hàng chưa được phân vào đâu | cskh_kinh_doanh |
| y_te_dieu_duong.tro_ly_thi_nghiem | 3111 Kỹ thuật viên khoa học hóa học và vật lý | cntt_ky_thuat |
| giao_duc_giang_day.giao_vien_yoga | 3423 Người hướng dẫn tập luyện và giải trí, người chỉ đạo chương trình | dich_vu |
| giao_duc_giang_day.hlv_the_hinh | 34223 Nhân viên hướng dẫn tập thể hình | dich_vu |
| giao_duc_giang_day.giao_vien_the_thao | 3422 Huấn luyện viên, nhân viên hướng dẫn thể thao và làm việc trong lĩnh vực thể thao | dich_vu |
| giao_duc_giang_day.mam_non_mau_giao | 5311 Nhân viên chăm sóc trẻ em | dich_vu |
| giao_duc_giang_day.ho_tro_dua_don | 5311 Nhân viên chăm sóc trẻ em | dich_vu |
| giao_duc_giang_day.ho_tro_van_hanh_trung_tam | 4110 Nhân viên tổng hợp | van_phong |
| giao_duc_giang_day.bien_soan_giao_trinh | 2641 Nhà văn và nghề có liên quan | truyen_thong |
- **후보 전부가 다른 칸으로 가는 소분류(13개)**: am_thuc_do_uong.tho_lam_banh, dich_vu.quan_ly_cho_thue_as·nhan_vien_su_kien·thuyet_minh_quang_cao·nguoi_mau_thu_do·moi_gioi_bds, van_phong.marketing_quang_cao·marketing_sns, cskh_kinh_doanh.telesale_outbound·khao_sat_nghien_cuu, y_te_dieu_duong.hanh_chinh_benh_vien, giao_duc_giang_day.giao_vien_yoga·hlv_the_hinh.
- **조건부(12개)**: quan_ly_ban_hang의 비판매 업장(phong_hoc_nhom·quan_net·karaoke·bowling_billiard·golf_man_hinh·phong_chieu_phim_da_nang·khu_vui_choi_dien_tu·ca_phe_chu_de·ca_phe_tre_em·sauna_spa·gym_the_thao·tram_dung_nghi)은 코드 5에 `kind=retail`이 붙어야만 같은 칸이다. 업종 판정이 service/fnb이면 dich_vu/am_thuc_do_uong으로 바뀐다(위 표에는 retail 가정으로 계산).
- 원인: 앱 메뉴(알바몬식 업장 기준)와 공식 분류(직무 기준)의 축이 다르다. 이 문서는 대응표만 만들며 `category_rules.json`·`category_for_occupation`을 바꾸지 않는다(바꾸면 기존 공고 메뉴 칸이 바뀜 — 기존 확정 규정 보호 대상).

## 5. 대표 확인 필요 사항 (한 번에)

1. **선택에서 쓰는 단계**: A 줄도 선택만으로는 코드를 넣지 않고 "후보 제시 + 업무 내용 근거 확인 뒤 저장"으로 할지, 아니면 A 줄은 선택 시 그 단계 코드를 미리 채우고 업무 내용이 그 낱말을 담을 때만 공개되게 할지. (초안 제안: 후보 제시만, 확정은 업무 내용 근거.)
2. **D 줄(업장 종류 55개) 처리**: 업무 내용이 없거나 직무를 특정 못 하면 (a) 기존대로 미분류·비공개 보류, (b) 가게(am_thuc·quan_ly·dich_vu)만 Wallace 예외처럼 코드 5 + business_type(고용주가 고른 업장 종류를 업종 근거로 인정) 중 어느 쪽인지. (b)는 기존 예외의 근거 목록(가게 낱말·Google 종류·검색 인용)에 "고용주 선택"을 더하는 것이라 기존 규정 변경이다.
3. **고용주 글을 근거로 인정**: 고용주가 쓴 업무 내용을 `source_text`로, 그 안의 문구를 `occupation_evidence`로 써도 되는지(현재 R3·R8은 원문·Lee 확인 기록 기준). 고용주 직접 작성 공고에도 같은 공개 게이트를 그대로 적용하는 전제.
4. **메뉴 칸 불일치 46건(후보 전부 불일치 13개 소분류)**: 코드 우선(DB가 칸을 다시 계산 — 현재 동작)으로 둘지, 고용주가 고른 대분류를 유지하게 `category_for_job`을 바꿀지. 후자는 DB 함수·기존 공고 칸 변경이다.
5. **C 줄(67개)의 고르는 방법**: 후보 중 하나를 고용주에게 한 번 더 고르게 할지(작성 화면 입력 추가 = 승인된 작성 화면 순서 변경 여부), 아니면 업무 내용으로만 자동·관리자 판정할지. 표의 [추정] 후보(huong_dan_do_xe 962, caddy_golf 9629, kiem_thu_phan_mem 2519)와 phu_bep_rua_bat 9402·dien_vien_quan_chung 2655·thu_nghiem_lam_sang(직업 아님 가능성)도 함께 확인.
6. **구현 등급**: 위 1~5 중 어느 것이든 DB 함수·R8·공개 게이트를 건드리면 STRICT(migration + production_check, Lee Approve)다. 대표가 방향을 정하면 대응표를 데이터 파일로 옮기고 시험(`supabase/tests/occupation_publication.pglite.test.mjs`)에 사례를 넣는 별도 PR로 진행한다.
