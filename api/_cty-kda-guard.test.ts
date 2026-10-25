import assert from 'node:assert/strict'
import { guardCtyKdaParserOutput } from './_lib/cty-kda-guard.js'

const base = {
  violations: [],
  dieu_kien: {
    salary: 'Lương 12.000.000đ/tháng', work_hours: '08:00-17:00', working_days: 'Thứ 2-7',
    days_off: 'Chủ nhật', shift: 'Ca ngày',
    benefits_active: { xang_xe: true, xe_dua_don: false, ky_tuc_xa: false, an_ca: true, chuyen_can: false, nha_o: false, nang_suat: false },
    benefits_details: 'Hỗ trợ xăng xe 500.000đ/tháng; ăn ca 25.000đ/suất',
  },
  thong_tin: { recruitment_qty: '2', gender: '', age: '', education: '', experience: '', requirements: '', required_documents: '' },
  khu_vuc: { address: 'Bắc Ninh' },
  mo_ta_list: ['Lương 12.000.000đ/tháng', 'Lắp ráp linh kiện', 'Lắp ráp linh kiện', 'Lắp ráp linh kiện từ 08:00-17:00'],
  thong_tin_khac: ['Thưởng giới thiệu 1.000.000đ/người'],
}
const output = guardCtyKdaParserOutput(base)
assert.deepEqual(output.mo_ta_list, ['Lắp ráp linh kiện', 'Lắp ráp linh kiện từ 08:00-17:00'])
assert.equal(output.dieu_kien.benefits_active.xang_xe, true)
assert.deepEqual(output.thong_tin_khac, ['Thưởng giới thiệu 1.000.000đ/người'])
assert.ok(output.violations.some((x) => x.includes('중복 제거')))
assert.ok(output.violations.some((x) => x.includes('부분 중복 의심')))
const broken = guardCtyKdaParserOutput({ ...base, dieu_kien: { ...base.dieu_kien, benefits_active: {} }, fifth_section: 'forbidden' })
assert.equal(broken.dieu_kien.benefits_active.an_ca, false)
assert.ok(broken.violations.some((x) => x.includes('구조 충돌')))
assert.ok(broken.violations.some((x) => x.includes('Boolean 판정 불가')))
const semantic = guardCtyKdaParserOutput({
  ...base,
  mo_ta_list: ['Thu nhập 12.000.000đ/tháng', 'Lắp ráp linh kiện từ 08:00-17:00', 'Nghỉ giải lao 15 phút'],
})
assert.deepEqual(semantic.mo_ta_list, ['Lắp ráp linh kiện từ 08:00-17:00', 'Nghỉ giải lao 15 phút'])
assert.ok(semantic.violations.some((x) => x.includes('의미 중복 제거')))
console.log('cty-kda-guard assertions passed')
