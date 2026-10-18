// 기준 화면 비교(2026-10-18): 운영 상세 화면을 PC·모바일로 촬영하고, 영역 구성을 기준 공고(CTY KDA #4824)와 비교한다.
// 촬영본은 screens 브랜치에 저장돼 AI가 직접 화면을 볼 수 있다(화면을 못 보고 판단하던 문제 방지).
// 사용: BASE_URL=https://www.viecganban.vn node scripts/ops/capture-detail.mjs <기준id> <대상id...>
import { chromium } from 'playwright'
import { mkdirSync, writeFileSync } from 'node:fs'
const BASE = (process.env.BASE_URL || 'https://www.viecganban.vn').replace(/\/$/, '')
const [baseId, ...targets] = process.argv.slice(2)
if (!baseId || !targets.length) { console.error('사용: capture-detail.mjs <기준id> <대상id...>'); process.exit(2) }
const OUT = 'screens'; mkdirSync(OUT, { recursive: true })
const VIEWS = [
  { name: 'pc', viewport: { width: 1366, height: 900 } },
  { name: 'mobile', viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true },
]
async function read(page) {
  return page.evaluate(() => {
    const vis = (el) => !!(el.offsetWidth || el.offsetHeight || el.getClientRects().length)
    const text = (el) => (el?.textContent || '').trim().replace(/\s+/g, ' ')
    const main = document.querySelector('.jd2-page') || document.body
    const headings = [...main.querySelectorAll('h2, h3')].filter(vis).map(text).filter(Boolean)
    const imgs = [...main.querySelectorAll('img')].filter(vis)
    const links = [...main.querySelectorAll('a')].filter(vis)
    return {
      headings,
      conditionLabels: [...main.querySelectorAll('.jd2-sec--conditions-grid dt, .jd2-sec--conditions-grid th, .jd2-sec--conditions-grid [class*="label"]')].filter(vis).map(text),
      map: document.querySelector('.jd2-vmap, .vietmapgl-map, .maplibregl-map') ? 'vietmap' : document.querySelector('iframe[src*="google"]') ? 'google-embed' : document.querySelector('.leaflet-container') ? 'leaflet' : 'none',
      mapPins: document.querySelectorAll('.vietmapgl-marker, .maplibregl-marker, .leaflet-marker-icon').length,
      mapNote: [...main.querySelectorAll('.jd2-map-dir-note, .jd2-map-area-note, .jd2-map-note')].filter(vis).map(text),
      directions: links.filter((a) => /Chỉ đường|Đến cổng|Gọi hỏi đường|bản đồ/i.test(a.textContent || '')).map((a) => ({ text: text(a), cls: a.className })),
      images: imgs.length,
      brokenImages: imgs.filter((i) => i.complete && i.naturalWidth === 0).map((i) => i.getAttribute('src')),
      literalBackslashN: /\\n/.test(main.innerText || ''),
    }
  })
}
const browser = await chromium.launch()
const report = {}
try {
  for (const id of [baseId, ...targets]) {
    for (const v of VIEWS) {
      const ctx = await browser.newContext({ viewport: v.viewport, isMobile: v.isMobile, hasTouch: v.hasTouch, locale: 'vi-VN' })
      const page = await ctx.newPage()
      await page.goto(`${BASE}/viec-lam/sb-${id}`, { waitUntil: 'networkidle', timeout: 90_000 }).catch(() => {})
      await page.waitForTimeout(4000)
      await page.screenshot({ path: `${OUT}/${id}-${v.name}.png`, fullPage: true })
      const isJobPage = await page.locator('.jd2-page').count()
      if (!isJobPage) { await ctx.close(); throw new Error(`#${id} ${v.name}: 공고 상세 화면이 아님(로그인 화면·오류 등) — 비교 불가`) }
      report[`${id}-${v.name}`] = await read(page)
      await ctx.close()
    }
  }
} finally { await browser.close() }
writeFileSync(`${OUT}/report.json`, JSON.stringify(report, null, 2))
// 비교: 기준 공고와 다른 영역 구성은 실패. 데이터가 없어서 생기는 차이(예: 이미지 칸 유무)는 별도 표시만.
const problems = []
for (const id of [baseId, ...targets]) for (const v of VIEWS) {
  const r = report[`${id}-${v.name}`], b = report[`${baseId}-${v.name}`]
  if (r.literalBackslashN) problems.push(`#${id} ${v.name}: 화면에 '\\n' 글자가 그대로 보임`)
  if (r.brokenImages.length) problems.push(`#${id} ${v.name}: 깨진 이미지 ${r.brokenImages.length}개 ${JSON.stringify(r.brokenImages)}`)
  if (id === baseId) continue
  if (r.map !== b.map) problems.push(`#${id} ${v.name}: 지도 종류가 기준과 다름 (기준 ${b.map}, 대상 ${r.map})`)
  if (r.mapPins !== b.mapPins) problems.push(`#${id} ${v.name}: 지도 핀 수가 기준과 다름 (기준 ${b.mapPins}, 대상 ${r.mapPins})`)
  const kinds = (x) => x.directions.map((d) => d.cls).join('|')
  if (kinds(r) !== kinds(b)) problems.push(`#${id} ${v.name}: 길찾기 버튼 모양이 기준과 다름 (기준 ${JSON.stringify(b.directions)}, 대상 ${JSON.stringify(r.directions)})`)
}
for (const p of problems) console.log(`::error::${p}`)
console.log(JSON.stringify(report, null, 2))
if (problems.length) { console.error(`기준 화면 비교 실패 ${problems.length}건`); process.exit(1) }
console.log('기준 화면 비교 통과')
