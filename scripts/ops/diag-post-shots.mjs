import { chromium } from 'playwright'
const b = await chromium.launch()
for (const [name, w] of [['pc', 1280], ['mobile', 390]]) {
  const p = await b.newPage({ viewport: { width: w, height: 900 } })
  const errs = []; p.on('pageerror', e => errs.push(e.message))
  await p.goto('http://localhost:4173/dang-tin', { waitUntil: 'networkidle', timeout: 60000 })
  await p.waitForTimeout(4000)
  await p.screenshot({ path: `shot-${name}.png`, fullPage: true })
  // 필수 칸을 비운 채 등록 → 첫 오류 안내
  await p.getByRole('button', { name: 'Đăng tin', exact: true }).click().catch(() => {})
  await p.waitForTimeout(800)
  const err = await p.locator('.form-error').first().textContent().catch(() => '')
  console.log(`::error title=${name}::legends=${JSON.stringify(await p.locator('legend').allTextContents())} firstError=${err} errs=${errs.join(' | ').slice(0, 300)}`)
}
await b.close()
