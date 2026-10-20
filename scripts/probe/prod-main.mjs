import { chromium } from 'playwright'
const b = await chromium.launch()
const ctx = await b.newContext({ viewport: { width: 1366, height: 900 } })
const p = await ctx.newPage()
for (const [tag, url] of [['main', 'https://viecganban.vn/'], ['cat', 'https://viecganban.vn/?cat=san_xuat_xay_dung']]) {
  await p.goto(url, { waitUntil: 'networkidle', timeout: 60000 })
  await p.waitForTimeout(5000)
  const panel = (await p.locator('text=/việc làm trong khung bản đồ|tin chưa xác định/').allTextContents()).join(' | ')
  const featured = await p.locator('text=Việc làm nổi bật').count()
  console.log(tag, 'panel:', panel.slice(0, 200), 'featured:', featured, 'kda:', await p.getByText('CTY KDA').count(), 'mao:', await p.getByText('dây truyền dữ liệu').count())
  await p.screenshot({ path: `m-${tag}.png`, fullPage: true })
}
await b.close()
