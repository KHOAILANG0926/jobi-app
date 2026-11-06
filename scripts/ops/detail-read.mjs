// 운영 공고 상세 화면 읽기 (Lee 2026-11-06 "캡처할 거면 왜 너랑 일해" — 등록 후 상세 화면은 작업자가 직접 읽는다).
// 사용: BASE_URL=https://viecganban.vn JOB_IDS="5506 5507" node scripts/ops/detail-read.mjs
//   PC(1366×900)·모바일(390×844)로 /viec-lam/sb-<번호>를 실제 브라우저로 열어
//   화면 글 전체(detail-read/<번호>-<기기>.txt)와 전체 화면 사진(.png)을 남긴다. 읽기만 하고 아무것도 바꾸지 않는다.
//   글은 GitHub 실행 로그·Summary에도 그대로 찍는다(작업자가 로그로 읽음).
import { chromium } from 'playwright'
import { appendFileSync, mkdirSync, writeFileSync } from 'node:fs'

const BASE_URL = (process.env.BASE_URL || 'https://viecganban.vn').replace(/\/$/, '')
const ids = String(process.env.JOB_IDS || '').split(/[\s,]+/).map((s) => s.replace(/^sb-/, '')).filter((s) => /^\d+$/.test(s))
if (!ids.length) { console.error('JOB_IDS 필요(예: "5506" 또는 "5506 5507")'); process.exit(2) }

const OUT = 'detail-read'
mkdirSync(OUT, { recursive: true })
const VIEWPORTS = [
  { name: 'pc', label: 'PC', viewport: { width: 1366, height: 900 } },
  { name: 'mobile', label: '모바일', viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true },
]

const browser = await chromium.launch()
let failed = 0
const summary = [`## 상세 화면 읽기 (${BASE_URL})`, '']
for (const id of ids) {
  for (const v of VIEWPORTS) {
    const context = await browser.newContext({ viewport: v.viewport, isMobile: v.isMobile, hasTouch: v.hasTouch, locale: 'vi-VN' })
    const page = await context.newPage()
    const errors = []
    page.on('pageerror', (e) => errors.push(String(e.message || e)))
    const url = `${BASE_URL}/viec-lam/sb-${id}`
    let text = ''
    let status = 0
    try {
      const res = await page.goto(url, { waitUntil: 'networkidle', timeout: 60_000 })
      status = res?.status() ?? 0
      await page.getByRole('heading', { level: 1 }).first().waitFor({ timeout: 30_000 })
      // 지연 로딩 영역까지 보이도록 끝까지 내렸다가 위로
      await page.evaluate(async () => { for (let y = 0; y < document.body.scrollHeight; y += 600) { window.scrollTo(0, y); await new Promise((r) => setTimeout(r, 150)) } window.scrollTo(0, 0) })
      await page.waitForTimeout(800)
      text = (await page.locator('main').first().innerText().catch(() => '')) || (await page.locator('body').innerText())
      await page.screenshot({ path: `${OUT}/${id}-${v.name}.png`, fullPage: true })
    } catch (e) {
      failed++
      text = `열기 실패: ${String(e.message || e).split('\n')[0]}`
    }
    if (errors.length) text += `\n\n[페이지 오류] ${errors.slice(0, 3).join(' | ').slice(0, 300)}`
    writeFileSync(`${OUT}/${id}-${v.name}.txt`, `${url} (${v.label}, HTTP ${status})\n\n${text}\n`)
    console.log(`\n===== sb-${id} ${v.label} (HTTP ${status}) ${url} =====\n${text}\n===== 끝 sb-${id} ${v.label} =====`)
    summary.push(`### sb-${id} ${v.label} — ${url}`, '', '```', text.slice(0, 6000), '```', '')
    await context.close()
  }
}
await browser.close()
if (process.env.GITHUB_STEP_SUMMARY) appendFileSync(process.env.GITHUB_STEP_SUMMARY, summary.join('\n') + '\n')
process.exit(failed ? 1 : 0)
