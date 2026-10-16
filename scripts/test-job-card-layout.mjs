// Test-only fixtures: never included in the production app or public job data.
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { createServer } from 'vite'
import { chromium } from 'playwright'
import { createElement } from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
const server = await createServer({ server: { middlewareMode: true }, appType: 'custom' })
let browser
try {
  const { default: JobCard } = await server.ssrLoadModule('/src/components/JobCard.tsx')
  const data = { company: 'CTY KDA', title: 'tuyển nam, nữ làm linh kiện tai nghe tại KCN Yên Phong', location: 'KCN Yên Phong, Bắc Ninh', category: 'san_xuat_xay_dung', salary: '310k/11h ca ngày', postedAt: '2026-10-16' }
  const cases = [
    { id: 'test-image', imageUrl: 'https://edhuesdnuxlbcfephutq.supabase.co/storage/v1/object/public/job-images/layout-test.png' },
    { id: 'test-no-image' },
    { id: 'test-rejected-image', imageUrl: 'https://external.invalid/poster.png' },
  ]
  const cards = cases.map(job => renderToStaticMarkup(createElement(JobCard, { job: { ...data, ...job }, isApplied: false })))
  // This fails on the original bug, before any production edit.
  for (const [i, html] of cards.entries()) assert.match(html, /class="jc__logo-wrap"/, `case ${cases[i].id} must preserve poster slot`)
  browser = await chromium.launch({ headless: true })
  const page = await browser.newPage()
  await page.route('https://edhuesdnuxlbcfephutq.supabase.co/**', route => route.abort())
  const styles = readFileSync('src/index.css', 'utf8') + '\n' + readFileSync('src/components/JobCard.css', 'utf8')
  for (const width of [360, 390, 412, 1366]) {
    await page.setViewportSize({ width, height: 844 })
    await page.setContent(`<style>${styles}\n#test-cards{display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:14px;width:${width < 600 ? width - 32 : 1270}px} @media(max-width:600px){#test-cards{grid-template-columns:1fr}}</style><div id="test-cards">${cards.join('')}</div>`)
    const bounds = await page.locator('.jc').evaluateAll(cards => cards.map(card => {
      const origin = card.getBoundingClientRect()
      return Object.fromEntries(['.jc__logo-wrap','.jc__identity','.jc__title','.jc__footer'].map(selector => {
        const b = card.querySelector(selector).getBoundingClientRect()
        return [selector, [b.x-origin.x, b.y-origin.y, b.width, b.height].map(n => Math.round(n*100)/100)]
      }))
    }))
    assert.deepEqual(bounds[1], bounds[0], `missing image layout at ${width}px`)
    assert.deepEqual(bounds[2], bounds[0], `rejected image layout at ${width}px`)
    assert.equal(await page.locator('.jc__logo').count(), 1, 'no fabricated images')
    console.log(`JobCard ${width}px: image/missing/blocked-image geometry identical`)
  }
} finally {
  if (browser) await browser.close()
  await server.close()
}
