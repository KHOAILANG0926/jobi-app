// 업종으로 큰 분류 정하기(Lee 2026-11-01, #5247 Wallace) — 실제 원문 사례
import { businessFromName, guardWebAnswer, dutyLine, streetOf, SERVICE_CODE } from './businessType.ts'
import { buildDescriptionFromSources } from './jobDescriptionBuild.ts'
function eq(got: unknown, want: unknown, name: string) { if (JSON.stringify(got) !== JSON.stringify(want)) throw new Error(`${name}: ${JSON.stringify(got)} ≠ ${JSON.stringify(want)}`) }

const W = { company: 'WALLACE BẮC NINH', title: 'WALLACE BẮC NINH TUYỂN DỤNG NHÂN VIÊN ƯU TÚ', location: '216 Nguyễn Trãi, Võ Cường, Bắc Ninh, Bắc Ninh',
  source_text: 'WALLACE BẮC NINH TUYỂN DỤNG NHÂN VIÊN ƯU TÚ \n 1. FULL-TIME CA TỐI: 02 NHÂN VIÊN\n Mức lương: 34K – 36K – 38K/giờ\n* Thái độ tốt, nghiêm túc và tuân thủ quy định cửa hàng.\n* Ưu tiên các bạn có thể làm việc lâu dài.\n Địa chỉ làm việc: 216 Nguyễn Trãi, Võ Cường, Bắc Ninh.\n Wallace chào đón những thành viên nhiệt huyết' }
// 이름만으로는 업종을 모름('lâu dài'의 lau는 가게 낱말 아님)
eq(businessFromName(W), null, '#5247 name alone unknown')
eq(streetOf(W.location), '216 Nguyễn Trãi', 'street part')
eq(dutyLine(W.source_text), 'Nhân viên cửa hàng', 'duty word from source')
// 검색: 같은 이름 + 같은 번지·도로가 한 인용문에 함께 있어야 인정
const good = [{ url: 'https://www.threads.com/@wallacevietnam/post/x', cited_text: 'Wallace mở cửa thêm 3 cửa hàng mới ... CS9: 216 Nguyễn Trãi, Tp Bắc Ninh' }]
const r = guardWebAnswer(W, { type: 'fnb' }, good)
eq([r?.code, r?.evidence, r?.duty, r?.method], [SERVICE_CODE, 'WALLACE BẮC NINH', 'Nhân viên cửa hàng', 'web'], '#5247 web confirmed')
eq(guardWebAnswer(W, { type: 'fnb' }, [{ url: 'https://x', cited_text: 'Wallace CS7: 303 Kim Mã, Hà Nội' }]), null, 'other branch address is not this store')
eq(guardWebAnswer(W, { type: 'fnb' }, []), null, 'AI words without citation are not enough')
eq(guardWebAnswer(W, { type: 'other' }, good), null, 'non-service business not classified as service')
eq(guardWebAnswer({ ...W, location: 'Bắc Ninh' }, { type: 'fnb' }, good), null, 'no street number → cannot match a store')
// 이름 단계: 업체 이름 또는 업체 이름 앞 두 낱말이 든 원문 줄의 가게 낱말
eq(businessFromName({ company: 'Highlands Coffee Mường Thanh Bắc Ninh', source_text: '📍 Khu vực làm việc: Highlands Coffee Mường Thanh Bắc Ninh' })?.evidence, 'Highlands Coffee Mường Thanh Bắc Ninh', '#5157 coffee in name')
eq(businessFromName({ company: 'TRUNG NGUYÊN LEGEND BẮC NINH', source_text: 'TUYỂN NHÂN VIÊN PHỤC VỤ – TRUNG NGUYÊN LEGEND BẮC NINH\nTrung Nguyên Legend – Thương hiệu cà phê hàng đầu Việt Nam' })?.code, SERVICE_CODE, '#5231 brand line says cà phê')
eq(businessFromName({ company: 'Công ty TNHH Điện tử ABC', source_text: 'Công ty TNHH Điện tử ABC tuyển công nhân, làm việc lâu dài' }), null, 'factory not service')
eq(businessFromName({ company: 'Vị trí', source_text: 'Vị trí: phục vụ' }), null, 'label is not a company')
// 업무 칸 한 줄은 원문에 업무 줄이 없을 때만 붙는다
const b = buildDescriptionFromSources([{ name: 'source_text', text: W.source_text }], { company: W.company, title: W.title, dutyLine: 'Nhân viên cửa hàng' })
eq(b.annotations.some((a) => a.key === '01' && a.line === 'Nhân viên cửa hàng'), true, 'duty line shown when source has no duty line')
const b2 = buildDescriptionFromSources([{ name: 'source_text', text: 'Mô tả công việc:\n- Phục vụ khách, dọn bàn\nLiên hệ 0912345678' }], { dutyLine: 'Nhân viên cửa hàng' })
eq([b2.lines.some((l) => l.key === '01'), b2.annotations.some((a) => a.line === 'Nhân viên cửa hàng')], [true, false], 'never added on top of real duty lines')
console.log('businessType: all assertions passed')
