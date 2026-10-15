// 실제 앱 화면 자동 검사 (배포 강제 규칙 DR3, 2026-10-15 사용자 지시).
// 사용: BASE_URL=https://viecganban.vn node scripts/ops/app-smoke.mjs
//   PC(1366×900)·모바일(390×844) 두 화면에서 메인과 공고 상세를 실제 브라우저로 열어 확인한다.
//   - 메인: 페이지 오류 없음, 탐색 영역(.hme) 표시, 지도 영역까지 스크롤하면 지도(또는 대체 지도)가 뜸
//   - 상세: 공개 공고 1건(DB 공개 조회로 고름)을 열어 제목이 보이고 페이지 오류가 없음
// 결과는 app-smoke-result.json 과 GitHub Summary에 남기고, 하나라도 실패하면 exit 1.
// 키는 쓰지 않는다: Supabase URL·anon 키는 사이트 번들에 이미 공개된 값(src/lib/supabase.ts)을 읽는다.
import { chromium } from 'playwright'
import { appendFileSync, readFileSync, writeFileSync } from 'node:fs'

const BASE_URL = (process.env.BASE_URL || '').replace(/\/$/, '')
if (!BASE_URL) { console.error('BASE_URL 필요'); process.exit(2) }

const src = readFileSync(new URL('../../src/lib/supabase.ts', import.meta.url), 'utf8')
const SUPABASE_URL = src.match(/https:\/\/[a-z0-9]+\.supabase\.co/)?.[0]
const ANON = src.match(/eyJ[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+/)?.[0]

async function pickPublicJob() {
  if (!SUPABASE_URL || !ANON) return null
  const res = await fetch(`${SUPABASE_URL}/rest/v1/local_jobs?select=id,title&active=eq.true&admin_hidden=eq.false&order=id.desc&limit=1`,
    { headers: { apikey: ANON, Authorization: `Bearer ${ANON}` } })
  if (!res.ok) throw new Error(`공개 공고 조회 실패 HTTP ${res.status}`)
  return (await res.json())[0] ?? null
}

const VIEWPORTS = [
  { name: 'PC', viewport: { width: 1366, height: 900 } },
  { name: '모바일', viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true },
]

async function checkPage(context, path, assertions) {
  const page = await context.newPage()
  const errors = []
  page.on('pageerror', (e) => errors.push(String(e.message || e)))
  const res = await page.goto(BASE_URL + path, { waitUntil: 'domcontentloaded', timeout: 60_000 })
  const status = res?.status() ?? 0
  const notes = []
  if (status >= 400 || status === 0) notes.push(`HTTP ${status}`)
  try { await assertions(page, notes) } catch (e) { notes.push(String(e.message || e).split('\n')[0]) }
  if (errors.length) notes.push(`페이지 오류: ${errors.slice(0, 3).join(' | ').slice(0, 300)}`)
  await page.close()
  return { path, status, ok: notes.length === 0, notes }
}

const results = []
const browser = await chromium.launch()
let job = null
try { job = await pickPublicJob() } catch (e) { results.push({ device: '-', path: 'DB', ok: false, notes: [String(e.message)] }) }
for (const v of VIEWPORTS) {
  const context = await browser.newContext({ viewport: v.viewport, isMobile: v.isMobile, hasTouch: v.hasTouch })
  results.push({ device: v.name, ...(await checkPage(context, '/', async (page) => {
    await page.locator('.hme').first().waitFor({ state: 'visible', timeout: 30_000 })
    await page.locator('.hme__map').first().scrollIntoViewIfNeeded()
    // 지도 캔버스(VietMap·대체 지도) 또는 지도 그리기 영역이 생겨야 한다. 계속 "Đang tải bản đồ…"만이면 실패.
    await page.locator('.hme__map canvas, .hme__map .hme-map__canvas, .hme__map [data-map-provider]').first()
      .waitFor({ state: 'attached', timeout: 45_000 })
  })) })
  if (job) {
    results.push({ device: v.name, ...(await checkPage(context, `/viec-lam/sb-${job.id}`, async (page) => {
      await page.getByRole('heading', { level: 1 }).first().waitFor({ state: 'visible', timeout: 30_000 })
      const h1 = (await page.getByRole('heading', { level: 1 }).first().innerText()).trim()
      if (!h1) throw new Error('상세 제목이 비어 있음')
    })) })
  }
  await context.close()
}
await browser.close()

const ok = results.every((r) => r.ok)
const summary = { base: BASE_URL, checkedAt: new Date().toISOString(), job: job ? `sb-${job.id}` : '공개 공고 없음(상세 검사 생략)', ok, results }
writeFileSync('app-smoke-result.json', JSON.stringify(summary, null, 2))
const lines = [`## 실제 화면 자동 검사: ${ok ? '통과' : '실패'}`, `- 대상: ${BASE_URL} · 상세 공고: ${summary.job}`,
  ...results.map((r) => `- ${r.ok ? '✅' : '❌'} ${r.device} ${r.path}${r.notes?.length ? ' — ' + r.notes.join('; ') : ''}`)]
console.log(lines.join('\n'))
if (process.env.GITHUB_STEP_SUMMARY) appendFileSync(process.env.GITHUB_STEP_SUMMARY, lines.join('\n') + '\n')
if (!ok) { for (const r of results.filter((x) => !x.ok)) console.log(`::error::${r.device} ${r.path}: ${r.notes.join('; ')}`); process.exit(1) }
