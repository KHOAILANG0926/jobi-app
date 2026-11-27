import { photoCategory, jobPhotoUrl, industryPhotoUrl, managedPhoto, managedPhotoKind, photoEnvironment } from './cardPhoto.ts'
import { detailLook } from './albamonTemplate.ts'
import { jobRoleInfo } from './jobRoles.ts'
import { rowToJob } from './jobRows.ts'

// 직무 중심 대표 이미지 선택(2026-11-27 Lee 승인): 실제 모집 직무 우선, 근무환경 보조, 직무에 맞는 사진이 없으면 중립 기본 사진.
// 운영 공개 공고 30건을 바꾸기 전·후 코드로 계산해 비교하면 27건은 카드·상세 ④ 사진이 그대로이고 6337·5994·5368만 바뀐다(PR 본문 [직접 확인]).
const eq = (a: unknown, b: unknown, note: string) => { if (JSON.stringify(a) !== JSON.stringify(b)) throw new Error(`${note}: ${JSON.stringify(a)} !== ${JSON.stringify(b)}`) }
const D6337 = "Công việc\nVỊ TRÍ:\n3 Nam & Nữ Phục Vụ : 7tr5~ 12tr\n2 Nữ oder : 8tr~11tr + tip\n1 Nam Làm Bếp : 8tr5 ~ 14tr\n2 Cô Tạp Vụ : 7 - 8tr\n+500k phụ cấp\nQuyền lợi\nHỖ TRỢ ĂN Ở ( phòng riêng,đầy đủ điều hòa nóng lạnh)\nQuy trình tuyển dụng\nSdt: 0833.210.308\nThông tin khác\nMỲ CAY YAGAMI ĐANG TUYỂN NHÂN VIÊN\nĐịa chỉ : Lê Đức Thọ - Nam Từ Liêm - Hà Nội"
const D5994 = "Công việc\nCác vị trí tuyển dụng:\n1. Quản lý giao hàng lắp đặt\n2. Nhân viên giao hàng kiêm lắp đặt sản phẩm\n3. Nhân viên Bảo hành\n4. Nhân viên lái xe\n5. Nhân viên bán hàng\nYêu cầu chung:\nNam/Nữ, từ 18 tuổi trở lên\nThu nhập\nThu nhập hấp dẫn, từ 10–15 triệu/tháng tùy vị trí và năng lực\nQuyền lợi\nHưởng đầy đủ BHXH, BHYT, BHTN theo quy định\nQuy trình tuyển dụng\nMs. Hải Anh – 037 261 9126\nHai Anh Anh\nThông tin khác\nHỆ THỐNG SIÊU THỊ ĐIỆN MÁY MEDIAMART TUYỂN DỤNG – KHU VỰC BẮC NINH\nLàm việc tại các trung tâm:\n- CN Bắc Ninh: Số 37 Đường Lý Thái Tổ, P. Võ Cường, TP. Bắc Ninh\n- CN Từ Sơn: Đường Trần Phú, Phường Từ Sơn, Thành phố Bắc Ninh, Việt Nam\n- Quế Võ: Khu phố Mao Dộc, Phường Phương Liễu , Tỉnh B"
const D5368 = "Công việc\nVỊ TRÍ CÔNG VIỆC: Nhân viên bảo vệ (Kho, nhà máy, văn phòng, công trình, trung tâm thương mại,...)\nYêu cầu\nNam / Nữ độ tuổi từ 18 – 60 tuổi.\nCó sức khỏe tốt, trung thực, trách nhiệm.\nKHÔNG yêu cầu kinh nghiệm – Nhận việc sẽ được đào tạo nghiệp vụ bài bản từ đầu.\nHồ sơ đơn giản: Sơ yếu lý lịch, CCCD công chứng, Giấy khám sức khỏe, Bằng cấp/chứng chỉ (nếu có).\nThời gian làm việc\nTHỜI GIAN "
const make = (o: { category: string; code: string; company: string; title: string; description: string }) => {
  const info = jobRoleInfo({ description: o.description, occupationCode: o.code })
  return { category: o.category, company: o.company, title: o.title, description: o.description, occupationCode: o.code, ...info }
}
const yagami = make({ category: 'dich_vu', code: '9112', company: 'MỲ CAY YAGAMI', title: 'MỲ CAY YAGAMI ĐANG TUYỂN NHÂN VIÊN', description: D6337 })
const mediamart = make({ category: 'lai_xe_giao_hang', code: '8322', company: 'SIÊU THỊ ĐIỆN MÁY MEDIAMART', title: 'HỆ THỐNG SIÊU THỊ ĐIỆN MÁY MEDIAMART TUYỂN DỤNG – KHU VỰC BẮC NINH', description: D5994 })
const guard = make({ category: 'dich_vu', code: '540', company: 'Công ty Cổ phần Dịch vụ Bảo vệ Bảo An VCC', title: 'Tuyển gấp 200 nhân viên bảo vệ tại Bắc Ninh', description: D5368 })

// 식당 복수 직무(서빙·주문·주방·잡일) → 대표 직무(서빙)의 업종 = 음식 → 식당 그림. 청소 직무는 검색에는 남는다(jobRoles.test).
eq(photoCategory(yagami), 'am_thuc_do_uong', '6337 representative role decides the photo group')
eq(jobPhotoUrl(yagami), '/images/industry/ordering_noodle_restaurant/ordering_noodle_restaurant_001.webp', '6337 card = noodle-restaurant ordering picture (role 5131 + env pho)')
eq(detailLook(photoCategory(yagami), 6337, null, 'MỲ CAY YAGAMI', 'MỲ CAY YAGAMI ' + D6337, null, yagami.primaryRoleCode).photo.startsWith('/images/industry/ordering_noodle_restaurant/'), true, '6337 detail = same picture set as the card')
// 가전 마트의 배송·운전·판매 복수 직무 → 직무들을 포괄하는 근무환경(가전 매장).
eq(photoCategory(mediamart), 'quan_ly_ban_hang', '5994 environment covers delivery+sales roles')
eq(jobPhotoUrl(mediamart), '/images/industry/ban_hang_dien_may.jpg', '5994 card = electronics store')
// 단일 직무 경비원 → 경비 직무 사진이 아직 없으므로 서비스 업종의 미용실·청소기 사진을 쓰지 않고 기본 사진.
eq(jobPhotoUrl(guard), '/images/industry/khac.jpg', '5368 guard: no salon, no vacuum')
eq(detailLook(photoCategory(guard), 5368, null, 'x', 'x', null, guard.primaryRoleCode).photo, '/images/industry/khac.jpg', '5368 detail same as card')
// 직무가 맞는 사진은 카드·상세가 같다: 청소원 → 청소 사진, 미용사 → 미용실 사진.
eq(industryPhotoUrl('dich_vu', null, 'x', 'x', '9112'), '/images/industry/dich_vu.jpg', 'cleaner → cleaning photo')
eq(detailLook('dich_vu', 1, null, 'x', 'x', null, '9112').photo, '/images/industry/dich_vu.jpg', 'cleaner detail = card')
eq(managedPhoto('dich_vu', '5141', 1)?.startsWith('/images/template/04'), true, 'hairdresser → salon photo')
// 목록에 없는 업종은 기존 선택 그대로(음식·판매·공장 등 27건 회귀 없음).
eq(managedPhoto('khac', '5131', 1), undefined, 'groups not in the list use the existing selection')
eq(managedPhoto('am_thuc_do_uong', '5131', 1, 'nha_hang_nuong'), undefined, 'BBQ restaurant keeps its own legacy photo (no generic restaurant picture)')
eq(managedPhoto('am_thuc_do_uong', '5131', 1, 'cafe')?.includes('ordering_cafe'), true, 'cafe ordering picture')
eq(photoCategory({ category: 'am_thuc_do_uong', occupationCode: '5131', roleCodes: ['5131', '9402'] }), 'am_thuc_do_uong', 'same-group multi-role unchanged')
eq(photoCategory({ category: 'am_thuc_do_uong', occupationCode: '5', roleCodes: ['5'] }), 'am_thuc_do_uong', "code '5' unchanged")
eq(managedPhotoKind('/images/template/04-dich-vu.jpg'), 'ai', 'AI picture is marked')
eq(managedPhotoKind('/images/industry/dich_vu.jpg'), 'stock', 'stock photo is marked')
// 고정 배정: 저장된 이미지 번호가 있으면 이미지가 추가돼도 그 이미지 그대로(번호만 목록에 있으면 된다).
eq(managedPhoto('dich_vu', '9112', 7, null, 'dich_vu-salon-002'), '/images/template/04b-dich-vu.jpg', 'assigned id is honoured')
eq(managedPhoto('dich_vu', '5141', 1, null, 'no-such-id'), managedPhoto('dich_vu', '5141', 1), 'unknown assigned id falls back to computed pick')
eq(jobPhotoUrl({ ...guard, representativeImageId: 'dich_vu-cleaning-001' }), '/images/industry/dich_vu.jpg', 'assigned id wins in jobPhotoUrl')
// 근무환경 낱말은 기존 낱말표 그대로.
eq(photoEnvironment('Nhà hàng nướng Ngô Tất Tố'), 'nha_hang_nuong', 'bbq restaurant')
eq(photoEnvironment('Highlands Coffee'), 'cafe', 'cafe')
eq(photoEnvironment('SIÊU THỊ ĐIỆN MÁY MEDIAMART'), 'ban_hang_dien_may', 'electronics store')
eq(photoEnvironment('Tuyển bảo vệ cho khu công nghiệp VSIP'), 'nha_may', 'industrial park')
eq(photoEnvironment('Tuyển nhân viên kho hàng Bắc Ninh'), 'kho_hang', 'warehouse')
eq(photoEnvironment('Công việc không khó, kho hàng'), 'kho_hang', 'khó (hard) is not kho')
eq(photoEnvironment('Công việc không khó'), null, 'hard is not a warehouse')
eq(photoEnvironment('Quán phở Hà Nội tuyển phục vụ'), 'nha_hang_pho', 'noodle shop')
eq(photoEnvironment('MỲ CAY YAGAMI'), 'nha_hang_pho', 'spicy noodle shop')
eq(photoEnvironment('Tuyển công nhân', 'Công ty điện tử Samsung'), 'nha_may_dien_tu', 'electronics factory from company name')
eq(photoEnvironment('Công ty nhựa ABC tuyển công nhân ép nhựa', 'Công ty nhựa ABC'), 'nha_may_nhua', 'plastics factory')
eq(photoEnvironment('Công ty bánh kẹo Hữu Nghị', 'Công ty bánh kẹo Hữu Nghị'), 'nha_may', 'other factory kinds stay generic factory')
eq(photoEnvironment('Tuyển nhân viên'), null, 'unknown environment')
// 저장된 배정 번호는 DB 행에서 그대로 화면까지: rowToJob이 representative_image_id를 읽고, 사진 선택이 그 이미지를 쓴다.
const stored = rowToJob({ id: 9001, title: 'Tuyển bảo vệ', company: 'Công ty X', category: 'dich_vu', occupation_code: '540', description: 'Công việc\nBảo vệ', representative_image_id: 'dich_vu-salon-002' })
eq(stored.representativeImageId, 'dich_vu-salon-002', 'rowToJob maps representative_image_id')
eq(jobPhotoUrl(stored), '/images/template/04b-dich-vu.jpg', 'stored assignment wins over the computed pick')
eq(rowToJob({ id: 9002, title: 't', company: 'c', category: 'dich_vu', occupation_code: '540', description: 'd' }).representativeImageId, undefined, 'null column = not assigned')
console.log('representativePhoto: role-first selection checks passed')
