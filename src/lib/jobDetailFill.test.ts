import { fillMissingLines, isCovered, FILL_HEADINGS, KIND_RULES } from './jobDetailFill.ts'
import { detailSections, headingOf } from './jobDetailSections.ts'
function assert(ok: boolean, name: string) { if (!ok) throw new Error(name) }
const show = (r: ReturnType<typeof fillMissingLines>) => r.added.map((a) => `${a.key} ${a.how} | ${a.line}`)

// ── 정답표: 실제 운영 공고 원문(local_jobs, 2026-10-20 조회) ──
const myDesc = `Công việc\n- Sản xuất dây truyền dữ liệu, dây mạng.\nYêu cầu\n- Nhanh nhẹn, chăm chỉ, chịu khó.\n- Có tinh thần trách nhiệm trong công việc.\nThời gian làm việc\n- Chuyên ca ngày.\n- Tuyển cả công nhân chính thức và thời vụ, ưu tiên người muốn làm lâu dài.\nLương và phúc lợi\n- Lương cơ bản: 5.500.000đ/tháng.\n- Phụ cấp: 1.200.000đ/tháng.\n- Thâm niên sau 2 tháng: +200.000đ; sau 4 tháng: +300.000đ.\n- Làm ngồi, thoải mái. Không bắt buộc tăng ca.\nĐịa điểm làm việc\n- Khu phố Mao Yên, phường Phương Liễu, Bắc Ninh.\nLiên hệ\n- Điện thoại: 0342017663.`
const myOcr = `TUYỂN\nCÔNG NHÂN\nCHÍNH THỨC & THỜI VỤ\nGắn bó lâu dài\nViệc làm ổn định\nThu nhập tốt\nMôi trường thoải mái\n\nMỨC LƯƠNG & PHỤ CẤP\nLương cơ bản: 5.500.000đ/tháng\nPhụ cấp: 1.200.000đ/tháng\nThâm niên sau 2 tháng: +200.000đ\nThâm niên sau 4 tháng: +300.000đ\n\nCÔNG VIỆC\nSản xuất dây truyền dữ liệu, dây mạng.\n\nQUYỀN LỢI & MÔI TRƯỜNG LÀM VIỆC\nChuyên ca ngày.\nLàm ngồi, thoải mái.\nKhông cửa từ, môi trường làm việc thoải mái.\nKhông bắt buộc tăng ca.\nTuyển cả công nhân chính thức và thời vụ, ưu tiên người muốn làm lâu dài.\n\nYÊU CẦU\nNhanh nhẹn, chăm chỉ, chịu khó.\nCó tinh thần trách nhiệm trong công việc.\n\nTHÔNG TIN CÔNG TY\nCông ty làm về dây đấu truyền, dây mạng.\n\nĐỊA CHỈ\nKhu phố Mao Yên, phường Phương Liễu, Bắc Ninh.\n\nLIÊN HỆ\n0342017663\n\nAi có nhu cầu tìm việc, vui lòng liên hệ trực tiếp để trao đổi và nhận việc nhé!\nMọi người chia sẻ để giúp đỡ ai đang cần việc làm biết đến ai!`
const mySrc = `TUYỂN CÔNG NHÂN\nCHÍNH THỨC & THỜI VỤ\nGắn bó lâu dài\nViệc làm ổn định\nThu nhập tốt\nMôi trường thoải mái\nMỨC LƯƠNG & PHỤ CẤP\nLương cơ bản: 5.500.000đ/tháng\nPhụ cấp: 1.200.000đ/tháng\nThâm niên sau 2 tháng: +200.000đ\nThâm niên sau 4 tháng: +300.000đ\nCÔNG VIỆC\nSản xuất dây truyền dữ liệu, dây mạng.\nQUYỀN LỢI & MÔI TRƯỜNG LÀM VIỆC\nChuyên ca ngày.\nLàm ngồi, thoải mái.\nKhông bắt buộc tăng ca.\nTuyển cả công nhân chính thức và thời vụ, ưu tiên người muốn làm lâu dài.\nYÊU CẦU\nNhanh nhẹn, chăm chỉ, chịu khó.\nCó tinh thần trách nhiệm trong công việc.\nTHÔNG TIN CÔNG TY\nĐỊA CHỈ\nKhu phố Mao Yên, phường Phương Liễu, Bắc Ninh.\nLIÊN HỆ\n0342017663\nAi có nhu cầu tìm việc, vui lòng liên hệ trực tiếp để trao đổi và nhận việc nhé!\nMọi người chia sẻ giúp để ai đang cần việc làm biết đến ạ!`
const myCtx = { title: 'Tuyển công nhân sản xuất dây truyền dữ liệu, dây mạng', phones: ['0342017663'], addresses: ['Khu phố Mao Yên, phường Phương Liễu, Bắc Ninh'] }
const my = fillMissingLines(myDesc, [{ name: 'source_text', text: mySrc }, { name: 'ocr_text', text: myOcr }], myCtx)
const myWant = [
  '07 unclassified | Gắn bó lâu dài',
  '07 unclassified | Việc làm ổn định',
  '07 unclassified | Thu nhập tốt',
  '07 unclassified | Môi trường thoải mái',
  '07 unclassified | Ai có nhu cầu tìm việc, vui lòng liên hệ trực tiếp để trao đổi và nhận việc nhé!',
  '07 unclassified | Mọi người chia sẻ giúp để ai đang cần việc làm biết đến ạ!',
  '05 heading | Không cửa từ, môi trường làm việc thoải mái.',
  '07 heading | Công ty làm về dây đấu truyền, dây mạng.',
]
assert(JSON.stringify(show(my)) === JSON.stringify(myWant), `#4828 빠진 줄 정답표와 다름: ${JSON.stringify(show(my))}`)
assert(my.stillMissing.length === 0, '#4828 붙인 뒤 빠진 줄 없음')
const myView = detailSections(my.description, myCtx)
assert(myView.preserved && !myView.usedFallback, '#4828 붙인 글도 칸 나누기 성공')
assert(myView.sections.find((s) => s.key === '05')!.lines.includes('Không cửa từ, môi trường làm việc thoải mái.'), '#4828 Không cửa từ → 05')
assert(myView.sections.find((s) => s.key === '07')!.lines.includes('Công ty làm về dây đấu truyền, dây mạng.'), '#4828 회사 소개 → 07')
// 두 번 돌려도 더 붙이지 않는다(같은 줄 반복 방지)
const again = fillMissingLines(my.description, [{ name: 'source_text', text: mySrc }, { name: 'ocr_text', text: myOcr }], myCtx)
assert(again.added.length === 0 && again.description === my.description, '이미 붙인 공고는 그대로')

const kDesc = `Công việc\n- Làm ngồi linh kiện tai nghe.\n\nYêu cầu\n- Tuyển nam, nữ (14-50 tuổi).\n\nLương và phúc lợi\n- Ca ngày: 310k/11h.\n- Ca đêm: 360k/11h.\n- Chuyên cần: 50k/tuần.\n- Lương tính và thanh toán theo ngày.\n- Có xe đưa đón.\n- Được mang điện thoại vào xưởng.\n\nĐịa điểm làm việc\n- KCN Yên Phong, Bắc Ninh.\n\nLiên hệ\n- NGOC ANH DUONG: 0877 880 756`
const kSrc=`Liên hệ 08.778.807.56 ( NGOC ANH DUONG)\n\nKCN YÊN PHONG\nCTY KDA\nTUYỂN FULL\nNAM , NỮ (14-50t)\nLàm ngồi linh kiện tai nghe\nMỨC LƯƠNG\nCa ngày: 310k/11h\nCa đếm: 360k/11h\nChuyên cần 50k/tuần\nLương tính và thanh toán theo ngày\nCó xe đưa đón\nĐược mang điện thoại vào xưởng\nThu nhập ổn định\nCông việc lâu dài!\nMôi trường sạch sẽ\n- Quy trình rõ ràng\n- Công việc ổn định\nNhanh tay ứng tuyển để có công việc tốt nhé!\nLiên hệ: 0877 880 756`
const kda = fillMissingLines(kDesc, [{ name: 'source_text', text: kSrc }], { title: 'CTY KDA tuyển nam, nữ làm linh kiện tai nghe tại KCN Yên Phong', company: 'KDA', phones: ['0877880756'], addresses: ['KCN Yên Phong, Bắc Ninh', 'KCN YÊN PHONG'] })
const kdaWant = [
  '07 unclassified | TUYỂN FULL',
  '07 unclassified | Thu nhập ổn định',
  '07 unclassified | Công việc lâu dài!',
  '05 heading | Môi trường sạch sẽ',
  '07 unclassified | - Quy trình rõ ràng',
  '07 unclassified | - Công việc ổn định',
  '07 unclassified | Nhanh tay ứng tuyển để có công việc tốt nhé!',
]
assert(JSON.stringify(show(kda)) === JSON.stringify(kdaWant), `#4824 빠진 줄 정답표와 다름: ${JSON.stringify(show(kda))}`)

// ── 원문 글자 그대로: 붙인 줄은 원문과 한 글자도 다르지 않다 ──
for (const a of [...my.added, ...kda.added]) assert(my.description.includes(a.line) || kda.description.includes(a.line), `글자 그대로: ${a.line}`)
// ── 붙일 때 쓰는 소제목은 상세요강이 같은 칸으로 읽는다 ──
for (const [key, h] of Object.entries(FILL_HEADINGS)) assert(headingOf(h) === key, `소제목 ${h} → ${key}`)
// ── 이미 있는 줄(표기만 다름)은 다시 붙이지 않는다 ──
assert(isCovered('NAM , NỮ (14-50t)', ['- Tuyển nam, nữ (14-50 tuổi).']), '14-50t = 14-50 tuổi')
assert(isCovered('Thâm niên sau 4 tháng: +300.000đ', ['- Thâm niên sau 2 tháng: +200.000đ; sau 4 tháng: +300.000đ.']), '합친 줄도 있음으로 봄')
assert(!isCovered('Không cửa từ, môi trường làm việc thoải mái.', ['- Làm ngồi, thoải mái. Không bắt buộc tăng ca.']), '비슷한 낱말 몇 개로는 있음으로 보지 않음')
// ── 판독 불가 표시·위에 있는 전화는 붙이지 않는다 ──
assert(fillMissingLines('x', [{ name: 'ocr_text', text: 'Lương [?] tháng\nGọi 0342017663' }], { phones: ['0342017663'] }).added.length === 0, '[?] 줄·전화 줄 제외')
assert(Array.isArray(KIND_RULES), 'Lee 새 규정 표')
console.log('jobDetailFill.test.ts: 정답표 #4824·#4828 + 글자 그대로·중복 방지 검사 통과')
