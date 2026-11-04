// 2026-11-04 확인용: 운영 코드(master)·운영 데이터로 공고 상세요강 글을 그대로 뽑아 저장(Lee "상세 화면 직접 읽고 보고").
import { chromium } from 'playwright'
import { mkdirSync, writeFileSync } from 'node:fs'
const BASE = process.env.BASE_URL || 'http://localhost:4173'
const ids = process.argv.slice(2)
mkdirSync('out', { recursive: true })
const browser = await chromium.launch()
const ctx = await browser.newContext({ viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true, locale: 'vi-VN' })
for (const id of ids) {
  const page = await ctx.newPage()
  await page.goto(`${BASE}/viec-lam/sb-${id}`, { waitUntil: 'networkidle', timeout: 90000 }).catch(() => {})
  await page.waitForTimeout(3000)
  const text = await page.evaluate(() => {
    const d = document.querySelector('.jd2-detail-sections')
    return [...(d ? d.querySelectorAll('.jd2-detail-section') : [])].map((s) => s.innerText).join('\n\n') || '(상세요강 없음)'
  })
  writeFileSync(`out/desc-text-${id}.txt`, text)
  await page.locator('.jd2-detail-sections').first().screenshot({ path: `out/desc-${id}.png` }).catch(() => {})
  await page.close()
}
await browser.close()
