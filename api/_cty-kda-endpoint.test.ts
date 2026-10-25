import assert from 'node:assert/strict'
import { createCtyKdaHandler } from './parse/cty-kda.js'

const sample = {
  violations: [],
  dieu_kien: { salary: '12.000.000đ/tháng', work_hours: '08:00-17:00', working_days: '',
    days_off: '', shift: '', benefits_details: 'Hỗ trợ xăng xe 500.000đ',
    benefits_active: { xang_xe: true, xe_dua_don: false, ky_tuc_xa: false, an_ca: false,
      chuyen_can: false, nha_o: false, nang_suat: false } },
  thong_tin: { recruitment_qty: '', gender: '', age: '', education: '',
    experience: '', requirements: '', required_documents: '' },
  khu_vuc: { address: '' },
  mo_ta_list: ['12.000.000đ/tháng', 'Lắp ráp linh kiện'],
  thong_tin_khac: [],
}
function response() {
  return { headers: {}, setHeader(k,v) { this.headers[k] = v; },
    status(n) { this.code = n; return this },
    json(data) { this.data = data; return this } }
}
const env = { CTY_KDA_PARSER_TOKEN: 'server-test-only', OPENAI_API_KEY: 'fake-test',
  CTY_KDA_MODEL: 'mock-model' }
let calls = 0
const handler = createCtyKdaHandler({ env, fetcher: async (_url, opts) => {
  calls++
  const sent = JSON.parse(opts.body)
  assert.equal(sent.messages[0].role, 'system')
  assert.ok(sent.messages[0].content.includes('SEMANTIC DEDUPLICATION'))
  assert.equal(sent.messages[1].content, 'TEFAL thử nghiệm')
  return { ok: true, json: async () => ({ choices: [{message:{content:JSON.stringify(sample)}}] }) }
}})
let res = response()
await handler({method:'POST',headers:{authorization:'Bearer server-test-only'},body:{raw_text:'TEFAL thử nghiệm'}},res)
assert.equal(res.code,200)
assert.equal(calls,1)
assert.deepEqual(res.data.mo_ta_list,['Lắp ráp linh kiện'])
assert.equal(res.data.dieu_kien.benefits_active.xang_xe,true)
assert.ok(res.data.violations.some(x=>x.includes('중복 제거')))
res = response()
await handler({method:'POST',headers:{},body:{raw_text:'TEFAL thử nghiệm'}},res)
assert.equal(res.code,401)
assert.equal(calls,1)
res = response()
await handler({method:'POST',headers:{authorization:'Bearer server-test-only'},body:{raw_text:''}},res)
assert.equal(res.code,400)
assert.equal(calls,1)
console.log('cty-kda endpoint contract assertions passed (mock provider only)')
