// R3(2026-11-13, sb-5438 모바일 핀 한 번 빔): 상세 지도는 JobVietMap 코드 조각을 늦게 불러오므로 고정 대기만으로 핀을 읽으면 비어 읽힌다.
// 격리 응답만 쓰고(운영 접근 없음) 그 코드 조각을 일부러 늦춰서 ① 고정 대기 수집이 핀을 놓치는 것(원인 재현)과 ② waitForMap이 기다려 핀 1개를 읽는 것을 확인한다.
import { chromium } from 'playwright'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { collectScreen, waitForMap } from './screen-collect.mjs'
const base = process.env.BASE_URL || 'http://127.0.0.1:4190'
if (!['127.0.0.1','localhost'].includes(new URL(base).hostname)) throw new Error('local fixture server required')
const job = { id:910080, title:'Trợ lý nhân sự thử nghiệm', company:'Map Browser Fixture', category:'van_phong', occupation_code:'4406', occupation_evidence:'Tuyển dụng và nhân sự', salary:'18.000.000đ/tháng', salary_period:'month', active:true, admin_hidden:false, posted_at:'2026-11-05', location:'Hà Nội', description:'Công việc\nTuyển dụng và nhân sự', employer_phone:'0900000000' }
const location = { id:910081, job_id:job.id, raw_address:'Hà Nội', lat:21.0285, lng:105.8542, point_kind:'area', point_precision:'area', point_revision:1, point_evidence:{source:'isolated browser fixture'}, location_verified:false, coordinate_accuracy:'region', sort_order:0 }
const browser = await chromium.launch({ executablePath: process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH || undefined, args: ['--no-sandbox'] })
let failures = 0
try {
  for (const width of [390, 1366]) {
    const run = async (useWait) => {
      const context = await browser.newContext({ viewport: { width, height: 844 }, isMobile: width < 760, hasTouch: width < 760 })
      await context.route('https://edhuesdnuxlbcfephutq.supabase.co/**', (route) => {
        const table = new URL(route.request().url()).pathname.split('/').at(-1)
        const rows = table === 'local_jobs' ? [job] : table.includes('work_locations') ? [location] : []
        return route.fulfill({ json: rows, headers: { 'content-range': `0-${Math.max(rows.length - 1, 0)}/${rows.length}` } })
      })
      await context.route('**/api/map-locations?**', (r) => r.fulfill({ json: { points: { [`sb-${job.id}`]: [{ ...location, workLocationId: location.id, kind: 'area', precision: 'area', revision: 1 }] } } }))
      await context.route('https://maps.geoapify.com/**', (r) => r.fulfill({ json: { version: 8, sources: {}, layers: [] } }))
      // 지도 코드 조각을 4초 늦춘다(느린 모바일·CI 흉내)
      await context.route('**/assets/JobVietMap-*.js', async (route) => { await new Promise((r) => setTimeout(r, 4000)); await route.continue() })
      const page = await context.newPage()
      await page.goto(`${base}/viec-lam/sb-${job.id}`, { waitUntil: 'domcontentloaded' })
      await page.locator('h1.jd2-header__title').first().waitFor({ timeout: 30000 })
      // detail-read.mjs와 같은 고정 대기(끝까지 내렸다 올림 + 0.8초)
      await page.evaluate(async () => { for (let y = 0; y < document.body.scrollHeight; y += 600) { window.scrollTo(0, y); await new Promise((r) => setTimeout(r, 150)) } window.scrollTo(0, 0) })
      await page.waitForTimeout(800)
      const ready = useWait ? await waitForMap(page, true) : null
      const view = await collectScreen(page, width < 760 ? '모바일' : 'PC')
      await context.close()
      return { ready, pins: view.pins }
    }
    const fixed = await run(false)
    const waited = await run(true)
    console.log(`${width}px 고정 대기만: 핀 ${fixed.pins.length}개 / waitForMap: 핀 ${waited.pins.length}개 (ready=${waited.ready})`)
    if (fixed.pins.length !== 0) { console.log(`::warning::${width}px 지도 코드 조각을 늦춰도 고정 대기가 핀을 읽음 — 원인 재현 조건이 바뀌었는지 확인`) }
    if (waited.pins.length !== 1 || waited.ready !== true) { failures++; console.error(`✗ ${width}px waitForMap이 핀을 기다려 읽지 못함`) }
  }
} finally { await browser.close() }
if (failures) process.exit(1)
console.log('screen-collect-async-check: 지도 코드 조각이 늦어도 waitForMap이 핀을 읽음')
