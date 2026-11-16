// 실행: node scripts/status/status-lib.test.mjs
// 2026-10-11 Production DB에서 직접 조회한 승인 핀 5건의 주소·근거를 그대로 넣어 판정을 고정한다.
import assert from 'node:assert/strict'
import { extractHouse, judgeApproval, parseTestSummary, renderStatus } from './status-lib.mjs'

assert.deepEqual(extractHouse('MEDIAMART - 37 Đ. LÝ THÁI TỔ, P. VÕ CƯỜNG, TP. BẮC NINH'), { num: '37', street: 'ly thai to' })
assert.deepEqual(extractHouse('Pizza Hut Bắc Ninh: 1A Lê Thái Tổ, TP. Bắc Ninh'), { num: '1a', street: 'le thai to' })
assert.equal(extractHouse('Pizza Hut, Phường Từ Sơn, Tỉnh Bắc Ninh'), null)

const cases = [
  { jobId: 4702, company: 'PIZZA HUT', rawAddress: '374 Trần Phú, Phường Tam Sơn, Thị xã Từ Sơn, Bắc Ninh',
    evidence: '[Tự động] VietMap POI: Pizza Hut\nĐịa chỉ POI: Pizza Hut, Phường Từ Sơn, Tỉnh Bắc Ninh\nĐịa chỉ khớp', expect: 'NO_EVIDENCE_HOUSE' },
  { jobId: 4720, company: 'PIZZA HUT', rawAddress: '1A Lý Thái Tổ, Phường Võ Cường, Thành phố Bắc Ninh, Bắc Ninh',
    evidence: '[Tự động · dry-run 07/10/2026] VietMap tile POI: Pizza Hut Bắc Ninh\nĐộ khớp: tên khớp chính xác', expect: 'NO_EVIDENCE_HOUSE' },
  { jobId: 4713, company: 'CÔNG TY TNHH PIZZA VIỆT NAM', rawAddress: 'Pizza Hut Bắc Ninh: 1A Lê Thái Tổ, TP. Bắc Ninh, Phường Võ Cường, Thành phố Bắc Ninh, Bắc Ninh',
    evidence: '[Tự động] Tìm theo địa chỉ chi tiết trên VietMap: Pizza Hut Bắc Ninh\nĐịa chỉ trong tin: x\nĐịa chỉ VietMap: Pizza Hut Bắc Ninh 1A Lê Thái Tổ, Phường Võ Cường, Tỉnh Bắc Ninh · Phường/xã: Phường Võ Cường', expect: 'OK' },
  { jobId: 4750, company: 'CÔNG TY CỔ PHẦN IPOS.VN', rawAddress: '21 Nguyễn Gia Thiều, Phường Kinh Bắc, Thành phố Bắc Ninh, Bắc Ninh',
    evidence: '[Tự động] Tìm theo địa chỉ chi tiết trên VietMap: Mỹ Thuật Thiên Bình\nĐịa chỉ trong tin: x\nĐịa chỉ VietMap: Mỹ Thuật Thiên Bình 21 Nguyễn Gia Thiều, Phường Kinh Bắc, Tỉnh Bắc Ninh', expect: 'COMPANY_MISMATCH' },
  { jobId: 4721, company: 'Công ty TNHH Pizza Việt Nam', rawAddress: 'Pizza Hut,  1A Đ. Lê Thái Tổ, P, Võ Cường, Bắc Ninh, Phường Võ Cường, Thành phố Bắc Ninh, Bắc Ninh',
    evidence: '[Tự động] Tìm theo địa chỉ chi tiết trên VietMap: Pizza Hut Bắc Ninh\nĐịa chỉ trong tin: x\nĐịa chỉ VietMap: Pizza Hut Bắc Ninh 1A Lê Thái Tổ, Phường Võ Cường, Tỉnh Bắc Ninh', expect: 'OK' },
  { jobId: 1, company: 'ABC', rawAddress: '12 Trần Phú, Bắc Ninh', evidence: 'Tìm theo địa chỉ chi tiết trên VietMap: ABC\nĐịa chỉ VietMap: ABC 99 Trần Phú', expect: 'HOUSE_MISMATCH' },
]
for (const c of cases) assert.equal(judgeApproval(c).verdict, c.expect, `#${c.jobId}`)

assert.deepEqual(parseTestSummary('...\n45/46 test files passed.\n'), { passed: 45, total: 46 })

const { markdown, problems } = renderStatus({
  generatedAt: '2026-10-11T03:00:00Z', headSha: 'c8ec35a0000', checks: { tsc: 'success', build: 'success', tests: { passed: 45, total: 46 } },
  production: { sha: 'aaaaaaa', state: 'success', createdAt: '2026-10-11T00:00:00Z' }, siteStatus: 200,
  jobs: { total: 103, visible: 102, bySource: { chotot: 100 } }, approvals: cases.slice(0, 5).map((c) => ({ ...c, visible: true })),
})
assert.ok(markdown.includes('확인 필요'))
assert.ok(problems.includes('테스트 1건 실패'))
assert.ok(problems.some((p) => p.startsWith('핀 #4702')))
assert.ok(problems.some((p) => p.startsWith('핀 #4720')))
assert.ok(problems.some((p) => p.startsWith('핀 #4750')))
assert.ok(!problems.some((p) => p.startsWith('핀 #4713')))
console.log('status-lib: all assertions passed')

// VietMap 재확인 판정
import { extractVietmapRef, judgeRecheck } from './status-lib.mjs'
assert.equal(extractVietmapRef('...\nVietMap ref: geocode:ABC123\n...'), 'geocode:ABC123')
assert.equal(extractVietmapRef('VietMap tile POI: x'), null)
const P = { lat: 21.1719011, lng: 106.061922 }
assert.ok(judgeRecheck({ state: 'ok', stored: P, fetched: { lat: 21.17191, lng: 106.06193 } }).ok, 'same point → ✅')
const far = judgeRecheck({ state: 'ok', stored: P, fetched: { lat: 21.1758, lng: 106.0619 } })
assert.ok(!far.ok && far.label.startsWith('❌'), 'faked coordinate ~430 m away → ❌')
assert.ok(!judgeRecheck({ state: 'no_key' }).ok && !judgeRecheck({ state: 'no_ref' }).ok)
const rp = renderStatus({ generatedAt: '2026-10-11T03:00:00Z', approvals: [{ ...cases[2], visible: true, recheck: { state: 'ok', stored: P, fetched: { lat: 21.1758, lng: 106.0619 } } }] })
assert.ok(rp.problems.some((p) => p.includes('VietMap 재확인')), 'recheck mismatch is surfaced in 한눈에 보기')
console.log('status-lib recheck: all assertions passed')
// 9절 규칙 시험(Lee 2026-11-16, #861): 과거 운영 시험 실패는 원본 그대로 보이고 통과로 바뀌지 않는다. 원인·현재(시험용 DB) 결과는 따로 칸.
{
  const rules = [{ rule_key: 'R1_phone_digits_only', block_mode: '저장거부', last_tested_at: '2026-11-15T06:54:41Z', last_test_result: '실패' },
    { rule_key: 'R2b_publish_gate_reason_code_only', block_mode: '저장거부', last_tested_at: null, last_test_result: null }]
  const ci = (conclusion) => ({ status: 'completed', conclusion, at: '2026-11-16T09:00:00Z', url: 'https://github.com/a/b/actions/runs/9', sha: 'abc' })
  const ok = renderStatus({ generatedAt: '2026-11-16T09:10:00Z', rules, ruleTestCi: ci('success') })
  assert.match(ok.markdown ?? ok.md ?? String(ok), /`R1_phone_digits_only` \| 저장거부 \| [^|]+ \| ❌ 실패 \| 시험 방식/, '과거 실패 원본·원인 표시')
  assert.ok(!ok.problems.some((p) => p.includes('R1_phone_digits_only')), '현재 시험 통과 + 원인 확인 → 확인 필요 목록 대신 참고 줄')
  assert.match(ok.markdown ?? ok.md ?? String(ok), /과거 운영 규칙 시험 실패 1건은 기록 그대로 유지/, '요약에도 과거 실패가 보임')
  const bad = renderStatus({ generatedAt: '2026-11-16T09:10:00Z', rules, ruleTestCi: ci('failure') })
  assert.ok(bad.problems.some((p) => p.includes('규칙 시험(시험용 DB) failure')), '현재 시험 실패 → 확인 필요')
  assert.ok(bad.problems.some((p) => p.includes('규칙 시험 실패: R1_phone_digits_only')), '현재 시험이 통과가 아니면 과거 실패도 확인 필요에 남음')
  const none = renderStatus({ generatedAt: '2026-11-16T09:10:00Z', rules })
  assert.ok(none.problems.some((p) => p.includes('규칙 시험 실패: R1_phone_digits_only')), '현재 결과를 못 읽으면 과거 실패는 확인 필요에 남음')
  const later = renderStatus({ generatedAt: '2026-11-20T00:00:00Z', rules: [{ ...rules[0], last_tested_at: '2026-11-18T00:00:00Z' }], ruleTestCi: ci('success') })
  assert.ok(later.problems.some((p) => p === '규칙 시험 실패: R1_phone_digits_only'), '폐지 뒤 새 운영 실패는 원인 미확인 → 확인 필요')
  console.log('status-lib rules past/current: all assertions passed')
}
