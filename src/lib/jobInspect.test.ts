// 공고 검사표 시험 — 실제 원문(jobDescriptionBuild.fixtures.ts). 새 문제를 찾으면 사례를 더한다.
import { DESCRIPTION_BUILD_JOBS as jobs } from './jobDescriptionBuild.fixtures.ts'
import { buildDescriptionFromSources } from './jobDescriptionBuild.ts'
import { inspectJob, inspectReport, publishDecision, INSPECT_KEYS, SCREEN_WAIT } from './jobInspect.ts'
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
assert(JSON.stringify(bad(a)) === JSON.stringify(['benefits', 'card', 'pin', 'public', 'salary']), '#4879 문제 5개(급여 빈칸 → 메인 카드에도 안 보임): ' + JSON.stringify(bad(a)))
assert(/Ký túc xá/.test(a.items.find((i) => i.key === 'benefits')!.detail!) && /Ăn ca/.test(a.items.find((i) => i.key === 'benefits')!.detail!), '#4879 기숙사·식사 놓침 찾음')
// 옛 AI 글(중복·사이트 글자)도 잡는다
const old = inspectJob({ id: 1, description: 'Quy trình tuyển dụng\nỨng tuyển: Liên hệ qua Zalo (Phương Dung), nhắn “TEFAL + KHU VỰC”.\nỨng tuyển: Liên hệ qua Zalo (Phương Dung) gửi tin nhắn với nội dung: TEFAL + KHU VỰC.\nThông tin khác\n033 715 ****\nHiện số', pin: 'exact', category: 'x', occupation_code: '1', active: true })
assert(bad(old).includes('junk'), '사이트 글자 찾음')
// "không có ký túc xá"는 놓침이 아님
assert(inspectJob({ id: 2, description: 'Quyền lợi\n- Không có ký túc xá', pin: 'area', category: 'x', occupation_code: '1', active: true }).items.find((i) => i.key === 'benefits')!.ok, '부정은 무시')
assert(inspectReport({ id: 4879, title: 'x' }, a).startsWith('❌ 공고 #4879 문제 5개'), '보고 첫 줄')
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

// 2026-11-03 Bảo An VCC 같은 포스터식 소제목(공고 번호 전용 아님): 꾸밈말·괄호 설명이 붙은 소제목은 칸 제목, ':'로 끝나는 긴 소개 문장은 빈 이름표가 아님.
{
  const desc = [
    'Công ty Cổ phần Dịch vụ Bảo vệ Bảo An VCC đang cần tuyển gấp số lượng lớn anh chị em làm việc tại hệ thống kho xuất nhập khu vực Bắc Ninh:  ',
    '💰 MỨC THU NHẬP ỔN ĐỊNH (Trả lương đúng hạn):  ', ' Ca ngày: 8.500.000đ / tháng.  ',
    '🎁 QUYỀN LỢI ĐẶC BIỆT:  ', ' Thưởng tháng 13, thưởng sinh nhật.  ',
    '✅ YÊU CẦU CỰC KỲ ĐƠN GIẢN:  ', ' Nam / Nữ độ tuổi từ 18 – 60 tuổi.  ',
    '📲 ĐĂNG KÝ NHẬN VIỆC NGAY:', 'Gọi/nhắn Zalo 0914880849 - Hoàng',
  ].join('\n')
  const r = inspectJob({ id: 11, description: desc, pin: 'area', category: 'dich_vu', occupation_code: '540', active: true })
  assert(r.items.find((i) => i.key === 'junk')!.ok, '포스터식 소제목·소개 문장은 빈 이름표 아님: ' + r.items.find((i) => i.key === 'junk')!.detail)
  const short = inspectJob({ id: 12, description: 'Quyền lợi\nThưởng tháng 13\nSố điện thoại:', pin: 'area', category: 'x', occupation_code: '1', active: true })
  assert(!short.items.find((i) => i.key === 'junk')!.ok, '값 없는 짧은 이름표는 계속 잡음')
  console.log('jobInspect.test.ts: 포스터식 소제목(꾸밈말·괄호)·긴 소개 문장 검사 통과')
}

// 2026-11-04 "NHÀ HÀNG … TUYỂN GẤP:" 같은 모집 소개 줄(공고 번호 전용 아님) — 빈 이름표 아님. 값 없는 짧은 이름표는 계속 잡음.
{
  const r = inspectJob({ id: 13, description: 'Công việc\nNHÀ HÀNG TÂM HỒ NHẤT HẠCH TUYỂN GẤP:\n05 nhân viên phục vụ (Nam/Nữ)', pin: 'area', category: 'am_thuc_do_uong', occupation_code: '5131', active: true })
  assert(r.items.find((i) => i.key === 'junk')!.ok, '모집 소개 줄은 빈 이름표 아님: ' + r.items.find((i) => i.key === 'junk')!.detail)
  const short = inspectJob({ id: 14, description: 'Quyền lợi\nThưởng tháng 13\nSố điện thoại:', pin: 'area', category: 'x', occupation_code: '1', active: true })
  assert(!short.items.find((i) => i.key === 'junk')!.ok, '값 없는 짧은 이름표는 계속 잡음')
  console.log('jobInspect.test.ts: 모집 소개 줄(… tuyển gấp:) 검사 통과')
}

// 2026-11-06 Lee OK: 바로 아래가 글머리 목록인 "~:" 줄은 목록 제목(#5506 "🌟 CƠ CHẾ … DÀNH CHO BẠN:") — 빈 이름표 아님.
{
  const r = inspectJob({ id: 15, description: 'Quyền lợi\n🌟 CƠ CHẾ "LẮP TÊN LỬA" DÀNH CHO BẠN:\n• Lương ổn định: 8 – 15 TRIỆU/tháng\n• Đào tạo bài bản', pin: 'area', category: 'kinh_doanh', occupation_code: '3334', active: true })
  assert(r.items.find((i) => i.key === 'junk')!.ok, '목록 제목 줄은 빈 이름표 아님: ' + r.items.find((i) => i.key === 'junk')!.detail)
  const empty = inspectJob({ id: 16, description: 'Quyền lợi\nThưởng tháng 13\nSố điện thoại:', pin: 'area', category: 'x', occupation_code: '1', active: true })
  assert(!empty.items.find((i) => i.key === 'junk')!.ok, '아래가 목록이 아니면 계속 빈 이름표')
  // 2026-11-10 #5876: 긴 소개 줄 아래가 '이름: 값' 줄이면 묶음 제목. 짧은 칸 이름 아래 '이름: 값'은 계속 빈 이름표.
  const group = inspectJob({ id: 17, description: 'Quyền lợi\nThưởng gắn bó dành cho nhân viên mới:\nLàm đủ 30 ngày: Thưởng 500.000đ.\nLàm đủ 90 ngày: Thưởng thêm 1.000.000đ.', pin: 'area', category: 'x', occupation_code: '1', active: true })
  assert(group.items.find((i) => i.key === 'junk')!.ok, '묶음 제목 줄은 빈 이름표 아님: ' + group.items.find((i) => i.key === 'junk')!.detail)
  const shortLabel = inspectJob({ id: 18, description: 'Quyền lợi\nSố điện thoại:\nLiên hệ:\nĐịa chỉ: KCN Quế Võ', pin: 'area', category: 'x', occupation_code: '1', active: true })
  assert(!shortLabel.items.find((i) => i.key === 'junk')!.ok, '바로 아래가 또 이름표면 빈 이름표')
  // 2026-11-11 Lee(MediaMart sb-5994): 짧은 이름표 아래에 같은 칸 일반 글이 있으면 내용 있는 이름표(아래 줄 모양 예외 대신 한 규칙)
  const mm = inspectJob({ id: 19, description: 'Công việc\nYêu cầu chung:\nNam/Nữ, từ 18 tuổi trở lên', pin: 'area', category: 'ban_hang', occupation_code: '5', active: true })
  assert(mm.items.find((i) => i.key === 'junk')!.ok, '이름표 아래 같은 칸 글이 있으면 빈 이름표 아님: ' + mm.items.find((i) => i.key === 'junk')!.detail)
  // Codex 지적: 칸 제목 판정은 화면과 같은 headingOf — 'Yêu cầu ứng viên' 같은 다른 제목 바로 위의 이름표도 빈 이름표
  const beforeHeading = inspectJob({ id: 20, description: 'Quyền lợi\nSố điện thoại:\nYêu cầu ứng viên\nNam/Nữ, từ 18 tuổi trở lên', pin: 'area', category: 'x', occupation_code: '1', active: true })
  assert(!beforeHeading.items.find((i) => i.key === 'junk')!.ok, '다른 칸 제목 바로 위 이름표는 빈 이름표')
  console.log('jobInspect.test.ts: 목록 제목 줄(~: + 글머리) 검사 통과')
}


// Lee 2026-11-07: 대표 사진·로고는 표시만 — 공개·연속 통과(ok)를 막지 않는다
{
  const job = { id: 30, description: 'Công việc\nLái xe giao hàng', pin: 'area', category: 'x', occupation_code: '8322', active: true }
  const pending = inspectJob({ ...job, photo: 'pending' })
  const item = pending.items.find((i) => i.key === 'photo')!
  assert(!item.ok && item.detail === '로고 찾기 대기', 'pending shown')
  assert(pending.ok === inspectJob(job).ok, 'photo does not change ok')
  assert(publishDecision(pending, { active: false, hold: true }).publishable === publishDecision(inspectJob(job), { active: false, hold: true }).publishable, 'photo does not change publish')
  assert(inspectJob({ ...job, photo: 'site' }).items.find((i) => i.key === 'photo')!.detail === '회사 웹사이트 로고', 'site label')
  assert(INSPECT_KEYS.includes('photo' as never), 'photo key registered')
  console.log('jobInspect.test.ts: 대표 사진·로고 표시 항목 통과')
}

// 붙인 뒤에도 빠진 줄(Lee 2026-11-09): 이미 계산된 값을 검사표에 표시만 — 공개·연속 통과 영향 없음
{
  const job = { id: 31, description: 'Công việc\nLái xe giao hàng', pin: 'area', category: 'x', occupation_code: '8322', active: true }
  const base = inspectJob(job)
  assert(!base.items.some((i) => i.key === 'still_missing'), 'no item when nothing is missing')
  const m = inspectJob({ ...job, still_missing_lines: ['Ca đêm 22h-6h', 'Nghỉ CN'] })
  const item = m.items.find((i) => i.key === 'still_missing')!
  assert(item && !item.ok && item.detail!.startsWith('2줄 — 코드 수정 필요: Ca đêm 22h-6h'), 'missing lines shown')
  assert(m.ok === base.ok, 'still_missing does not change ok/streak')
  assert(publishDecision(m, { active: false, hold: true }).publishable === publishDecision(base, { active: false, hold: true }).publishable, 'still_missing does not change publish')
  assert(inspectReport({ id: 1 }, m).includes('❌ 붙인 뒤에도 빠진 줄 없음 — 2줄'), 'shown in report')
  assert(INSPECT_KEYS.includes('still_missing' as never), 'key registered')
  console.log('jobInspect.test.ts: 붙인 뒤에도 빠진 줄 표시 항목 통과')
}
// 화면 대조(#646, Lee 2026-11-10 sb-5876): 확정 오류·대조 전 비공개 공고는 공개하지 않는다. 이미 공개 중이고 기록이 없으면 공개 유지.
{
  const job = { id: 5876, description: 'Công việc: công nhân sản xuất', pin: 'area', category: 'san_xuat_xay_dung', occupation_code: '93', active: false, admin_hidden: false }
  const base = inspectJob(job)
  const pub = (r: ReturnType<typeof inspectJob>, active = false) => publishDecision(r, { active, hold: true }, '2026-11-01')
  const withScreen = (screen: NonNullable<Parameters<typeof inspectJob>[0]['screen']>, active = false) => inspectJob({ ...job, active, screen })
  assert(INSPECT_KEYS.includes('screen' as never), 'screen key registered')
  assert(pub(base).publishable, 'base case publishes without screen record')
  assert(!pub(withScreen({ state: 'pending' })).publishable, 'pending blocks publish')
  assert(withScreen({ state: 'pending' }).items.find((i) => i.key === 'screen')?.detail === SCREEN_WAIT, 'pending detail is the wait marker')
  assert(!pub(withScreen({ state: 'fail', detail: '[PC] 제목이 기호로 시작' })).publishable, 'confirmed error blocks publish')
  assert(pub(withScreen({ state: 'ok', unsure: 2 })).publishable, 'ok with unsure items publishes')
  assert(pub(withScreen({ state: 'none' }, true), true).active === pub(inspectJob({ ...job, active: true }), true).active, 'already public without record keeps state')
  console.log('jobInspect.test.ts: 화면 대조 항목 통과')
}

// #728 S7(5421): 원문 "Bao ăn ở"인데 기숙사 표시가 꺼져 있으면 검사표가 잡는다(검사 쪽 낱말표도 같은 사례를 읽는다). 부정문은 잡지 않는다.
{
  const base = { id: 5421, title: 'Tuyển phụ bếp', description: 'Bao ăn ở', meal_provided: true } as Parameters<typeof inspectJob>[0]
  const benefits = (extra: Record<string, unknown>, text: string) => inspectJob({ ...base, ...extra, source_text: text } as Parameters<typeof inspectJob>[0]).items.find((i) => i.key === 'benefits')
  assert(benefits({ dormitory: false }, 'Tuyển nhân viên phụ bếp\nBao ăn ở\nLương thoả thuận')?.ok === false, '5421 inspector catches dormitory off')
  assert(benefits({ dormitory: true }, 'Tuyển nhân viên phụ bếp\nBao ăn ở\nLương thoả thuận')?.ok === true, '5421 dormitory on passes')
  assert(benefits({ dormitory: false, description: 'Không bao ăn ở' }, 'Không bao ăn ở')?.ok === true, 'negated lodging is not a missing benefit')
  const cash = 'Tuyển nhân viên\nHỗ trợ ăn ở: 1.000.000đ/tháng (trả tiền mặt)'
  assert(benefits({ dormitory: false, description: cash }, cash)?.ok === true, 'cash lodging allowance is not a missing dormitory flag')
  for (const t of ['Bao ăn ở, 2 bữa/ngày', 'Bao ăn ở (phòng 2 người)']) {
    const txt = `Tuyển nhân viên\n${t}`
    assert(benefits({ dormitory: false, description: txt }, txt)?.ok === false, `"${t}" with dormitory off is caught`)
  }
  console.log('jobInspect.test.ts: 5421 숙식 제공 통과')
}
// #797(R2 A4) 고용주 등록 → 공개 전 검사 이어붙이기: 등록 입구가 만든 원문(ingestSourceText)과 글자 없는 일반 사진을 검사표·공개 판정에 그대로 넣어 본다.
{
  const { ingestSourceText } = await import('./jobPolicyWrite.ts')
  const f = { title: 'Nhân viên bán hàng', company: 'Cửa hàng ABC', category: 'ban_hang', salary: '8 triệu/tháng', location: 'Số 1 Lý Thái Tổ, Bắc Ninh', hours: '8h-17h', description: 'Bán hàng, tư vấn khách.\nLàm việc theo ca.', employer_phone: '0912345678', urgent: false, origin: 'employer', active: true }
  const input = (extra: Record<string, unknown> = {}) => ({ id: 1, title: f.title, company: f.company, salary: f.salary, description: f.description, source_text: ingestSourceText(f),
    phones: [f.employer_phone], addresses: [f.location], values: [], valueGroups: [[f.hours]], postingFields: { hours: f.hours, reviewOnly: true },
    category: 'ban_hang', occupation_code: '5', active: false, admin_hidden: false, image_count: 1, ocr_status: 'no_text', pin: 'exact', screen: { state: 'ok', unsure: 0 }, ...extra })
  const hold = { hold: true, application_deadline: null }
  const pass = (extra: Record<string, unknown> = {}) => { const r = inspectJob(input(extra) as never); return { r, d: publishDecision(r, { active: false, admin_hidden: false, ...hold }) } }
  let x = pass()
  assert(!x.r.items.some((i) => i.key === 'source_lost' && !i.ok), 'employer form-built source text is not "lost original lines": ' + JSON.stringify(x.r.items.filter((i) => !i.ok)))
  assert(x.d.publishable && x.d.active, 'employer posting with a text-free general photo passes inspection and is published: ' + JSON.stringify(x.r.items.filter((i) => !i.ok)))
  x = pass({ ocr_status: 'unreadable' })
  assert(!x.d.publishable, 'an unreadable image (not proven by typed fields) still blocks publication')
  x = pass({ ocr_status: 'mismatch' })
  assert(!x.d.publishable, 'a poster that disagrees with the typed fields still blocks publication')
  x = pass({ screen: { state: 'pending' } })
  assert(!x.d.publishable, 'waiting for the screen check does not publish')
  x = pass({ pin: undefined })
  assert(!x.d.publishable, 'no map pin still blocks publication')
  x = pass({ source_text: 'Cửa hàng ABC tuyển nhân viên bán hàng\nTăng ca có thưởng lớn\n' + ingestSourceText(f) })
  assert(x.r.items.some((i) => i.key === 'source_lost' && !i.ok), 'a real pasted original with a missing line is still caught')
  console.log('jobInspect.test.ts: 고용주 등록 → 검사 → 공개 판정(#797) 통과')
}
