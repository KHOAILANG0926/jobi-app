// 회사 이름 읽기 한 곳(Lee 2026-11-07). 실제 공고 사례를 모두 여기 모은다 — 새 사례는 여기 추가하고 companyReader.ts를 고친다.
// (옛 페이스북 수집기 extract_company 시험 사례를 옮기고, 2026-11-07 잘못 읽은 실제 글을 더했다.)
import { readCompany, hasNameWord } from './companyReader.ts'
const fails: string[] = []
function eq(a: unknown, b: unknown, name: string) { if (JSON.stringify(a) !== JSON.stringify(b)) fails.push(`${name}: ${JSON.stringify(a)} ≠ ${JSON.stringify(b)}`) }
const n = (t: string) => readCompany(t).name

// 옛 사례(#5157·#5231 등)
eq(n('Công ty có hỗ trợ ăn trưa cho nhân viên'), '', 'benefit sentence is not company')
eq(n('TUYỂN NHÂN VIÊN PHỤC VỤ – TRUNG NGUYÊN LEGEND BẮC NINH\nLương 25k/h'), 'TRUNG NGUYÊN LEGEND BẮC NINH', '#5231 company after title dash')
eq(n('Vị trí tuyển dụng: Thợ hàn'), '', 'field label is not company')
eq(n('🎉 HIGHLANDS COFFEE TÌM ĐỒNG ĐỘI 🎉\n📍 Khu vực làm việc: Highlands Coffee Mường Thanh Bắc Ninh\n👉 Nộp trực tiếp CV tại cửa hàng: Highlands Coffee Mường Thanh Bắc Ninh- Số 395 Ngô Gia Tự'),
  'Highlands Coffee Mường Thanh Bắc Ninh', '#5157 highlands (tại cửa hàng: …)')
eq(n('CTY BÁNH KẸO HỮU NGHỊ – TUYỂN LIÊN TỤC NAM/NỮ\nĐịa điểm: KCN Yên Phong Mở Rộng – Bắc Ninh'), 'CTY BÁNH KẸO HỮU NGHỊ', '#5633 cty line')
eq(n('NETCO POST TUYỂN DỤNG TÀI XẾ – BẮC NINH\nThu nhập: 13 – 15 triệu/tháng'), 'NETCO POST', '#5599 before TUYỂN DỤNG')
eq(n('Công ty EAGLEON khu công nghiệp ECO Châu Cầu - Bắc Ninh\nTUYỂN DỤNG LAO ĐỘNG THỜI VỤ'), 'Công ty EAGLEON khu công nghiệp ECO Châu Cầu - Bắc Ninh', '#5595 cty line')

// 2026-11-07 잘못 읽었던 실제 글 → 바르게(또는 빈칸)
eq(n('CƠ HỘI VIỆC LÀM TẠI VINAMILK - BẮC NINH\nKHU VỰC: Nguyễn Cao\nVị trí: NHÂN VIÊN BÁN HÀNG CỬA HÀNG\nThu nhập: 8 – 12 triệu/tháng.'), 'VINAMILK', 'tại VINAMILK (not "Thu nhập: 8")')
eq(n('TUYỂN NHÂN VIÊN LÀM THỜI VỤ HOẶC LÂU DÀI\nĐóng Gói Quần Áo 9 - 12 tr\nBán Hàng Tại Shop 9tr'), '', 'shop 9tr is not company')
eq(n('TUYỂN NAM/NỮ LĐPT – VIỆC NHẸ, DỄ LÀM\nCông việc: Lựa tem nhãn'), '', 'slogan after dash is not company')
eq(n('TUYỂN HỌC VIÊN HỌC MAY MIỄN PHÍ – ĐÀO TẠO TỪ NGƯỜI CHƯA BIẾT MAY!'), '', 'promo sentence is not company')
eq(n('TP. Bắc Ninh - Nhân viên tuyển dụng\nLương cứng: 7tr8'), '', 'region + job words is not company')
eq(n('TUYỂN DỤNG NHIỀU VỊ TRÍ - CƠ HỘI VIỆC LÀM CHO NGÀNH SẢN XUẤT\nYC: yêu cầu Tiếng Trung'), '', 'job words only')
eq(n('Nhà hàng trung quốc cần tuyển\nNhân viên : 3 nhân viên phục vụ'), '', 'country word is not a name')
eq(n('Nhà chị cần tuyển 3 phụ bếp , 2 chạy bàn'), '', 'no company')
eq(n('Quán NET&BIDA Kito Gaming tuyển 3 nhân viên nam nữ\nBAO ĂN Ở'), 'Quán NET&BIDA Kito Gaming', 'shop name kept')
eq(n('Cuối Năm Cửa Hàng Quần Áo Khánh Ly Cần Tuyển Thêm Nhân Viên\nCông việc : Đóng Gói'), 'Cửa Hàng Quần Áo Khánh Ly', 'shop name')
eq(n('SPA HOÀNG KIM PHÚ KIỀU MỚI KHAI TRƯƠNG TUYỂN DỤNG 05 NHÂN VIÊN MASSAGE NỮ'), 'SPA HOÀNG KIM PHÚ KIỀU', 'spa name')
eq(n('HỆ THỐNG SIÊU THỊ ĐIỆN MÁY MEDIAMART TUYỂN DỤNG – KHU VỰC BẮC NINH'), 'SIÊU THỊ ĐIỆN MÁY MEDIAMART', 'mediamart')
eq(n('SEN TÀI THU TUYỂN DỤNG KỸ THUẬT VIÊN TRỊ LIỆU\nThu nhập: 15–20 triệu/tháng'), 'SEN TÀI THU', 'before TUYỂN DỤNG')

// 소개소·수수료
const ag = readCompany('Công ty Nhân lực Minh Anh tuyển gấp 50 LĐPT làm tại nhà máy KCN Quế Võ\nKhông thu phí')
eq([ag.name, ag.agency, ag.fee], ['Công ty Nhân lực Minh Anh', true, false], 'agency with workplace, no fee')
eq(readCompany('Công ty Nhân lực Minh Anh tuyển gấp làm tại KCN Quế Võ\nPhí tuyển dụng 500k').fee, true, 'fee charged')
eq(readCompany('Công ty TNHH Nhân lực ABC tuyển nhân viên văn phòng tại công ty').agency, false, 'agency words but no other workplace → not agency')
eq(hasNameWord('Thu nhập: 8'), false, 'numbers + job words'); eq(hasNameWord('Hữu Nghị'), true, 'ordinary-word name kept')
if (fails.length) throw new Error('\n' + fails.join('\n'))
console.log('companyReader: 옛 사례 · 2026-11-07 잘못 읽은 글 · 가게 이름 · 소개소/수수료 통과')
