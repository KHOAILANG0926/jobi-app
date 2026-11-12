// 업종으로 큰 분류 정하기(Lee 2026-11-01, #5247 Wallace) — 실제 원문 사례
import { businessFromName, businessFromGoogle, kindFromGoogleTypes, guardWebAnswer, dutyLine, streetOf, dutyStated, SERVICE_CODE } from './businessType.ts'
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
eq([r?.code, r?.kind, r?.evidence, r?.duty, r?.method], [SERVICE_CODE, 'fnb', 'WALLACE BẮC NINH', 'Nhân viên cửa hàng', 'web'], '#5247 web confirmed, food business')
eq(guardWebAnswer(W, { type: 'fnb' }, [{ url: 'https://x', cited_text: 'Wallace CS7: 303 Kim Mã, Hà Nội' }]), null, 'other branch address is not this store')
eq(guardWebAnswer(W, { type: 'fnb' }, []), null, 'AI words without citation are not enough')
eq(guardWebAnswer(W, { type: 'fnb' }, [{ url: 'https://a', cited_text: 'Wallace mở 3 cửa hàng mới' }, { url: 'https://a', cited_text: 'CS9: 216 Nguyễn Trãi, Tp Bắc Ninh' }])?.url, 'https://a', 'same source split quotes join')
eq(guardWebAnswer(W, { type: 'fnb' }, [{ url: 'https://a', cited_text: 'Wallace mở 3 cửa hàng mới' }, { url: 'https://b', cited_text: '216 Nguyễn Trãi Bắc Ninh cho thuê' }]), null, 'name and address from different sources do not count')
eq(guardWebAnswer(W, { type: 'other' }, good), null, 'non-service business not classified as service')
// 실제 운영 검색 인용문(2026-11-01): "Số 216 Đường Nguyễn Trãi"
eq(guardWebAnswer(W, { type: 'fnb' }, [{ url: 'https://map', cited_text: 'Wallace Burger & Chicken - Nguyễn Trãi - Quán ăn tại Số 216 Đường Nguyễn Trãi, P' }])?.code, SERVICE_CODE, 'Số/Đường words ignored')
eq(guardWebAnswer(W, { type: 'fnb' }, [{ url: 'https://map', cited_text: 'Wallace - Quán ăn tại Số 2160 Đường Nguyễn Trãi' }]), null, 'different house number is not the same store')
eq(guardWebAnswer(W, { type: 'fnb' }, [{ url: 'https://map', cited_text: 'Wallace tại 1216 Nguyễn Trãi' }]), null, 'number must match whole')
eq(guardWebAnswer({ ...W, location: 'Bắc Ninh' }, { type: 'fnb' }, good), null, 'no street number → cannot match a store')
// 이름 단계: 업체 이름 또는 업체 이름 앞 두 낱말이 든 원문 줄의 가게 낱말
eq(businessFromName({ company: 'Highlands Coffee Mường Thanh Bắc Ninh', source_text: '📍 Khu vực làm việc: Highlands Coffee Mường Thanh Bắc Ninh' })?.evidence, 'Highlands Coffee Mường Thanh Bắc Ninh', '#5157 coffee in name')
eq(businessFromName({ company: 'TRUNG NGUYÊN LEGEND BẮC NINH', source_text: 'TUYỂN NHÂN VIÊN PHỤC VỤ – TRUNG NGUYÊN LEGEND BẮC NINH\nTrung Nguyên Legend – Thương hiệu cà phê hàng đầu Việt Nam' })?.kind, 'fnb', '#5231 brand line says cà phê → food')
eq(businessFromName({ company: 'Siêu thị Mini ABC', source_text: 'Siêu thị Mini ABC tuyển thu ngân' })?.kind, 'retail', 'supermarket → retail')
eq(businessFromName({ company: 'Công ty TNHH Điện tử ABC', source_text: 'Công ty TNHH Điện tử ABC tuyển công nhân, làm việc lâu dài' }), null, 'factory not service')
eq(businessFromName({ company: 'Vị trí', source_text: 'Vị trí: phục vụ' }), null, 'label is not a company')
// 업무 칸 한 줄은 원문에 업무 줄이 없을 때만 붙는다
const b = buildDescriptionFromSources([{ name: 'source_text', text: W.source_text }], { company: W.company, title: W.title, dutyLine: 'Nhân viên cửa hàng' })
eq(b.annotations.some((a) => a.key === '01' && a.line === 'Nhân viên cửa hàng'), true, 'duty line shown when source has no duty line')
const b2 = buildDescriptionFromSources([{ name: 'source_text', text: 'Mô tả công việc:\n- Phục vụ khách, dọn bàn\nLiên hệ 0912345678' }], { dutyLine: 'Nhân viên cửa hàng' })
eq([b2.lines.some((l) => l.key === '01'), b2.annotations.some((a) => a.line === 'Nhân viên cửa hàng')], [true, false], 'never added on top of real duty lines')
// Google 장소 종류(Lee 2026-11-08): 같은 이름 1곳(원래 성 안)인 저장된 Google 결과의 종류로 정한다
const gW = businessFromGoogle(W, { id: 'ChIJw', primaryType: 'fast_food_restaurant', types: ['fast_food_restaurant', 'restaurant', 'food', 'point_of_interest'] })
eq([gW?.code, gW?.kind, gW?.method, gW?.evidence, gW?.place_id], [SERVICE_CODE, 'fnb', 'google', 'WALLACE BẮC NINH', 'ChIJw'], 'google fnb place → code 5, evidence = company in source')
eq(kindFromGoogleTypes('convenience_store', []), 'retail', 'convenience store → retail')
eq(kindFromGoogleTypes('beauty_salon', []), 'service', 'salon → service')
eq(kindFromGoogleTypes(null, ['point_of_interest', 'cafe']), 'fnb', 'no primary → types list')
// 대표 종류가 공장·회사면 곁가지 store가 있어도 가게로 보지 않는다
eq(kindFromGoogleTypes('manufacturer', ['store', 'establishment']), null, 'factory primary type never shop')
eq(kindFromGoogleTypes('corporate_office', ['point_of_interest']), null, 'office → none')
eq(businessFromGoogle(W, null), null, 'no Google place → none (AI search step decides)')
eq(businessFromGoogle({ ...W, company: 'XYZ' }, { id: 'p', primaryType: 'cafe', types: [] }), null, 'company not in source → none (R8 evidence)')
console.log('businessType: all assertions passed')

// #728 S7(6043): 업무가 원문에 적힌 공고는 Google 장소 종류(쇼핑몰)·웹 검색으로 서비스·판매로 정하지 않는다. 업무 미기재(Wallace)는 그대로.
{
  const T = { company: 'Vincom Bắc Ninh', location: '216 Lý Thái Tổ, Phường Kinh Bắc, Bắc Ninh', title: 'Nhân viên Kỹ thuật',
    source_text: 'Vincom Bắc Ninh tuyển Nhân viên Kỹ thuật\nMô tả công việc:\n- Kiểm tra, bảo dưỡng, sửa chữa máy game và thiết bị điện\n- Xử lý sự cố kỹ thuật trong ca\nLương 7 – 8,5 triệu/tháng' }
  const mall = { id: 'place-t', primaryType: 'shopping_mall', types: ['shopping_mall'] }
  eq(dutyStated(T), true, '6043 duty lines are stated')
  eq(businessFromGoogle(T, mall), null, '6043 stated duty is not turned into retail by the Google place type')
  eq(guardWebAnswer(T, { type: 'retail' }, [{ url: 'https://x.test', cited_text: 'Vincom 216 Lý Thái Tổ Bắc Ninh trung tâm thương mại' }]), null, '6043 stated duty is not decided by web search either')
  const noDuty = { ...T, source_text: 'Vincom Bắc Ninh tuyển nhân viên\nĐịa chỉ: 216 Lý Thái Tổ, Bắc Ninh\nLiên hệ: 0912345678' }
  eq(dutyStated(noDuty), false, 'no stated duty')
  eq(businessFromGoogle(noDuty, mall)?.kind, 'retail', 'duty not stated → Google place type still decides (Wallace rule kept)')
  console.log('businessType.test.ts: 6043 업무 기재 공고 통과')
}

// #728 S7 / GPT 검토(#737): 업무 기재 판정이 화면 칸 배치 오류와 섞이지 않는지 — 주소·교대·급여·복리후생만 있는 원문은 '업무 없음'이다(Wallace 업무 미기재 경로 유지).
{
  const mall = { id: 'p', primaryType: 'shopping_mall', types: ['shopping_mall'] }
  const noDuty: Array<[string, string]> = [
    ['address+shift+salary', 'Wallace Bắc Ninh tuyển nhân viên\nĐịa chỉ: 216 Nguyễn Trãi, Bắc Ninh\nCa A: 06h30 – 14h30\nCa B: 14h – 22h\nLương 7 – 8,5 triệu/tháng\nLiên hệ: 0912345678'],
    ['address+hours+benefits', 'Wallace Bắc Ninh tuyển nhân viên\nKhu vực làm việc: Wallace Bắc Ninh\nĐịa điểm: Số 395 Ngô Gia Tự, Bắc Ninh\nThời gian làm việc: 8h/ngày\nĐược tham gia đầy đủ các chế độ bảo hiểm\nLiên hệ 0912345678'],
    ['banner only', 'Wallace Bắc Ninh TUYỂN GẤP NHÂN VIÊN\nLương cao, môi trường tốt\nGọi ngay 0912345678'],
  ]
  for (const [name, text] of noDuty) {
    const j = { company: 'Wallace Bắc Ninh', location: '216 Nguyễn Trãi, Bắc Ninh', source_text: text }
    eq(dutyStated(j), false, `no duty (${name})`)
    eq(businessFromGoogle(j, mall)?.kind, 'retail', `no duty (${name}) → Google place type still decides`)
  }
  // 알려진 한계(미수정): 제목 없이 한 줄로 적힌 업무(KDA "Làm ngồi linh kiện…")는 업무 칸 판정이 못 읽어 '업무 없음'으로 나온다 — 이전 동작과 같고 나빠지지는 않음.
  eq(dutyStated({ source_text: 'CTY KDA TUYỂN FULL\nLàm ngồi linh kiện tai nghe\nCa ngày: 310k/11h' }), false, 'known limitation: untitled one-line duty is not detected')
  console.log('businessType.test.ts: 업무 없음 오탐 방지 통과')
}
