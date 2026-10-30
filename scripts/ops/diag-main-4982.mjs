import { chromium } from 'playwright'
const b = await chromium.launch({ args: ['--lang=ko-KR'] })
for (const w of [1280, 390]) {
  const ctx = await b.newContext({ viewport: { width: w, height: 900 }, locale: 'ko-KR' })
  const p = await ctx.newPage()
  await p.goto('https://www.viecganban.vn/dang-tin', { waitUntil: 'networkidle', timeout: 60000 })
  await p.waitForTimeout(3000)
  const r = await p.evaluate(() => {
    const seg = document.querySelector('.pj-seg--fill'); const btns = seg ? [...seg.querySelectorAll('button')] : []
    return { timeInputs: document.querySelectorAll('input[type=time]').length, timeSelects: document.querySelectorAll('select[aria-label="Giờ bắt đầu"]').length,
      durationRows: new Set(btns.map(x => Math.round(x.getBoundingClientRect().top))).size, hint: /tự thu nhỏ/.test(document.body.innerText) }
  })
  console.log(`::error title=prod ${w}::${JSON.stringify(r)}`)
}
await b.close()
