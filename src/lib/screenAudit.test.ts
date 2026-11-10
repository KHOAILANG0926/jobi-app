import { screenAudit, amounts, linkPoint, phoneDigits, type ScreenView, type ScreenJob } from './screenAudit'

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
// PC·모바일 같은 문제는 한 줄
assert(screenAudit(job, [before, { ...before, device: 'mobile' }]).filter((f) => f.key === 'title' && f.detail.includes('기호')).length === 1, 'PC·모바일 한 줄')

// 도우미
assert(amounts('8tr5').includes(8_500_000) && amounts('8,5 triệu').includes(8_500_000) && amounts('7.500.000đ').includes(7_500_000) && amounts('250k/ngày').includes(250_000), '금액 읽기')
assert(phoneDigits('+84 912 345 678') === '0912345678', '전화 +84')
assert(linkPoint('https://www.google.com/maps/search/?api=1&query=21.1,106.2')?.lat === 21.1 && linkPoint('https://www.google.com/maps/dir/?api=1&destination=ABC') === null, '링크 좌표')
console.log('screenAudit.test.ts: 통과')
