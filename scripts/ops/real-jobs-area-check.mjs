// R2(#753) 화면 영역 검증(읽기 전용·격리 응답 재생): 대표 공고 원문의 줄이 승인된 4영역 중 **맞는 영역**에 표시되는지 PC1366·모바일390 실제 렌더링에서 확인한다.
// 기대값은 r2Oracle.fixtures.ts(줄 → 줄 종류)와 r2Areas.fixtures.ts(줄 종류 → 허용 영역, 10-30 확정 구성)에서 오고 생산 함수로 만들지 않는다.
// 문장이 화면 어딘가에 있는지만 보지 않는다: 허용 밖 영역에 나오면(잘못된 칸) 실패, 어느 영역에도 없으면(빠짐) 실패. 승인된 화면 디자인은 바꾸지 않는다.
import { chromium } from 'playwright'
import { readFileSync, existsSync } from 'node:fs'
import { R2_ORACLE } from '../../src/lib/r2Oracle.fixtures.ts'
import { ALLOWED_AREAS, AREA_TITLES } from '../../src/lib/r2Areas.fixtures.ts'
import { buildDescriptionFromSources } from '../../src/lib/jobDescriptionBuild.ts'

const base = process.env.BASE_URL || 'http://127.0.0.1:4190'
if (!['127.0.0.1', 'localhost'].includes(new URL(base).hostname)) throw new Error('local replay only')
const norm = (s) => String(s).normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/đ/gi, 'd').toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim()
const jobs = R2_ORACLE.map((o, i) => ({ o, row: { id: 940000 + i, title: o.ctx.title, company: o.ctx.company, salary: o.ctx.salary, location: o.ctx.addresses[0] ?? '', employer_phone: o.ctx.phones[0] ?? null,
  source_text: o.source, active: true, posted_at: '2026-11-04', description: buildDescriptionFromSources([{ name: 'source_text', text: o.source }], o.ctx).description } }))
// 숫자 낱말 비교(급여 줄은 화면에서 310k → 310.000đ, "12 -> 17 triệu" → "12 - 17 triệu"처럼 모양만 바뀌므로 글자 대신 숫자로 본다)
const nums = (s) => [...String(s).toLowerCase().matchAll(/(\d[\d.,]*)\s*(k|tr|triệu)?/g)].map((m) => { const n = m[1].replace(/[.,]/g, ''); return m[2] === 'k' ? n + '000' : n })
const classify = (areaText, f) => {
  const e = norm(f.evidence)
  let found = Object.entries(areaText).filter(([, t]) => norm(t).includes(e)).map(([k]) => k)
  if (!found.length && f.section === '04') { const n = nums(f.evidence); if (n.length) found = Object.entries(areaText).filter(([, t]) => { const have = new Set(nums(t)); return n.every((x) => have.has(x) || have.has(x + '000')) }).map(([k]) => k) }
  return found
}
const failures = []
let checks = 0
const browser = await chromium.launch({ executablePath: process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH || (existsSync('/usr/bin/chromium') ? '/usr/bin/chromium' : undefined), args: ['--no-sandbox'] })
try {
  for (const width of [1366, 390]) for (const { o, row } of jobs) {
    const context = await browser.newContext({ viewport: { width, height: 1000 } })
    await context.route('https://edhuesdnuxlbcfephutq.supabase.co/**', (route) => {
      const url = new URL(route.request().url())
      if (url.pathname.includes('/storage/')) return route.fulfill({ contentType: 'image/png', body: readFileSync('public/logo.png') })
      return route.fulfill({ json: url.pathname.split('/').at(-1) === 'local_jobs' ? [row] : [], headers: { 'content-range': '0-0/1' } })
    })
    await context.route('**/api/map-locations?**', (r) => r.fulfill({ json: { points: {} } }))
    const page = await context.newPage()
    await page.goto(`${base}/viec-lam/sb-${row.id}`, { waitUntil: 'domcontentloaded' })
    await page.locator('.jd2-page').first().waitFor({ timeout: 20000 })
    // 승인된 4영역 = section.jd2-sec의 제목. 영역별 글자(textContent — 모바일에서 접힌 칸도 같은 구조로 본다)
    const areaText = await page.evaluate((titles) => {
      const out = {}
      for (const sec of document.querySelectorAll('.jd2-page section.jd2-sec')) {
        const t = sec.querySelector(':scope > h2')?.textContent?.trim()
        const key = Object.keys(titles).find((k) => titles[k] === t)
        if (key) out[key] = (out[key] ?? '') + '\n' + sec.textContent
      }
      return out
    }, AREA_TITLES)
    const missingAreas = Object.keys(AREA_TITLES).filter((k) => !(k in areaText))
    checks++; if (missingAreas.length) failures.push(`✗ [${o.id}/${width}px] 승인된 영역 제목 없음: ${missingAreas.map((k) => k + AREA_TITLES[k]).join(', ')} (공고에 값이 없으면 영역이 빠질 수 있음 — 확인 필요)`)
    for (const f of o.facts) {
      const found = classify(areaText, f)
      const allowed = ALLOWED_AREAS[f.section]
      checks++
      if (!found.length) failures.push(`✗ [${o.id}/${width}px] "${f.evidence}" (종류 ${f.section}) 어느 영역에도 없음(빠짐)`)
      else if (found.some((a) => !allowed.includes(a))) failures.push(`✗ [${o.id}/${width}px] "${f.evidence}" (종류 ${f.section}) 잘못된 영역에 표시: ${found.join(',')} — 허용 ${allowed.join(',')}`)
    }
    // 음성 대조: 같은 화면의 ② 영역에 업무 줄을 일부러 넣으면(잘못된 칸) 검사가 반드시 잡아야 한다 — 못 잡으면 검사기 고장
    if (width === 1366) {
      const duty = o.facts.find((f) => f.section === '01')
      if (duty) {
        const injected = { ...areaText, '②': (areaText['②'] ?? '') + '\n' + duty.evidence }
        const f = classify(injected, duty)
        checks++
        if (!f.some((a) => !ALLOWED_AREAS['01'].includes(a))) failures.push(`✗ [${o.id}] 음성 대조 실패: 업무 줄을 ② 영역에 넣어도 검사가 못 잡음`)
      }
    }
    await context.close()
  }
} finally { await browser.close() }
console.log(`real-jobs-area-check: 대표 공고 ${jobs.length}개 × PC·모바일, 검사 ${checks}건, 실패 ${failures.length}건`)
if (failures.length) { console.log(failures.join('\n')); process.exit(1) }
console.log('real-jobs-area-check: all assertions passed')
