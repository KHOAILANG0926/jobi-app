import { richLineIcon, richProcessSteps, richPill } from './detailRich'
import { DETAIL_PALETTE } from './albamonTemplate'
import { salaryAmounts } from './jobDetailSections'
function assert(c: unknown, m: string) { if (!c) throw new Error('FAIL: ' + m) }
// #5876 ZHAN AN(Lee 2026-11-10 "처음으로 마음에 드는"): 줄 아이콘은 줄 낱말로('đóng gói'의 'gói'를 전화로 보지 않음)
assert(richLineIcon('Lắp ráp và đóng gói sản phẩm nhựa.') === 'pack', 'đóng gói → pack')
assert(richLineIcon('Vận hành, hỗ trợ sản xuất tại bộ phận ép nhựa.') === 'operate', 'operate')
assert(richLineIcon('Điện thoại: 0969 661 314') === 'phone' && richLineIcon('Email: zhanan@zhan-an.com') === 'mail', 'contact icons')
assert(richLineIcon('Tiền tăng ca được tính riêng theo quy định.') === 'time', 'overtime')
// 채용 절차: 원문에 나온 단계만, 나온 순서대로
assert(JSON.stringify(richProcessSteps(['vui lòng liên hệ trực tiếp để được tư vấn và sắp xếp phỏng vấn.'])) === JSON.stringify(['Liên hệ', 'Tư vấn', 'Phỏng vấn']), 'steps in order')
assert(richProcessSteps(['Gọi ngay']).length === 0, 'no steps → no arrows')
assert(richProcessSteps(['Không cần phỏng vấn, nhận việc ngay.']).length === 0, 'negated step → no arrows')
// 상여 알약: 대문자 홍보 줄 중 위 급여 반복이 아닌 줄(원문 그대로)
const top = salaryAmounts('7.300.000Đ/THÁNG')
assert(richPill(['LƯƠNG & PHỤ CẤP 7.300.000Đ/THÁNG – CHƯA TÍNH TĂNG CA!', 'THƯỞNG GẮN BÓ ĐẾN 1.000.000Đ', 'Làm đủ 30 ngày: Thưởng 500.000đ.'], top, salaryAmounts) === 'THƯỞNG GẮN BÓ ĐẾN 1.000.000Đ', 'pill')
// 업종 색 13개는 서로 다름
const points = Object.values(DETAIL_PALETTE).map((c) => c.point)
assert(points.length === 13 && new Set(points).size === 13 && new Set(Object.values(DETAIL_PALETTE).map((c) => c.bg)).size === 13, 'distinct industry colors')
console.log('detailRich.test.ts: 통과')
