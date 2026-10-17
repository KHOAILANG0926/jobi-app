// Isolated fixtures only; never published as job data.
import assert from 'node:assert/strict'
import { readFileSync, mkdirSync } from 'node:fs'
import { createServer } from 'vite'
import { chromium } from 'playwright'
import { createElement } from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
const server = await createServer({ server: { middlewareMode: true }, appType: 'custom' })
let browser
try {
  const { ApplyUnavailableNotice } = await server.ssrLoadModule('/src/components/ApplyUnavailableNotice.tsx')
  const notice = renderToStaticMarkup(createElement(ApplyUnavailableNotice, { job: {}, onShowDescription() {} }))
  const styles = readFileSync('src/index.css', 'utf8')
  const fields = '<div class="jd2-two-col-card__grid"><dl class="jd2-two-col-card__column"><div class="jd2-two-col-card__row"><dt>Thời gian</dt><dd>08:00–17:00</dd></div></dl><dl class="jd2-two-col-card__column"><div class="jd2-two-col-card__row"><dt>Nơi làm việc</dt><dd>Bắc Ninh</dd></div></dl></div>'
  const cases = {
    missing: '<button class="jd2-btn-apply" disabled>Chưa có thông tin liên hệ</button>' + notice,
    internal: '<button class="jd2-btn-apply">Ứng tuyển</button><span class="jd2-aside-hint">Ứng tuyển nhanh bằng CV đã lưu trong Hồ sơ</span>',
    message: '<button class="jd2-btn-message">Nhắn tin nhà tuyển dụng</button>',
    compact: '<div class="jd2-aside-contact"><a class="jd2-aside-contact__call" href="tel:000">Gọi</a><a class="jd2-aside-contact__zalo">Zalo</a></div>',
  }
  browser = await chromium.launch()
  const page = await browser.newPage()
  mkdirSync('test-artifacts/detail-contact', { recursive: true })
  for (const width of [360, 390, 412, 1366, 1472]) {
    await page.setViewportSize({ width, height: 968 })
    for (const [name, contact] of Object.entries(cases)) {
      await page.setContent(`<style>${styles}</style><main style="width:calc(100% - 32px);max-width:1028px;margin:auto"><div class="jd2-grid jd2-grid--detail-redesign"><div class="jd2-main jd2-main--first"><section class="jd2-sec jd2-sec--conditions-grid"><h2 class="jd2-sec__title">Điều kiện làm việc</h2><div class="jd2-box jd2-two-col-card jd2-conditions-with-contact">${fields}<aside class="jd2-aside jd2-aside--contact-only">${contact}</aside></div></section></div></div></main>`)
      const dimensions = await page.evaluate(() => {
        const card = document.querySelector('.jd2-conditions-with-contact').getBoundingClientRect()
        const aside = document.querySelector('.jd2-aside--contact-only')
        const rect = aside.getBoundingClientRect()
        const notice = document.querySelector('.apply-unavailable')?.getBoundingClientRect()
        return { cardWidth: card.width, cardHeight: card.height, asideWidth: rect.width, hidden: getComputedStyle(aside).display === 'none', noticeHeight: notice?.height, overflow: document.documentElement.scrollWidth > innerWidth }
      })
      assert.equal(dimensions.overflow, false, `${name} ${width}px: horizontal overflow`)
      if (width <= 760) assert.equal(dimensions.hidden, true, `${name}: preserve existing mobile contact visibility`)
      else if (name === 'compact') assert.equal(dimensions.asideWidth, 54, 'preserve approved compact call/Zalo tiles')
      else {
        assert.ok(dimensions.asideWidth > dimensions.cardWidth * 0.8, `${name} ${width}px: text squeezed to ${dimensions.asideWidth}px`)
        assert.ok(dimensions.cardHeight < 500, `${name}: contact text creates a tall empty conditions area`)
        if (name === 'missing') assert.ok(dimensions.noticeHeight < 200, 'unavailable notice must remain readable')
      }
      if (width === 1472 && name === 'missing') await page.screenshot({ path: 'test-artifacts/detail-contact/desktop-missing-contact.png', fullPage: true })
      console.log(`Detail contact ${name} ${width}px: ${JSON.stringify(dimensions)}`)
    }
  }
} finally {
  if (browser) await browser.close()
  await server.close()
}
