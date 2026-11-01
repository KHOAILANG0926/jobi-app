// 공고 검사표 시험 — 실제 원문(jobDescriptionBuild.fixtures.ts). 새 문제를 찾으면 사례를 더한다.
import { DESCRIPTION_BUILD_JOBS as jobs } from './jobDescriptionBuild.fixtures.ts'
import { buildDescriptionFromSources } from './jobDescriptionBuild.ts'
import { inspectJob, inspectReport, publishDecision, INSPECT_KEYS } from './jobInspect.ts'
function assert(ok: boolean, name: string) { if (!ok) throw new Error(name) }
const run = (id: string, extra: Record<string, unknown>) => {
  const j = jobs[id]
  const ctx = { title: j.title, company: j.company, phones: j.phones, addresses: j.addresses, salary: j.salary, values: j.values, valueGroups: j.valueGroups }
  const description = buildDescriptionFromSources([{ name: 'source_text', text: j.source_text }], ctx).description
  return inspectJob({ id: Number(id), ...ctx, description, source_text: j.source_text, ...extra })
}
const bad = (r: ReturnType<typeof inspectJob>) => r.items.filter((i) => !i.ok).map((i) => i.key).sort()

// #4878 TEFAL(운영 2026-10-25): 정확한 핀·직업코드·공개 → 전부 통과
const t = run('4878', { pin: 'exact', category: 'quan_ly_ban_hang', occupation_code: '52230', active: true, admin_hidden: false })
assert(t.ok, '#4878 전부 통과: ' + JSON.stringify(bad(t)))
// #4879 ADTEK(운영 2026-10-25): 근무지 못 찾음·급여 칸 비어 있음·기숙사/식사 표시 꺼짐·비공개
const a = run('4879', { pin: null, unlocated_reason: 'our_miss', category: 'san_xuat_xay_dung', occupation_code: '93', active: false, admin_hidden: false })
assert(JSON.stringify(bad(a)) === JSON.stringify(['benefits', 'pin', 'public', 'salary']), '#4879 문제 4개: ' + JSON.stringify(bad(a)))
assert(/Ký túc xá/.test(a.items.find((i) => i.key === 'benefits')!.detail!) && /Ăn ca/.test(a.items.find((i) => i.key === 'benefits')!.detail!), '#4879 기숙사·식사 놓침 찾음')
// 옛 AI 글(중복·사이트 글자)도 잡는다
const old = inspectJob({ id: 1, description: 'Quy trình tuyển dụng\nỨng tuyển: Liên hệ qua Zalo (Phương Dung), nhắn “TEFAL + KHU VỰC”.\nỨng tuyển: Liên hệ qua Zalo (Phương Dung) gửi tin nhắn với nội dung: TEFAL + KHU VỰC.\nThông tin khác\n033 715 ****\nHiện số', pin: 'exact', category: 'x', occupation_code: '1', active: true })
assert(bad(old).includes('junk'), '사이트 글자 찾음')
// "không có ký túc xá"는 놓침이 아님
assert(inspectJob({ id: 2, description: 'Quyền lợi\n- Không có ký túc xá', pin: 'area', category: 'x', occupation_code: '1', active: true }).items.find((i) => i.key === 'benefits')!.ok, '부정은 무시')
assert(inspectReport({ id: 4879, title: 'x' }, a).startsWith('❌ 공고 #4879 문제 4개'), '보고 첫 줄')
console.log('jobInspect.test.ts: #4878 통과·#4879 문제 4개·옛 글 사이트 글자·부정 문장 검사 통과')

// Bomunttl: preserve impossible original hours and fail administrator review, never fix silently.
const hoursReview = inspectJob({ id: 10, source_text: 'CÔ RỬA BÁT FULL TIME\n(tg: 10h - 10h)', description: 'Thời gian làm việc\nCÔ RỬA BÁT FULL TIME — (tg: 10h - 10h)', pin: 'area', category: 'am_thuc_do_uong', occupation_code: '5131', active: true })
assert(hoursReview.items.some(i => i.key === 'hours_review' && !i.ok), 'equal start/end hours require administrator review')
assert(!inspectJob({ id: 11, source_text: '(tg: 17h - 22h)' }).items.some(i => i.key === 'hours_review' && !i.ok), 'ordinary evening shift needs no invalid-time flag')

// 2026-11-01: 검사 결과로 공개 여부 판정 — 'public' 항목은 판정에서 뺀다(공개돼야 통과하는 순환 방지).
{
  const pass = { ok: false, items: [{ key: 'pin', label: '', ok: true }, { key: 'public', label: '', ok: false }] }
  const fail = { ok: false, items: [{ key: 'pin', label: '', ok: false }, { key: 'public', label: '', ok: true }] }
  const d = (r: typeof pass, j: Parameters<typeof publishDecision>[1]) => publishDecision(r, j, '2026-11-01')
  assert(d(fail, { active: true }).active === false && d(fail, { active: true }).publishable === false, '검사 실패 → 공개 중이어도 내림')
  assert(d(pass, { active: true }).active === true, '통과 + 공개 중 → 유지')
  assert(d(pass, { active: false, hold: true, admin_hidden: false }).active === true, '통과 + 검사 대기로 막힘 → 되살림')
  assert(d(pass, { active: false, hold: false }).active === false, '통과여도 다른 이유로 비공개였던 공고는 되살리지 않음')
  assert(d(pass, { active: false, hold: true, admin_hidden: true }).active === false, '관리자 숨김은 되살리지 않음')
  assert(d(pass, { active: false, hold: true, application_deadline: '2026-10-31' }).active === false, '마감 지난 공고는 되살리지 않음')
  assert(d(pass, { active: false, hold: true, application_deadline: '2026-11-01' }).active === true, '마감 당일은 되살림')
  console.log('jobInspect.test.ts: publishDecision 7개 경우 통과')
}

// 2026-11-01 #5157 Highlands(운영 DB 2026-10-31 11:23 상세요강): 기존 11개 항목은 전부 통과였지만 실제로는
// 직무 2개 누락·같은 교대 반복·지원 방법 줄 누락. 새 항목 12~14가 잡아야 한다.
{
  const h = {"title": "Highlands Coffee tuyển nhân viên bán hàng, pha chế và phục vụ", "company": "Highlands Coffee Mường Thanh Bắc Ninh", "salary": "26K/giờ (parttime); 7–9 triệu/tháng (fulltime, tùy năng lực và vị trí)", "description": "Công việc\nPHA CHẾ (PARTTIME)\nPha chế thức uống\nChăm sóc khách hàng\nYêu cầu\n• Tốt nghiệp THPT\n• Yêu thích công việc ngành dịch vụ (F&B), mong muốn gắn bó lâu dài\n• Có thể làm việc tối thiểu 4 ca/tuần\n• Giao tiếp tốt, nhanh nhẹn, hoà đồng và chủ động trong công việc\nThời gian làm việc\n• Ca A: 06h30 – 14h30\n• Ca B: 14h – 22h\nTHỜI GIAN LÀM VIỆC (FULLTIME)\nLàm việc theo 2 ca\n✓ CA 1: 6h30 - 14h30\n✓ CA 2: 14h00 - 22h00\nCA LÀM VIỆC (PARTTIME)\n✓ CA 1: 7h00 - 11h00\n✓ CA 2: 18h00 - 22h00\nThu nhập\n• Thu nhập cạnh tranh, có hỗ trợ ăn ca khi làm ca 8 tiếng, ca gãy\nLƯƠNG: 26K/GIỜ\nTHU NHẬP HẤP DẪN\n(Thu nhập theo năng lực và vị trí)\nQuyền lợi\n• Làm việc trong môi trường trẻ trung, chuyên nghiệp, nhân lương  ngày lễ, tết theo quy định nhà nước\n• Đào tạo miễn phí trước khi nhận việc\n• Được tham gia đầy đủ các chế độ bảo hiểm theo quy định\n• Cơ hội thăng tiến rõ ràng sau 6 tháng – 1 năm làm việc\n✓ Môi trường làm việc năng động, chuyên nghiệp\n✓ Xoay ca linh hoạt, ưu tiên sinh viên\n✓ Được đào tạo bài bản, rõ ràng\n✓ Thưởng lễ, Tết và nhiều chế độ khác theo quy định công ty\nCơ hội phát triển & thu nhập hấp dẫn đang chờ bạn!\nQuy trình tuyển dụng\nNộp trực tiếp CV tại cửa hàng: Highlands Coffee Mường Thanh Bắc Ninh- Số 395 Ngô Gia Tự, Phường Kinh Bắc, Tỉnh Bắc Ninh\nỨNG TUYỂN NGAY – GIA NHẬP HIGHLANDS COFFEE!\nThông tin khác\nHIGHLANDS COFFEE TÌM ĐỒNG ĐỘI\nKhu vực làm việc: Highlands Coffee Mường Thanh Bắc Ninh\nĐịa điểm:  Số 395 Ngô Gia Tự, Phường Kinh Bắc, Tỉnh Bắc Ninh\n• Nhân viên Bán hàng (Sales)  Fulltime- partime\n• Nhân viên Pha chế (Barista) Fulltime- partime\n• Nhân viên Phục vụ (Server)  Fulltime- partime\nHIGHLANDS COFFEE\nTUYỂN DỤNG\nNHÂN SỰ FULLTIME & PARTTIME\nMƯỜNG THANH BẮC NINH\nSố 395 đường Ngô Gia Tự,\nPhường Kinh Bắc,\nTỉnh Bắc Ninh", "source_text": "HIGHLANDS COFFEE TÌM ĐỒNG ĐỘI \n Khu vực làm việc: Highlands Coffee Mường Thanh Bắc Ninh\n Địa điểm:  Số 395 Ngô Gia Tự, Phường Kinh Bắc, Tỉnh Bắc Ninh\n Vị trí tuyển dụng:\n• Nhân viên Bán hàng (Sales)  Fulltime- partime\n• Nhân viên Pha chế (Barista) Fulltime- partime\n• Nhân viên Phục vụ (Server)  Fulltime- partime\n Thời gian làm việc:\n• Ca A: 06h30 – 14h30\n• Ca B: 14h – 22h\n Yêu cầu:\n• Tốt nghiệp THPT\n• Yêu thích công việc ngành dịch vụ (F&B), mong muốn gắn bó lâu dài\n• Có thể làm việc tối thiểu 4 ca/tuần\n• Giao tiếp tốt, nhanh nhẹn, hoà đồng và chủ động trong công việc\n Quyền lợi:\n• Thu nhập cạnh tranh, có hỗ trợ ăn ca khi làm ca 8 tiếng, ca gãy\n• Làm việc trong môi trường trẻ trung, chuyên nghiệp, nhân lương  ngày lễ, tết theo quy định nhà nước\n• Đào tạo miễn phí trước khi nhận việc\n• Được tham gia đầy đủ các chế độ bảo hiểm theo quy định\n• Cơ hội thăng tiến rõ ràng sau 6 tháng – 1 năm làm việc\n Cách nộp hồ sơ:\n Ibox hoặc liên hệ Mr Tuấn Minh: 0365102703\n Nộp trực tiếp CV tại cửa hàng: Highlands Coffee Mường Thanh Bắc Ninh- Số 395 Ngô Gia Tự, Phường Kinh Bắc, Tỉnh Bắc Ninh", "contact_name": "Tuấn Minh", "employer_phone": "0365102703"}
  const r = inspectJob({ id: 5157, ...h, phones: [h.employer_phone], addresses: ['Số 395 Ngô Gia Tự, Phường Kinh Bắc, Tỉnh Bắc Ninh'],
    pin: 'exact', category: 'am_thuc_do_uong', occupation_code: '5132', active: true, admin_hidden: false, image_count: 1, ocr_status: 'ok', meal_provided: true })
  const f = bad(r)
  // 직무 3개는 이제 모집조건 'Vị trí tuyển dụng' 행으로 보인다(sourceRecruitmentRoles가 소제목 없이도 찾음).
  assert(JSON.stringify(f) === JSON.stringify(['hours_twice', 'source_lost']), '#5157 새 항목 2개 실패: ' + JSON.stringify(f))
  // 직무가 업무 칸에도, 직무 행에도 없으면 실패
  const noRoles = inspectJob({ id: 1, source_text: 'Vị trí tuyển dụng:\n• Thợ hàn\n• Lái xe nâng\nYêu cầu:\n• Nam', description: 'Công việc\nThợ hàn\nYêu cầu\n• Nam', pin: 'exact', category: 'x', occupation_code: '1', active: true })
  assert(bad(noRoles).includes('roles') && /Lái xe nâng/.test(noRoles.items.find((i) => i.key === 'roles')!.detail!) && !/Thợ hàn/.test(noRoles.items.find((i) => i.key === 'roles')!.detail!), '직무 누락 찾음')
  assert(/Ibox/.test(r.items.find((i) => i.key === 'source_lost')!.detail!), '#5157 지원 방법 줄 누락 찾음')
  console.log('jobInspect.test.ts: #5157 직무 누락·교대 반복·원문 줄 누락 검사 통과')
}

// 2026-11-01 규정 = 검사: 검사표가 만드는 항목 키는 모두 INSPECT_KEYS에 있다(규정 표 연결 확인의 기준)
{
  const r = inspectJob({ id: 9, source_text: 'CÔ RỬA BÁT FULL TIME\n(tg: 10h - 10h)', description: 'Công việc\nGia nhập đội ngũ năng động', image_count: 1, active: true })
  assert(r.items.every((i) => (INSPECT_KEYS as readonly string[]).includes(i.key)), '모든 항목 키 등록: ' + r.items.map((i) => i.key).join(','))
  // 화면 칸 나누기(lineBucket)가 권유 문구를 07로 옮기므로 통과해야 한다. 그 규칙이 깨지면 이 항목이 실패한다.
  assert(r.items.find((i) => i.key === 'promo_in_07')?.ok === true, 'R13 권유 문구는 07로 옮겨져 통과')
  console.log('jobInspect.test.ts: 항목 키 등록·R13 검사 통과')
}

// 2026-11-01 R11: hours_review는 검사표 실패로 남지만 공개는 막지 않는다(운영 점검 bomunttl_production_check 기대값).
{
  const r = { ok: false, items: [{ key: 'pin', label: '', ok: true }, { key: 'hours_review', label: '', ok: false }, { key: 'public', label: '', ok: false }] }
  const d = publishDecision(r, { active: false, hold: true }, '2026-11-01')
  assert(d.publishable && d.active, 'hours_review만 실패면 공개(관리자 확인 대상으로 남음)')
  console.log('jobInspect.test.ts: R11 확인 대상은 공개 유지 통과')
}

// 2026-11-01 #5231: 회사명 "Vị trí"(항목 이름표)·원문 시급 있는데 급여 칸 비어 있음 → 검사가 잡아야 한다
{
  const src = 'TUYỂN NHÂN VIÊN PHỤC VỤ – TRUNG NGUYÊN LEGEND BẮC NINH\n Mức lương: 23.000 – 25.000 VNĐ/giờ (xét tăng theo năng lực)'
  const r = inspectJob({ id: 5231, company: 'Vị trí', salary: '', source_text: src, description: 'Thu nhập\nMức lương: 23.000 – 25.000 VNĐ/giờ (xét tăng theo năng lực)', pin: 'area', category: 'x', occupation_code: '5131', active: true })
  assert(bad(r).includes('company') && bad(r).includes('salary'), '#5231 회사명·급여 칸 문제 찾음: ' + JSON.stringify(bad(r)))
  console.log('jobInspect.test.ts: #5231 회사명 이름표·시급 급여 칸 검사 통과')
}
