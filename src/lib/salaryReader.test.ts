// 급여 읽는 곳 하나(salaryReader.ts) — 옛 수집기(Python extract_salary) 시험 사례를 옮김 + 실제 공고(2026-11-01).
import { readSalary, posterSalaryEvidence } from './salaryReader.ts'
function eq(got: unknown, want: unknown, name: string) { if (JSON.stringify(got) !== JSON.stringify(want)) throw new Error(`${name}: ${JSON.stringify(got)} ≠ ${JSON.stringify(want)}`) }
const s = (src: string, ocr?: string) => readSalary(src, ocr)

// ① 이름표 줄은 원문 그대로(#5231 실제 원문 — 다시 수집이 급여를 빈 값으로 덮은 사고)
const T5231 = 'TUYỂN NHÂN VIÊN PHỤC VỤ – TRUNG NGUYÊN LEGEND BẮC NINH\n Vị trí tuyển dụng: Nhân viên phục vụ (Part-time/Full-time)\n Mức lương: 23.000 – 25.000 VNĐ/giờ (xét tăng theo năng lực)\nĐộ tuổi: từ đủ 18 tuổi trở lên'
eq(s(T5231)?.salary, '23.000 – 25.000 VNĐ/giờ (xét tăng theo năng lực)', '#5231 labeled hourly')
eq(s(T5231)?.period, 'hour', '#5231 period')
eq(s('TUYỂN DỤNG QUẢN LÝ DỰ ÁN - KCN VSIP BẮC NINH\n LƯƠNG: upto 30 TRIỆU/THÁNG\n YÊU CẦU')?.salary, 'upto 30 TRIỆU/THÁNG', '#4682 labeled upto kept')
eq(s('Quán nhậu cần tuyển\n1/phụ bếp có kinh nghiệm\nLương : 8 triệu đến 12 triệu tuỳ năng lực')?.salary, '8 triệu đến 12 triệu tuỳ năng lực', 'labeled with spaced colon')
// ② 이름표 없는 금액(옛 수집기 규칙)
eq(s('Tuyển phục vụ quán cafe\n8.5 – 10tr/tháng, làm ca sáng')?.salary, '8.5 – 10tr/tháng', 'unlabeled range month suffix')
eq(s('Tuyển phục vụ quán cafe\n8.5 – 10tr/tháng, làm ca sáng')?.period, 'month', 'unlabeled period')
eq(s('Cần tuyển 2 bạn phục vụ, lương 7 triệu/tháng, ưu tiên nữ')?.salary, '7 triệu/tháng', 'inline lương amount')
eq(s('Thưởng 2 triệu khi đủ công\nLương cứng 7 triệu')?.salary, '7 triệu', 'salary line before bonus line')
eq(s('Nhận 8 trên 10 bạn đi làm ngay, liên hệ 0912345678'), null, '"tr" inside a word is not money')
// ③ 포스터 금액(이름표·금액이 원문에 없을 때) ④ 원문 "cạnh tranh"(#5157 Highlands)
const H5157 = '🎉 HIGHLANDS COFFEE TÌM ĐỒNG ĐỘI 🎉\n💎 Quyền lợi:\n• Thu nhập cạnh tranh, có hỗ trợ ăn ca khi làm ca 8 tiếng, ca gãy\n👉 Ibox hoặc liên hệ Mr Tuấn Minh: 0365102703'
eq(s(H5157, 'LƯƠNG 26K/giờ PARTTIME\nFULLTIME 7-9 triệu/tháng')?.salary, 'Theo poster: 26K/giờ · 7-9 triệu/tháng', '#5157 poster wages')
eq(s(H5157)?.salary, 'Thu nhập cạnh tranh', '#5157 vague wording kept verbatim, nothing invented')
eq(s('Lương: thỏa thuận\nLiên hệ 0912345678')?.salary, 'thỏa thuận', 'negotiable wording verbatim')
eq(posterSalaryEvidence('Số 395 Ngô Gia Tự, 0365102703'), [], 'never infer wage from address or phone')
eq(s(''), null, 'empty')
console.log('salaryReader: all assertions passed')
