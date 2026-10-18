// 독립 판독자 교정 시험(결정 0004): 정답을 아는 실제 포스터로 판독자 자체를 검증한다.
// 판독자가 이 시험을 통과하지 못하면 공고 판정에 쓰지 않는다. 판독자가 놓친 포스터가 생기면 CASES에 추가한다.
// 필요: ANTHROPIC_API_KEY. 네트워크·운영 DB 쓰기 없음.
import assert from 'node:assert/strict'
import { fileURLToPath } from 'node:url'
import { compareWithOcr } from './ocr-compare.mjs'
import { readImageAI } from './ai-reader.mjs'

const fx = (n) => fileURLToPath(new URL(`../../test-fixtures/ocr/${n}`, import.meta.url))
const CASES = [
  // #4824 CTY KDA (기준 공고)
  { name: '#4824 KDA', files: ['4824-kda.png'], job: { employer_phone: '0877880756', contact_zalo: null, salary: '310k/11h ca ngày, 360k/11h ca đêm', contact_name: 'NGOC ANH DUONG', company: 'CTY KDA', age_min: 14, age_max: 50 } },
  // #4828 포스터만: 칸 배치 + 파란 띠 흰 글씨 전화번호 (Tesseract 실패 사례)
  { name: '#4828 poster-only', files: ['4828-mao-yen.png'], job: { employer_phone: '0342017663', contact_zalo: null, salary: '5.500.000đ/tháng', contact_name: null, company: '', age_min: null, age_max: null } },
]
let failed = 0
for (const c of CASES) {
  try {
    const text = (await Promise.all(c.files.map((f) => readImageAI(fx(f))))).join('\n')
    const res = compareWithOcr(c.job, text)
    assert.equal(res.status, 'ok', `${c.name}: 정답 값을 못 읽음 ${JSON.stringify(res.mismatches)}`)
    // 없는 값을 만들어내지 않는지: 포스터에 없는 전화·급여는 반드시 불일치
    assert.equal(compareWithOcr({ ...c.job, employer_phone: '0912345678' }, text).status, 'mismatch', `${c.name}: 없는 전화가 통과`)
    assert.equal(compareWithOcr({ ...c.job, salary: '9.900.000đ/tháng' }, text).status, 'mismatch', `${c.name}: 없는 급여가 통과`)
    console.log(`PASS ${c.name}`)
  } catch (e) {
    failed++
    console.log(`::error::${String(e.message).replace(/\r?\n/g, ' ').slice(0, 900)}`)
  }
}
if (failed) { console.error(`AI 판독자 교정 시험 실패 ${failed}/${CASES.length}`); process.exit(1) }
console.log(`ai-reader: ${CASES.length} real poster case(s) passed`)
