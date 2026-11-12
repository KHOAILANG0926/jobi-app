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
// 실제 공고 번호가 있는 대표 공고는 그 번호 그대로 재생한다(KDA sb-4824는 기존 틀, 나머지는 최신 틀 — usesAlbamonLayout이 번호로 틀을 고름). 번호 없는 합성 사례만 94만대
const jobs = R2_ORACLE.map((o, i) => ({ o, row: { id: /^\d{4}\b/.test(o.id) ? Number(o.id.slice(0, 4)) : 940000 + i, title: o.ctx.title, company: o.ctx.company, salary: o.ctx.salary, location: o.ctx.addresses[0] ?? '', employer_phone: o.ctx.phones[0] ?? null,
  source_text: o.source, active: true, posted_at: '2026-11-04', description: buildDescriptionFromSources([{ name: 'source_text', text: o.source }], o.ctx).description } }))
// 금액 표기 정규화(화면은 310k → 310.000đ처럼 금액 모양만 바꾼다): 금액 조각만 '#숫자'로 통일하고 줄의 나머지 글자(문맥)는 그대로 둔 채 줄 전체를 비교한다
// — 숫자만 같으면 통과시키지 않는다(날짜의 "13"이 "lương tháng 13" 줄을 대신하지 못함, Codex 지적)
const canon = (s) => String(s).replace(/(\d[\d.,]*)\s*(k|tr|triệu|vnđ|vnd|đ)?(?![a-zà-ỹ])/gi, (_, d, u) => {
  const n = d.replace(/[.,]/g, ''); const x = (u ?? '').toLowerCase()
  return ` #${x === 'k' ? n + '000' : x === 'tr' || x === 'triệu' ? n + '000000' : n} `
})
const classify = (areaText, f) => {
  const e = norm(canon(f.evidence))
  // 영역마다 따로 대조해 합친다 — 한 영역에서 찾았다고 다른 영역을 건너뛰지 않는다
  return Object.entries(areaText).filter(([, t]) => norm(canon(t)).includes(e)).map(([k]) => k)
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
      // 음성 대조 2: 급여 줄(변환 표기 대조 대상)이 이미 허용 영역에 있어도, 금지된 ② 영역에 변환 표기로 나오면 잡아야 한다
      const pay = o.facts.find((f) => f.section === '04' && /\d/.test(f.evidence))
      if (pay) {
        const ok = ALLOWED_AREAS['04'][0]
        const converted = pay.evidence.replace(/(\d+)k(?![a-zà-ỹ])/gi, '$1.000đ')
        const injected = { [ok]: pay.evidence, '②': converted }
        const f = classify(injected, pay)
        checks++
        if (!f.some((a) => !ALLOWED_AREAS['04'].includes(a))) failures.push(`✗ [${o.id}] 음성 대조 실패: 급여 줄이 허용 영역에 있고 ② 영역에도 변환 표기로 있는데 검사가 못 잡음`)
        // 음성 대조 3: 줄은 빠지고 같은 숫자만 다른 문맥(날짜 등)에 있으면 빠짐으로 잡아야 한다
        const onlyNums = { [ok]: 'Yêu cầu: Có thể làm việc từ ngày ' + (pay.evidence.match(/\d[\d.,]*/g) ?? []).join(' ') }
        checks++
        if (norm(pay.evidence).replace(/\d+/g, '').trim().length > 0 && classify(onlyNums, pay).length) failures.push(`✗ [${o.id}] 음성 대조 실패: 급여 줄이 없고 숫자만 다른 문맥에 있는데 검사가 통과시킴`)
      }
    }
    await context.close()
  }
} finally { await browser.close() }
console.log(`real-jobs-area-check: 대표 공고 ${jobs.length}개 × PC·모바일, 검사 ${checks}건, 실패 ${failures.length}건`)
if (failures.length) { console.log(failures.join('\n')); process.exit(1) }
console.log('real-jobs-area-check: all assertions passed')
