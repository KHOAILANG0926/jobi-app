// 공고 검사표 시험 — 실제 원문(jobDescriptionBuild.fixtures.ts). 새 문제를 찾으면 사례를 더한다.
import { DESCRIPTION_BUILD_JOBS as jobs } from './jobDescriptionBuild.fixtures.ts'
import { buildDescriptionFromSources } from './jobDescriptionBuild.ts'
import { inspectJob, inspectReport, publishDecision } from './jobInspect.ts'
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
