// 데모 촬영: 머리 줄·메뉴 펼침·바닥(PC 1366·휴대폰 390) → out/chrome-*.png
import { chromium } from 'playwright'
import { mkdirSync } from 'node:fs'
const BASE = process.env.BASE_URL || 'http://localhost:4173'
mkdirSync('out', { recursive: true })
const b = await chromium.launch()
const log = []
for (const [n, o] of [['pc', { viewport: { width: 1366, height: 900 } }], ['m', { viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true }]]) {
  const ctx = await b.newContext({ ...o, locale: 'vi-VN' }); const p = await ctx.newPage(); const errs = []
  p.on('pageerror', (e) => errs.push(e.message.slice(0, 120)))
  const go = async (path) => { await p.goto(BASE + path, { waitUntil: 'networkidle', timeout: 60000 }).catch(() => {}); await p.waitForTimeout(1200) }
  await go('/ho-tro')
  await p.screenshot({ path: `out/chrome-${n}-1-top.png` })
  if (n === 'pc') {
    await p.getByRole('button', { name: 'Mở danh mục Việc làm', exact: true }).hover().catch((e) => errs.push('hover ' + e.message.slice(0, 60)))
    await p.waitForTimeout(500); await p.screenshot({ path: `out/chrome-${n}-2-menu.png` })
    await p.mouse.move(683, 880); await p.waitForTimeout(400)
    await p.getByRole('button', { name: 'Mở danh mục Công cụ', exact: true }).hover().catch(() => {})
    await p.waitForTimeout(500); await p.screenshot({ path: `out/chrome-${n}-3-menu2.png` })
    await p.mouse.move(683, 880); await p.waitForTimeout(400)
    await p.getByRole('button', { name: 'Mở menu nhà tuyển dụng', exact: true }).click().catch((e) => errs.push('emp ' + e.message.slice(0, 60)))
    await p.waitForTimeout(400); await p.screenshot({ path: `out/chrome-${n}-4-employer.png` })
    await p.keyboard.press('Escape')
    await p.locator('.header-search__input').fill('phục vụ'); await p.keyboard.press('Enter'); await p.waitForTimeout(1500)
    log.push('search → ' + p.url())
  } else {
    await p.getByRole('button', { name: 'Mở danh mục Việc làm', exact: true }).click().catch((e) => errs.push('tap ' + e.message.slice(0, 60)))
    await p.waitForTimeout(500); await p.screenshot({ path: `out/chrome-${n}-2-menu.png` })
    await p.mouse.click(10, 830).catch(() => {})
  }
  await go('/chu-de/ky-tuc-xa')
  await p.screenshot({ path: `out/chrome-${n}-5-page.png`, fullPage: true })
  await go('/')
  await p.screenshot({ path: `out/chrome-${n}-6-home.png` })
  log.push(n + ' errors ' + JSON.stringify(errs))
  await ctx.close()
}
for (const w of [1297, 1100, 900, 780]) {
  const ctx = await b.newContext({ viewport: { width: w, height: 400 }, locale: 'vi-VN' }); const p = await ctx.newPage()
  await p.goto(BASE + '/ho-tro', { waitUntil: 'networkidle', timeout: 60000 }).catch(() => {}); await p.waitForTimeout(800)
  const m = await p.evaluate(() => ({ tabsH: Math.max(...[...document.querySelectorAll('.layout--d .header-tab')].map((e) => Math.round(e.getBoundingClientRect().height))), sw: document.documentElement.scrollWidth, navR: Math.round(document.querySelector('.header-tabs__nav')?.getBoundingClientRect().right ?? 0), actL: Math.round(document.querySelector('.header-tabs__actions')?.getBoundingClientRect().left ?? 0), searchR: Math.round(document.querySelector('.header-search')?.getBoundingClientRect().right ?? 0) }))
  log.push(w + ' ' + JSON.stringify(m))
  await p.screenshot({ path: `out/chrome-w${w}.png`, clip: { x: 0, y: 0, width: w, height: 200 } })
  await ctx.close()
}
console.log(log.join('\n'))
await b.close()
