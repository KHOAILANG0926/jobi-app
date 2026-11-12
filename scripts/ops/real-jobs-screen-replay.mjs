// #728 S4 결과 기준 화면 재생 검사(이름이 replay인 이유: 설명 글 만들기는 입력 준비일 뿐, 검사 대상 출력은 원문 필드로만 판정): 실제 공고 원문(realJobs.fixtures)을 실제 상세 화면(PC1366·모바일390)에 그려
// 화면에 보이는 글자를 원문 값(전화·주소·제목·급여 숫자)과 비교한다. 정답은 원문 필드에서만 가져오고, 화면 함수(albamonCompose 등)를
// import하지 않는다(독립 — 만드는 코드와 같은 기준으로 검사하지 않기, #728 S5). 운영 DB 읽기·쓰기 없음(격리 응답 재생).
import { chromium } from 'playwright'
import { readFileSync, existsSync } from 'node:fs'
import { REAL_JOBS } from '../../src/lib/realJobs.fixtures.ts'
import { buildDescriptionFromSources } from '../../src/lib/jobDescriptionBuild.ts'

const base = process.env.BASE_URL || 'http://127.0.0.1:4190'
if (!['127.0.0.1', 'localhost'].includes(new URL(base).hostname)) throw new Error('local replay only')
const fold = (s) => String(s ?? '').normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/đ/gi, 'd').toLowerCase().replace(/\s+/g, ' ').trim()
const digits = (s) => String(s ?? '').replace(/\D/g, '')
/** 알려진 실패(줄기만 가능 — 늘면 실패, 고쳐서 통과하면 목록에서 빼야 실패). 이름은 '검사 항목'이지 공고 번호가 아니다. */
const KNOWN_FAILURES = new Set(JSON.parse(readFileSync(new URL('./real-jobs-screen-replay.known.json', import.meta.url), 'utf8')))

// 운영 원문 사례 중 fixtures에 없는 것(#729 급여 소수점 쉼표). 정답은 원문 글자 그대로.
const EXTRA = { 'decimal-salary': { title: 'Tuyển nhân viên kỹ thuật', company: 'Công ty Vincom Bắc Ninh', salary: '7 – 8,5 triệu/tháng + Thưởng doanh thu', contact_name: null, phones: ['0912345678'],
  addresses: ['Đường Lý Thái Tổ, Phường Kinh Bắc, Bắc Ninh'], ocr_text: null,
  source_text: 'Công ty Vincom Bắc Ninh tuyển Nhân viên Kỹ thuật\nLương 7 – 8,5 triệu/tháng + Thưởng doanh thu\nĐịa chỉ: Đường Lý Thái Tổ, Phường Kinh Bắc, Bắc Ninh\nLiên hệ: 0912345678' } }
const jobs = Object.entries({ ...REAL_JOBS, ...EXTRA }).map(([key, f], i) => ({ key, f, row: {
  id: 920000 + i, title: f.title, company: f.company, salary: f.salary, location: f.addresses[0] ?? '', employer_phone: f.phones[0] ?? null,
  source_text: f.source_text, active: true, posted_at: '2026-11-04',
  description: buildDescriptionFromSources([{ name: 'source_text', text: f.source_text }, { name: 'ocr_text', text: f.ocr_text }], { title: f.title, company: f.company, salary: f.salary, phones: f.phones, addresses: f.addresses }).description,
} }))

const browser = await chromium.launch({ executablePath: process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH || (existsSync('/usr/bin/chromium') ? '/usr/bin/chromium' : undefined), args: ['--no-sandbox'] })
const failed = new Set(), seen = new Set()
const check = (id, ok, detail) => { seen.add(id); if (!ok) { failed.add(id); console.log(`✗ ${id}\n    ${detail}`) } else console.log(`✓ ${id}`) }
try {
  for (const { key, f, row } of jobs) for (const width of [1366, 390]) {
    const context = await browser.newContext({ viewport: { width, height: 1000 } })
    await context.route('https://edhuesdnuxlbcfephutq.supabase.co/**', (route) => {
      const url = new URL(route.request().url())
      if (url.pathname.includes('/storage/')) return route.fulfill({ contentType: 'image/png', body: readFileSync('public/logo.png') })
      const table = url.pathname.split('/').at(-1)
      return route.fulfill({ json: table === 'local_jobs' ? [row] : [], headers: { 'content-range': '0-0/1' } })
    })
    await context.route('**/api/map-locations?**', (r) => r.fulfill({ json: { points: {} } }))
    const page = await context.newPage(), errors = []
    page.on('pageerror', (e) => errors.push(e.message))
    const id = (name) => `${name}@${key}/${width}`
    try {
      await page.goto(`${base}/viec-lam/sb-${row.id}`, { waitUntil: 'domcontentloaded' })
      await page.locator('.jd2-page').first().waitFor({ timeout: 15000 })
    } catch (e) { check(id('detail-renders'), false, String(e.message).split('\n')[0]); await context.close(); continue }
    const text = await page.locator('.jd2-page').first().innerText()
    const flat = fold(text), flatDigits = digits(text)
    check(id('no-page-error'), !errors.length, errors.join(' | '))
    check(id('no-horizontal-overflow'), !(await page.evaluate(() => document.documentElement.scrollWidth > innerWidth + 1)), 'scrollWidth > viewport')
    check(id('phone-shown'), f.phones.every((p) => flatDigits.includes(digits(p))), `원문 전화 ${JSON.stringify(f.phones)} 중 화면에 없음`)
    const street = fold(f.addresses[0] ?? '').split(',')[0]
    check(id('address-shown'), !street || flat.includes(street), `원문 주소 "${street}" 가 화면에 없음`)
    const salaryNums = (String(f.salary ?? '').match(/\d[\d.,]*/g) ?? []).map((n) => n.replace(/[.,]$/, ''))
    check(id('salary-numbers-shown'), salaryNums.every((n) => text.includes(n)), `원문 급여 ${f.salary} 의 숫자 ${JSON.stringify(salaryNums)} 중 화면에 없음`)
    const brokenDecimal = text.split('\n').filter((l) => /\d,\s*$/.test(l.trim()))
    check(id('decimal-comma-not-split'), !brokenDecimal.length, `소수점 쉼표에서 줄이 끊김: ${JSON.stringify(brokenDecimal)}`)
    await context.close()
  }
} finally { await browser.close() }

// 래칫: 알려진 실패 목록은 줄기만 한다 — 새 실패 = 실패, 목록에 있는데 통과 = 목록에서 빼라고 실패.
const itemOf = (id) => id.replace(/@.*/, '')
const newFailures = [...failed].filter((id) => !KNOWN_FAILURES.has(id))
const fixed = [...KNOWN_FAILURES].filter((id) => seen.has(id) && !failed.has(id))
if (newFailures.length) console.log(`\n새 실패 ${newFailures.length}개:\n` + newFailures.map((x) => '  ' + x).join('\n'))
if (fixed.length) console.log(`\n이제 통과하는데 알려진 실패 목록에 남아 있음(목록에서 빼야 함):\n` + fixed.map((x) => '  ' + x).join('\n'))
if (newFailures.length || fixed.length) process.exit(1)
console.log(`real-jobs-screen-replay: 검사 ${seen.size}건 — 통과 ${seen.size - failed.size}건, 알려진 오류 ${failed.size}건 미수정(허용 목록 ${KNOWN_FAILURES.size}건: ${[...new Set([...failed].map(itemOf))].join(', ') || '없음'})`)
console.log('범위: 화면 글자가 원문 값(전화·주소·급여 숫자)과 맞는지·줄 끊김·가로 넘침만 본다. 칸 배치·복리후생 의미·업종·값 덮어쓰기의 독립 검증은 하지 않는다(설명 글은 생산 buildDescriptionFromSources로 준비). 초록 = 원문-화면 완전 일치가 아님.')
