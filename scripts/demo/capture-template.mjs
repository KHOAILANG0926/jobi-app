// 데모 B안 촬영: 공고 등록 → 간편 템플릿 적용 → 미리보기(PC·휴대폰) 상세 ④ → out/tpl-*.png
import { chromium } from 'playwright'
const BASE = process.env.BASE_URL || 'http://localhost:4173'
const b = await chromium.launch(); const log = []
for (const [n, vp, btn] of [['pc', { width: 1366, height: 900 }, '.pj-side__pv button:first-child'], ['m', { width: 390, height: 844 }, '.pj-bar button:has-text("Xem trước")']]) {
  const ctx = await b.newContext({ viewport: vp, locale: 'vi-VN' }); const p = await ctx.newPage(); const errs = []
  p.on('pageerror', (e) => errs.push(e.message.slice(0, 100))); p.on('dialog', (d) => d.accept())
  await p.goto(BASE + '/dang-tin', { waitUntil: 'networkidle', timeout: 60000 }).catch(() => {}); await p.waitForTimeout(1200)
  await p.locator('.pj input[maxlength="40"]').first().fill('Tuyển nhân viên phục vụ quán cà phê')
  await p.locator('.pj input[placeholder*="công ty"], .pj input[placeholder*="Tên"]').first().fill('Cà phê Mẫu').catch(() => {})
  await p.locator('.amt-apply__btn').click().catch((e) => errs.push('apply ' + e.message.slice(0, 60)))
  await p.waitForTimeout(500)
  await p.locator('#pj-s7').scrollIntoViewIfNeeded().catch(() => {})
  await p.screenshot({ path: `out/tpl-${n}-1-editor.png` })
  const popP = ctx.waitForEvent('page', { timeout: 10000 }).catch(() => null)
  await p.locator(btn).first().click().catch((e) => errs.push('pv ' + e.message.slice(0, 60)))
  const pop = await popP
  if (pop) {
    await pop.waitForLoadState('networkidle').catch(() => {}); await pop.waitForTimeout(1500)
    await pop.locator('.jd2-template-doc').scrollIntoViewIfNeeded().catch(() => errs.push('no template doc'))
    await pop.waitForTimeout(500)
    await pop.screenshot({ path: `out/tpl-${n}-2-detail.png` })
    await pop.screenshot({ path: `out/tpl-${n}-3-full.png`, fullPage: true })
  } else errs.push('no popup')
  log.push(n + ' ' + JSON.stringify(errs)); await ctx.close()
}
console.log(log.join('\n')); await b.close()
