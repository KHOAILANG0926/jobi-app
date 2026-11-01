// 자동 수리 AI 답 검사 — 원문 글자 그대로만, 이름표·지어낸 값 버림(2026-11-01 #5231)
import { guardRepair, buildRepairPrompt } from './jobRepair.ts'
function assert(ok: boolean, name: string) { if (!ok) throw new Error(name) }
const job = { id: 5231, title: 'TUYỂN NHÂN VIÊN PHỤC VỤ – TRUNG NGUYÊN LEGEND BẮC NINH', company: 'Vị trí',
  source_text: 'TUYỂN NHÂN VIÊN PHỤC VỤ – TRUNG NGUYÊN LEGEND BẮC NINH\nTrung Nguyên Legend – Thương hiệu cà phê\n Vị trí tuyển dụng: Nhân viên phục vụ' }
const ok = guardRepair(job, ['company'], { company: { value: 'TRUNG NGUYÊN LEGEND BẮC NINH', evidence: 'TUYỂN NHÂN VIÊN PHỤC VỤ – TRUNG NGUYÊN LEGEND BẮC NINH' } })
assert(ok.proposals.length === 1 && ok.proposals[0].to === 'TRUNG NGUYÊN LEGEND BẮC NINH' && ok.proposals[0].from === 'Vị trí', '원문 그대로 값은 제안')
assert(guardRepair(job, ['company'], { company: { value: 'Trung Nguyen Legend Coffee' } }).proposals.length === 0, '원문에 없는(고친) 값은 버림')
assert(guardRepair(job, ['company'], { company: { value: 'Vị trí' } }).proposals.length === 0, '원래 값·이름표 버림')
assert(guardRepair(job, ['company'], { company: { value: '' } }).proposals.length === 0, '빈 값 버림')
assert(guardRepair(job, ['company'], 'nonsense').proposals.length === 0, '형식 틀린 답 버림')
assert(buildRepairPrompt(job, ['company']).includes('TIN GỐC'), '프롬프트에 원문')
console.log('jobRepair.test.ts: 자동 수리 답 검사 6개 경우 통과')
