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
