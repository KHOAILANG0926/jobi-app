import { screenAudit, areaFindings, amounts, linkPoint, phoneDigits, BENEFIT_ORDER, type ScreenView, type ScreenJob } from './screenAudit'

function assert(c: unknown, m: string) { if (!c) throw new Error('FAIL: ' + m) }

// sb-5876(2026-11-10) 고치기 전 화면 — 3건 모두 확정 오류로 잡아야 한다
const job: ScreenJob = {
  id: 5876, title: 'CÔNG TY TNHH ZHAN AN – TUYỂN DỤNG CÔNG NHÂN SẢN XUẤT', company: 'CÔNG TY TNHH ZHAN AN',
  source_text: 'CÔNG TY TNHH ZHAN AN – TUYỂN DỤNG CÔNG NHÂN SẢN XUẤT\nLương 8.000.000 - 10 triệu\nCó xe đưa đón, bao ăn trưa\nLH 0912 345 678',
  googlePin: { lat: 21.1585515, lng: 106.0664443 }, apiPins: ['21.1585515,106.0664443'],
}
const before: ScreenView = {
  device: 'pc', title: '– TUYỂN DỤNG CÔNG NHÂN SẢN XUẤT', company: 'TY TNHH ZHAN AN',
  mapLinks: ['https://www.google.com/maps/dir/?api=1&destination=C%C3%94NG%20TY%20TNHH%20ZHAN%20AN%2C%20B%E1%BA%AFc%20Ninh'],
  pins: ['21.1585515,106.0664443'], tel: ['0912345678'], zalo: [], benefits: ['bus', 'meal'], salary: '8 - 10 triệu',
}
const f0 = screenAudit(job, [before])
assert(f0.some((f) => f.key === 'title' && f.sure && f.detail.includes('기호로 시작')), '제목 대시 → 확정 오류')
assert(f0.some((f) => f.key === 'company' && f.sure), '회사 줄 깨짐 → 확정 오류')
assert(f0.some((f) => f.key === 'directions' && f.sure), 'Google 핀인데 글자 검색 버튼 → 확정 오류')
assert(!f0.some((f) => ['phone', 'benefit', 'salary', 'pin'].includes(f.key)), `원문에 있는 전화·아이콘·급여는 문제 아님: ${JSON.stringify(f0)}`)

// 고친 뒤 화면 — 문제 없음
const after: ScreenView = { ...before, title: 'TUYỂN DỤNG CÔNG NHÂN SẢN XUẤT', company: 'CÔNG TY TNHH ZHAN AN',
  mapLinks: ['https://www.google.com/maps/dir/?api=1&destination=21.1585515,106.0664443'] }
const f1 = screenAudit(job, [after, { ...after, device: 'mobile' }])
assert(f1.length === 0, `고친 화면은 통과: ${JSON.stringify(f1)}`)

// 원문에 없는 전화(확정)·근거 없는 아이콘(불명확)·원문에 없는 금액(불명확)
const f2 = screenAudit(job, [{ ...after, tel: ['+84 987 654 321'], benefits: ['dorm'], salary: '12 triệu' }])
assert(f2.some((f) => f.key === 'phone' && f.sure), '원문 없는 전화 → 확정')
assert(f2.some((f) => f.key === 'benefit' && !f.sure), '근거 없는 아이콘 → 불명확')
assert(f2.some((f) => f.key === 'salary' && !f.sure), '원문 없는 금액 → 불명확')
// 원문이 없으면(고용주 직접 등록 등) 전화 대조는 불명확
assert(screenAudit({ ...job, source_text: '' }, [{ ...after, tel: ['0987654321'] }]).every((f) => f.key !== 'phone' || !f.sure), '원문 없음 → 불명확')
// 버튼 좌표가 핀과 멀면 확정 오류, 지도 목록 핀과 상세 핀이 다르면 확정 오류
assert(screenAudit({ ...job, googlePin: null }, [{ ...after, mapLinks: ['https://www.google.com/maps/dir/?api=1&destination=21.2,106.1'] }]).some((f) => f.key === 'directions' && f.sure), '버튼 좌표 ≠ 핀')
assert(screenAudit({ ...job, googlePin: null, apiPins: ['21.3,106.2'] }, [after]).some((f) => f.key === 'pin' && f.sure), '상세 핀 ≠ 지도 목록 핀')
// 핀 집합은 양방향 대조: 목록 핀 2곳인데 상세엔 1곳 / 목록 핀 있는데 상세 0곳 / 목록 0곳인데 상세 핀 있음 → 확정 오류, 목록을 못 읽음(null)이면 생략
const two = ['21.1585515,106.0664443', '21.3,106.2']
assert(screenAudit({ ...job, googlePin: null, apiPins: two }, [after]).some((f) => f.key === 'pin' && f.sure), '목록 핀 2곳, 상세 1곳 → 오류')
assert(screenAudit({ ...job, googlePin: null, apiPins: two }, [{ ...after, pins: [] }]).some((f) => f.key === 'pin' && f.sure), '상세 핀 0곳 → 오류')
assert(screenAudit({ ...job, googlePin: null, apiPins: [] }, [after]).some((f) => f.key === 'pin' && f.sure), '목록 0곳, 상세 핀 있음 → 오류')
assert(!screenAudit({ ...job, googlePin: null, apiPins: null }, [after]).some((f) => f.key === 'pin'), '목록 못 읽음 → 대조 생략')
// PC·모바일 같은 문제는 한 줄
assert(screenAudit(job, [before, { ...before, device: 'mobile' }]).filter((f) => f.key === 'title' && f.detail.includes('기호')).length === 1, 'PC·모바일 한 줄')
// ⑦ 영역 배치(운영 공고 전체 대조용, R2 #753): 줄이 허용 영역에 있으면 통과, 금지 영역에만 있으면 확정 오류, 영역을 못 읽으면 통과가 아니라 미검증
{
  const src = 'CÔNG TY ABC tuyển công nhân\nGiới tính: Nam, Nữ 18-40 tuổi\nLương: 310k/ngày\nLàm việc 7h30-16h30\nLiên hệ: 0388492985'
  const j = { id: 1, title: 'ABC tuyển công nhân', company: 'CÔNG TY ABC', source_text: src, employer_phone: '0388492985' }
  const okAreas = { '①': 'Điều kiện làm việc Mức lương 310.000đ/ngày Thời gian làm việc 7h30-16h30', '②': 'Thông tin tuyển dụng Giới tính: Nam, Nữ 18-40 tuổi', '③': 'Khu vực làm việc Bắc Ninh', '④': 'Mô tả công việc Liên hệ: 0388492985' } as const
  const mk = (areas: ScreenView['areas']): ScreenView => ({ device: 'PC', title: 'ABC tuyển công nhân', company: 'CÔNG TY ABC', mapLinks: [], pins: [], tel: [], zalo: [], benefits: [], areas })
  const placement = (areas: ScreenView['areas']) => areaFindings(j, src, mk(areas))
  assert(placement(okAreas).length === 0, '맞는 영역 → 문제 없음')
  assert(placement({ ...okAreas, '②': okAreas['②'] + ' Liên hệ: 0388492985' }).some((f) => f.key === 'placement' && f.sure) === false, '연락처가 ②에도 있어도 ④에 있으면(허용 영역) 오류 아님')
  // 주입 결함: 연락처 줄이 ④가 아니라 ②에만 있음 → 확정 오류
  const wrong = placement({ ...okAreas, '④': 'Mô tả công việc', '②': okAreas['②'] + ' Liên hệ: 0388492985' })
  assert(wrong.some((f) => f.key === 'placement' && f.sure && f.detail.includes('②')), '연락처가 ②에만 → 확정 오류')
  // 주입 결함: 급여 줄이 ②에만 있음
  assert(placement({ ...okAreas, '①': 'Điều kiện làm việc', '②': okAreas['②'] + ' Lương: 310k/ngày' }).some((f) => f.key === 'placement' && f.sure), '급여가 ②에만 → 확정 오류')
  // 주입 결함: 모집 조건 줄이 ③에만 있음
  assert(placement({ ...okAreas, '②': 'Thông tin tuyển dụng', '③': okAreas['③'] + ' Giới tính: Nam, Nữ 18-40 tuổi' }).some((f) => f.key === 'placement' && f.sure), '모집 조건이 ③에만 → 확정 오류')
  // 못 읽음 = 미검증(통과 아님)
  assert(placement(undefined).length === 0, '수집 안 한 호출 → 대조 생략')
  assert(placement({ '①': '', '②': '', '③': '', '④': '' })[0].key === 'areas', '전부 비어 있음 → 미검증')
  // 연락처 번호가 ④에 없으면 빠짐 의심(불명확)
  assert(placement({ ...okAreas, '④': 'Mô tả công việc Nhân viên' }).some((f) => f.key === 'placement' && !f.sure && f.detail.includes('빠짐')), '연락처 번호 빠짐 → 불명확')
  // 운영 대조(2026-11-12)에서 나온 오탐: "22 trở lên"·"HSK3 trở lên"의 tr(trở)을 급여 단위로 읽어 ②의 모집 조건 줄을 오류로 잡았다 — 급여가 아닌 줄은 어느 영역에 있어도 배치 오류가 아니다
  const req = 'Tốt nghiệp THCS trở lên (9/12), tuổi từ 22 trở lên\nBiết tiếng Trung HSK2 – HSK3 trở lên, lương THỎA THUẬN'
  const jr = { id: 3, title: 't', company: 'c', source_text: req }
  assert(areaFindings(jr, req, { ...mk({ '①': 'Điều kiện làm việc', '②': 'Thông tin tuyển dụng ' + req, '③': 'Khu vực làm việc', '④': 'Mô tả công việc' }) }).every((f) => f.key !== 'placement' || !f.sure), '"trở lên" 줄은 급여로 오인하지 않음')
}
// ⑧ 업종: 공단·공장 글인데 5(서비스·판매) → 불명확, 가게 낱말이 있으면 문제 없음
{
  const v: ScreenView = { device: 'PC', title: 't', mapLinks: [], pins: [], tel: [], zalo: [], benefits: [] }
  const base = { id: 2, title: 't', company: 'c' }
  assert(screenAudit({ ...base, source_text: 'Công ty ABC tuyển công nhân tại KCN VSIP Bắc Ninh\nLương 8 triệu', occupation_code: '5' }, [v]).some((f) => f.key === 'industry' && !f.sure), '공장 글 + 5 → 불명확')
  assert(!screenAudit({ ...base, source_text: 'Quán ăn ABC tuyển phục vụ gần KCN VSIP\nLương 8 triệu', occupation_code: '5' }, [v]).some((f) => f.key === 'industry'), '가게 글 + 5 → 정상')
  assert(!screenAudit({ ...base, source_text: 'Công ty ABC tuyển công nhân tại KCN VSIP Bắc Ninh', occupation_code: '9' }, [v]).some((f) => f.key === 'industry'), '공장 글 + 공장 코드 → 정상')
}

// 도우미
assert(amounts('8tr5').includes(8_500_000) && amounts('8,5 triệu').includes(8_500_000) && amounts('7.500.000đ').includes(7_500_000) && amounts('250k/ngày').includes(250_000), '금액 읽기')
assert(phoneDigits('+84 912 345 678') === '0912345678', '전화 +84')
assert(linkPoint('https://www.google.com/maps/search/?api=1&query=21.1,106.2')?.lat === 21.1 && linkPoint('https://www.google.com/maps/dir/?api=1&destination=ABC') === null, '링크 좌표')
// 수집기가 n번째 아이콘을 키로 읽으므로 상세 화면 아이콘 순서와 같아야 한다
{
  const fsModule = 'node:fs'
  const { readFileSync } = (await import(/* @vite-ignore */ fsModule)) as { readFileSync: (path: URL, enc: string) => string }
  const src = readFileSync(new URL('../pages/JobDetail.tsx', import.meta.url), 'utf8')
  const block = src.slice(src.indexOf('const benefitIcons = ['), src.indexOf('] as const', src.indexOf('const benefitIcons = [')))
  const keys = [...block.matchAll(/\{ key: '([a-z]+)'/g)].map((m) => m[1])
  assert(JSON.stringify(keys) === JSON.stringify(BENEFIT_ORDER), `아이콘 순서 ${keys.join(',')} ≠ BENEFIT_ORDER`)
}
console.log('screenAudit.test.ts: 통과')
