// 실제 포스터 OCR 회귀 시험(Tesseract vie + ImageMagick 필요, 네트워크·DB 없음).
// 새 OCR 실패 사례가 나오면 포스터를 test-fixtures/ocr/에 넣고 아래 CASES에 DB 값 그대로 추가한다(버그 하나 = 시험 하나).
import assert from 'node:assert/strict'
import { fileURLToPath } from 'node:url'
import { mkdtempSync, copyFileSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { execFileSync } from 'node:child_process'
import { compareWithOcr } from './ocr-compare.mjs'
import { readImage, tileBoxes } from './ocr-tiles.mjs'

// 조각이 이미지 전체를 빠짐없이 덮는지
const boxes = tileBoxes(526, 789)
for (let y = 0; y < 789; y += 7) for (let x = 0; x < 526; x += 7)
  assert.ok(boxes.some(b => x >= b.x && x < b.x + b.w && y >= b.y && y < b.y + b.h), `조각 누락 ${x},${y}`)

const CASES = [
  // #4828: 칸 디자인 포스터. 전체만 읽으면 급여 5.500.000을 놓쳐 'mismatch'(2026-10-17 운영 기록)
  { name: '#4828', files: ['4828-mao-yen.png', '4828-mao-yen-source.png'], job: { employer_phone: '0342017663', contact_zalo: null, salary: '5.500.000đ/tháng', contact_name: null, company: '', age_min: null, age_max: null }, fullOnly: 'mismatch' },
  // #4828 포스터만(표준 등록 경로): 하단 파란 띠의 흰 전화번호는 색 반전으로만 읽힘
  { name: '#4828 poster-only', files: ['4828-mao-yen.png'], job: { employer_phone: '0342017663', contact_zalo: null, salary: '5.500.000đ/tháng', contact_name: null, company: '', age_min: null, age_max: null }, fullOnly: 'mismatch' },
]
const dir = mkdtempSync(join(tmpdir(), 'ocr-test-'))
try {
  for (const c of CASES) {
    // 운영과 같이 공고의 이미지 전부를 읽어 합친 글로 대조한다(ocr-check.mjs와 동일)
    const files = c.files.map((name) => { const f = join(dir, name); copyFileSync(fileURLToPath(new URL(`../../test-fixtures/ocr/${name}`, import.meta.url)), f); return f })
    const full = files.map((f) => execFileSync('tesseract', [f, 'stdout', '-l', 'vie', '--psm', '6'], { encoding: 'utf8' })).join('\n')
    const fullRes = compareWithOcr(c.job, full)
    assert.equal(fullRes.status, c.fullOnly, `${c.name}: 전체만 읽은 결과가 기록과 다름 ${JSON.stringify(fullRes.mismatches)}`)
    const tiled = files.map(readImage).join('\n')
    const res = compareWithOcr(c.job, tiled)
    assert.equal(res.status, 'ok', `${c.name}: 조각 읽기 후에도 불일치 ${JSON.stringify(res.mismatches)}`)
    // 없는 값을 만들어내지 않음: 포스터에 없는 급여·전화는 여전히 불일치
    assert.equal(compareWithOcr({ ...c.job, salary: '9.900.000đ/tháng' }, tiled).status, 'mismatch', `${c.name}: 없는 급여가 통과`)
    assert.equal(compareWithOcr({ ...c.job, employer_phone: '0912345678' }, tiled).status, 'mismatch', `${c.name}: 없는 전화가 통과`)
  }
} finally { rmSync(dir, { recursive: true, force: true }) }
console.log(`ocr-tiles: ${CASES.length} real poster case(s) passed`)
