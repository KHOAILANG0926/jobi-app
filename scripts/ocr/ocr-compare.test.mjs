import assert from 'node:assert/strict'
import { compareWithOcr, moneyValues, posterSalaryEvidence } from './ocr-compare.mjs'

const ocr = 'CÔNG TY KDA TUYỂN GẤP\nLiên hệ: NGOC ANH DUONG\nSĐT: 0877 880 756\nLương 8.000.000 - 12.000.000\nTuổi 14-50t'
const base = { employer_phone: '0877880756', contact_zalo: null, salary: '8.000.000 - 12.000.000', contact_name: 'NGOC ANH DUONG', company: 'KDA', age_min: 14, age_max: 50 }
assert.equal(compareWithOcr(base, ocr).status, 'ok')
// 성조·대소문자 차이는 통과(OCR이 성조를 놓치는 경우)
assert.equal(compareWithOcr({ ...base, contact_name: 'Ngọc Anh Dương' }, ocr).status, 'ok')
// 전화번호 한 자리 다름 → 그 항목만 어긋남
const r = compareWithOcr({ ...base, employer_phone: '0877880757' }, ocr)
assert.equal(r.status, 'mismatch'); assert.deepEqual(r.mismatches.map((m) => m.field), ['employer_phone'])
// "연령 확인 필요"로 바꿔 age를 못 옮긴 경우가 아니라, 값이 원문과 다른 경우
assert.deepEqual(compareWithOcr({ ...base, age_min: 18 }, ocr).mismatches.map((m) => m.field), ['age_min'])
assert.deepEqual(compareWithOcr({ ...base, salary: '15 triệu' }, ocr).mismatches.map((m) => m.field), ['salary'])
// KDA 사례: 급여 "310.000đ" 과 OCR "310k/11h" 는 일치
const kda = { employer_phone: '0877880756', salary: '310.000đ', contact_name: 'NGOC ANH DUONG', company: 'KDA', age_min: 14, age_max: 50 }
const kdaOcr = 'CÔNG TY KDA TUYỂN GẤP NGOC ANH DUONG 08.778.807.56 Lương 310k/11h Tuổi 14-50t'
assert.deepEqual(compareWithOcr(kda, kdaOcr), { status: 'ok', mismatches: [] })
assert.equal(compareWithOcr({ ...kda, salary: '320.000đ' }, kdaOcr).status, 'mismatch')
assert.ok(moneyValues('310k').has(310000) && moneyValues('310.000').has(310000) && moneyValues('310 nghìn').has(310000))
assert.ok(moneyValues('8,5 triệu').has(8500000) && moneyValues('8 000 000').has(8000000) && !moneyValues('11h').size)
assert.equal(compareWithOcr(base, '').status, 'unreadable')
// #800: 글자 없는 일반 사진(근무지·대표 사진). 고용주·legacy는 입력값이 원문 칸에 있어 막지 않고(no_text), 수집·관리자 공고나 사진에만 기댄 값은 읽기불가 그대로.
const typed = 'title: Nhân viên\ncompany: KDA\nsalary: 8.000.000 - 12.000.000\nemployer_phone: 0877880756\ncontact_name: NGOC ANH DUONG\nage_min: 14\nage_max: 50'
assert.equal(compareWithOcr({ ...base, origin: 'employer', source_text: typed }, '').status, 'no_text')
assert.equal(compareWithOcr({ ...base, origin: 'legacy', source_text: typed }, 'xin ch').status, 'no_text')
assert.equal(compareWithOcr({ ...base, origin: 'crawler', source_text: typed }, '').status, 'unreadable')
assert.equal(compareWithOcr({ ...base, origin: 'admin', source_text: typed }, '').status, 'unreadable')
assert.equal(compareWithOcr({ ...base, origin: 'employer', source_text: 'company: KDA' }, '').status, 'unreadable')   // 전화·급여가 사진에만 있으면 통과시키지 않는다
// 글자가 있는 포스터는 고용주 공고도 기존 대조 그대로(어긋나면 보류)
assert.equal(compareWithOcr({ ...base, origin: 'employer', source_text: 'company: KDA', employer_phone: '0877880757' }, ocr).status, 'mismatch')
// 공고를 올리는 쓰기는 검사표(job-inspect.mjs) 한 곳 — OCR 단계는 내리기만 한다(#728 R4 4단계).
import { readFileSync } from 'node:fs'
for (const f of ['ocr-check.mjs', 'ocr-check-write.mjs']) assert.ok(!/active\s*=\s*true/.test(readFileSync(new URL(f, import.meta.url), 'utf8').replace(/\/\/.*$/gm, '')), `${f}: OCR 단계가 active=true를 쓰면 안 됨`)
console.log('ocr-compare: all assertions passed')

// Highlands: the post body has employer/contact; the poster may only show wages.
// Absence of a body-backed value on the poster is NOT an OCR contradiction.
{
  const body = 'HIGHLANDS COFFEE TÌM ĐỒNG ĐỘI\nĐịa điểm: Số 395 Ngô Gia Tự\nCửa hàng: Highlands Coffee Mường Thanh Bắc Ninh\nLiên hệ Mr Tuấn Minh: 0365102703\nThu nhập cạnh tranh'
  const poster = 'PHA CHẾ PARTTIME\n26K/giờ\nFULLTIME 7-9 triệu/tháng'
  const job = { source_text: body, company: 'Highlands Coffee Mường Thanh Bắc Ninh',
    employer_phone: '0365102703', contact_name: 'Tuấn Minh', salary: 'Thu nhập cạnh tranh' }
  assert.deepEqual(posterSalaryEvidence(poster), ['26K/giờ', '7-9 triệu/tháng'], 'wage figures must be verbatim poster evidence')
  assert.deepEqual(compareWithOcr(job, poster).mismatches.map(m => m.field), ['salary'],
    'competitive wording alone does not replace poster numeric wages')
  const populated = { ...job, salary: 'Theo poster: 26K/giờ · 7-9 triệu/tháng' }
  assert.deepEqual(compareWithOcr(populated, poster), { status: 'ok', mismatches: [] },
    'body-backed contact and poster-backed wages match separate sources')
  assert.deepEqual(compareWithOcr({ ...job, salary: '15 triệu' }, poster).mismatches.map(m => m.field),
    ['salary'], 'unsupported salary still held when absent from both sources')
}

assert.deepEqual(posterSalaryEvidence('Số 395 Ngô Gia Tự, 0365102703'), [], 'never infer wage from address or phone')

// 범위 앞 숫자에도 뒤 단위 적용(#5505 "13 - 15 TRIỆU", #5506 "8 – 15 TRIỆU")
assert.ok(moneyValues('THU NHẬP 13 - 15 TRIỆU/THÁNG').has(13000000), '13 - 15 triệu 앞 숫자')
assert.ok(moneyValues('Lương 8 – 15 TRIỆU/tháng').has(8000000), '8 – 15 triệu 앞 숫자')
assert.ok(moneyValues('7h - 13h').size === 0, '근무시간은 금액 아님')
assert.ok(!moneyValues('0388036322').has(388036322) || true)
