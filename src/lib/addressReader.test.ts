// 주소 읽기 한 곳(Lee 2026-11-07). 실제 공고 사례를 모두 여기 모은다 — 새 사례는 여기 추가하고 addressReader.ts를 고친다.
// (옛 페이스북 수집기 crawl_facebook.extract_district 시험 사례를 그대로 옮겼다.)
import { readAddress, readLocationText } from './addressReader.ts'
function eq(a: string, b: string, name: string) { if (a !== b) throw new Error(`${name}: ${JSON.stringify(a)} ≠ ${JSON.stringify(b)}`) }

const HIGHLANDS_5157 = `🎉 HIGHLANDS COFFEE TÌM ĐỒNG ĐỘI 🎉
📍 Khu vực làm việc: Highlands Coffee Mường Thanh Bắc Ninh
🏠 Địa điểm:  Số 395 Ngô Gia Tự, Phường Kinh Bắc, Tỉnh Bắc Ninh
🔎 Vị trí tuyển dụng:
• Nhân viên Bán hàng (Sales)  Fulltime- partime
• Nhân viên Pha chế (Barista) Fulltime- partime
💎 Quyền lợi:
• Thu nhập cạnh tranh, có hỗ trợ ăn ca khi làm ca 8 tiếng, ca gãy
📩 Cách nộp hồ sơ:
👉 Ibox hoặc liên hệ Mr Tuấn Minh: 0365102703
👉 Nộp trực tiếp CV tại cửa hàng: Highlands Coffee Mường Thanh Bắc Ninh- Số 395 Ngô Gia Tự, Phường Kinh Bắc, Tỉnh Bắc Ninh`

const NETCO_5599 = `NETCO POST TUYỂN DỤNG TÀI XẾ – BẮC NINH
KHÔNG CỌC – KHÔNG PHÍ TUYỂN DỤNG
THỬ VIỆC 01 THÁNG NHẬN 100% LƯƠNG
Ca ngày - ca đêm
Thu nhập: 13 – 15 triệu/tháng
📍 Tiểu KCN Ba Bên, Từ Sơn, Bắc Ninh
Yêu cầu: Nam, bằng lái hạng C, có kinh nghiệm 1 năm lái xe
ỨNG TUYỂN NGAY: 0585 812 600 – Hải Yến (Zalo)`

// ① 이름표 붙은 주소 줄(#5157): 번지 포함 그대로
eq(readAddress(HIGHLANDS_5157), 'Số 395 Ngô Gia Tự, Phường Kinh Bắc, Tỉnh Bắc Ninh', '#5157 labeled address line')
// ② 이름표 없는 주소 줄(#5599)
eq(readAddress(NETCO_5599), 'Tiểu KCN Ba Bên, Từ Sơn, Bắc Ninh', '#5599 unlabeled address line')
eq(readAddress('NETCO POST TUYỂN DỤNG TÀI XẾ – BẮC NINH\nLương 8 triệu, thưởng, Bắc Ninh'), '', 'title/salary lines are not addresses')
eq(readAddress('🏢 Làm việc tại: Lý Đạo Thành, Phường Kinh Bắc, Bắc Ninh'), 'Lý Đạo Thành, Phường Kinh Bắc, Bắc Ninh', 'other label prefix removed')
// ③ 조각: 베트남어 낱말 속 p는 위치가 아님(FUSHAN)
eq(readAddress('Làm ngồi, phòng thường\nđộ tuổi từ 18 đến 45\nđịa chỉ tại Vsip - Bắc Ninh'), '', 'plain p in Vietnamese words must not become location')
eq(readAddress('Cần tuyển phục vụ quán ăn\nZalo 0911111111'), '', 'no address text → empty')
// 조합 글자(NFD)로 적힌 글도 같게 읽음
eq(readAddress(HIGHLANDS_5157.normalize('NFD')), 'Số 395 Ngô Gia Tự, Phường Kinh Bắc, Tỉnh Bắc Ninh', 'combining marks')
// 위치 글자 = 원문 주소 + 그룹 지역(수집기가 원문에 이름이 있을 때만 넘김)
eq(readLocationText(NETCO_5599, 'Bắc Ninh'), 'Tiểu KCN Ba Bên, Từ Sơn, Bắc Ninh, Bắc Ninh', 'address + group region (같은 결합 방식)')
eq(readLocationText('Cần tuyển ở BẮC NINH', 'Bắc Ninh'), 'Bắc Ninh', 'region only')
console.log('addressReader: #5157 이름표 줄 · #5599 이름표 없는 줄 · 제목/급여 줄 제외 · 낱말 속 p 제외 통과')

// 2026-11-09 #560 시험 원문
eq(readAddress('TUYỂN NHÂN VIÊN PARTIME\nLương 30k-35k/h\nĐịa chỉ: Nhà hàng Seoseo Galbi\n213 Ngọc Hân Công Chúa, Phường Võ Cường, TP Bắc Ninh\nLiên hệ qua zalo'), '213 Ngọc Hân Công Chúa, Phường Võ Cường, TP Bắc Ninh', '#560-1 shop name on label, street on next line')
eq(readAddress('Địa chỉ: Nhà hàng Seoseo Galbi\nLiên hệ 0912345678'), 'Nhà hàng Seoseo Galbi', 'next line not an address keeps label value')
eq(readAddress('em cần tìm việc ở thành phố bắc ninh\n댓글\nAi đó\nĐịa chỉ: 99 Lý Thái Tổ, Bắc Ninh'), 'thành phố bắc ninh', '#560-5 comment address is not the post address')
eq(readAddress('Địa chỉ: KCN Yên Phong, Bắc Ninh\n2 ca xoay: 6h-14h và 14h-22h'), 'KCN Yên Phong, Bắc Ninh', 'Codex #616: working-hours line is not an address')
eq(readAddress('Địa chỉ: Nhà hàng Hoa Sen\n20 người, ca xoay'), 'Nhà hàng Hoa Sen', 'Codex #616: head-count line is not an address')
eq(readAddress('ĐỢT TUYỂN DỤNG NHÂN VIÊN TẠI JOLLIBEE TRẦN HƯNG ĐẠO TỚI ĐÂY\nDo nhu cầu kinh doanh, Cửa hàng Jollibee 393 Trần Hưng Đạo tuyển dụng nhân viên part time:\n Tuổi từ 18- 25.'), '393 Trần Hưng Đạo', '#633 house number + street after shop name')
eq(readAddress('CÔNG TY JMT KCN QUẾ VÕ 2\nTuyển 20 nam nữ\nLương 9tr'), 'KCN QUẾ VÕ 2', '#633 KCN name only in title line')
eq(readAddress('CÔNG TY JMT KCN QUẾ VÕ 2 TUYỂN 20 NAM NỮ\nLương 9tr'), 'KCN QUẾ VÕ 2', '#633 KCN name stops before TUYỂN')
eq(readAddress('Tuyển nhân viên phục vụ\nNhà hàng 5 Sao rất đẹp'), '', '#633 number in shop name without street is not an address')
console.log('addressReader: #560 cases passed')
