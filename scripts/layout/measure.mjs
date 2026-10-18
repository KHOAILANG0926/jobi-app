// 공고 화면 도면 측정기 (결정 0005, 2026-10-18 Lee 지시)
// 사진 비교가 아니라 "치수 측정": 화면의 각 영역 위치·폭·높이·간격·글자 크기를 숫자로 재서 도면(숫자)과 대조한다.
// 사용:
//   BASE_URL=... node scripts/layout/measure.mjs extract <공고id...>   → 측정값 JSON 출력(도면 초안용)
//   BASE_URL=... node scripts/layout/measure.mjs check  <공고id...>   → 도면과 대조, 어긋나면 실패
// 각 공고는 그대로 + 이미지 실패 상태(이미지 요청 차단) 두 번씩 잰다.
import { chromium } from 'playwright'
import { readFileSync, writeFileSync, mkdirSync, existsSync } from 'node:fs'

export const DRAWING = 'docs/decisions/drawings/job-detail-layout.json'
const BASE = (process.env.BASE_URL || 'https://www.viecganban.vn').replace(/\/$/, '')
export const VIEWS = {
  pc: { viewport: { width: 1366, height: 900 } },
  mobile: { viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true },
}

// 화면 안에서 실행: 영역별 숫자를 평평한 표(이름 → 값)로 돌려준다.
function measureInPage() {
  const r1 = (n) => Math.round(n * 10) / 10
  const vis = (el) => !!el && !!(el.offsetWidth || el.offsetHeight) && getComputedStyle(el).display !== 'none' && getComputedStyle(el).visibility !== 'hidden'
  const page = document.querySelector('.jd2-page')
  if (!page) return { error: 'no .jd2-page' }
  const P = page.getBoundingClientRect()
  const sy = window.scrollY
  const box = (el) => { const b = el.getBoundingClientRect(); return { x: b.left - P.left, y: b.top + sy, w: b.width, h: b.height, r: b.right - P.left, bottom: b.bottom + sy } }
  const out = {}
  const font = (name, el) => {
    const s = getComputedStyle(el)
    out[`${name}.font`] = `${s.fontSize} ${s.fontWeight}`
    out[`${name}.color`] = s.color
  }
  const put = (name, el, { size = false, width = true, f = false } = {}) => {
    if (!vis(el)) return null
    const b = box(el)
    out[`${name}.x`] = r1(b.x)
    if (width) out[`${name}.w`] = r1(b.w)
    if (size) out[`${name}.h`] = r1(b.h)
    if (f) font(name, el)
    return b
  }
  const gap = (name, a, b) => { if (a && b) out[`${name}.gap`] = r1(b.y - a.bottom) }

  // 1) 머리 영역(이미지·업종·제목·회사·급여·복리후생 아이콘·위치/날짜)
  const header = page.querySelector('.jd2-header')
  const H = put('header', header, {})
  const logo = put('header.logo', header?.querySelector('.jd2-logo'), { size: true })
  const chips = put('header.chips', header?.querySelector('.jd2-header__chips'), { width: false })
  const title = put('header.title', header?.querySelector('h1'), { width: false, f: true })
  const company = put('header.company', header?.querySelector('.jd2-header__company'), { width: false, size: true, f: true })
  const salary = put('header.salary', header?.querySelector('.jd2-hl-salary'), { width: false })
  const salaryVal = header?.querySelector('.jd2-hl-salary__val'); if (vis(salaryVal)) font('header.salary.value', salaryVal)
  const benefits = put('header.benefits', header?.querySelector('.jd2-benefits'), { size: true })
  const meta = put('header.meta', header?.querySelector('.jd2-header__meta'), {})
  if (H && logo) { out['header.logo.top'] = r1(logo.y - H.y) }
  if (H && chips) { out['header.chips.top'] = r1(chips.y - H.y) }
  gap('header.chips→title', chips, title); gap('header.title→company', title, company)
  gap('header.company→salary', company, salary); gap('header.salary→benefits', salary, benefits); gap('header.benefits→meta', benefits, meta)
  if (H && meta) out['header.meta→bottom.gap'] = r1(H.bottom - meta.bottom)
  // 위치·등록일 배치(2026-10-18 Lee 지시): 위치 = 복리후생 줄 오른쪽 끝, 등록일 = 즐겨찾기 왼쪽
  const loc = header?.querySelector('.jd2-meta-item'), date = [...(header?.querySelectorAll('.jd2-meta-date') ?? [])].find(vis), save = header?.querySelector('.jd2-save-btn')
  const info = header?.querySelector('.jd2-header__info')
  if (vis(loc) && benefits && vis(info)) {
    const lb = box(loc), ib = box(info)
    out['header.location.right-gap'] = r1(ib.r - lb.r)
    out['header.location.right-gap-to-card'] = r1(H.r - lb.r)
    out['header.location.lines'] = Math.round(lb.h / parseFloat(getComputedStyle(loc).lineHeight || '18'))
    out['header.info.w'] = r1(ib.w)
    out['header.title.w'] = r1(box(header.querySelector('h1')).w)
    out['header.location.bottom-vs-benefits-bottom'] = r1(lb.bottom - benefits.bottom)
    out['header.location.left-minus-benefits-right'] = r1(lb.x - (benefits.x + benefits.w))
  }
  if (vis(date) && vis(save)) {
    const db = box(date), sb = box(save)
    out['header.date.mid-vs-save-mid'] = r1((db.y + db.h / 2) - (sb.y + sb.h / 2))
    out['header.date.gap-to-save'] = r1(sb.x - db.r)
  }

  // 2) 탭
  const tabs = put('tabs', page.querySelector('.jd2-tabs'), { size: true })
  gap('header→tabs', H, tabs)

  // 3) 구역(근무조건·모집·근무지역·업무내용·이미지…) — 화면에 보이는 순서대로
  const secs = [...page.querySelectorAll('section.jd2-sec')].filter(vis)
  out['sections.order'] = secs.map((s) => s.id || s.className.split(' ').find((c) => c.startsWith('jd2-sec--')) || 'sec').join(' > ')
  let prev = tabs
  for (const s of secs) {
    const key = `sec[${s.id || 'noid'}]`
    const sb = put(key, s, {})
    gap(`${key}.from-prev`, prev, sb)
    const t = s.querySelector('.jd2-sec__title, h2')
    const tb = put(`${key}.title`, t, { width: false, f: true })
    const bx = s.querySelector(':scope > .jd2-box, :scope .jd2-box')
    const bb = put(`${key}.box`, bx, {})
    // 근무지역처럼 제목과 칸 사이에 주소 줄이 있으면 주소 길이에 따라 높이가 달라지므로 간격을 둘로 나눠 잰다.
    const above = s.querySelector('.jd2-location-above-map')
    if (vis(above)) { const ab = box(above); gap(`${key}.title→address`, tb, ab); gap(`${key}.address→box`, ab, bb) }
    else gap(`${key}.title→box`, tb, bb)
    if (vis(bx)) { const st = getComputedStyle(bx); out[`${key}.box.padding`] = st.padding; out[`${key}.box.radius`] = st.borderRadius; out[`${key}.box.border`] = st.border }
    prev = sb
  }

  // 4) 근무조건 칸 안: 2열 위치, 급여 배지, 연락 버튼
  const cols = [...page.querySelectorAll('.jd2-sec--conditions-grid .jd2-two-col-card__column')].filter(vis)
  cols.forEach((c, i) => put(`conditions.col${i + 1}`, c, {}))
  const dts = [...page.querySelectorAll('.jd2-sec--conditions-grid dt')].filter(vis)
  if (dts[0]) { put('conditions.label', dts[0], { f: true }) }
  const dds = [...page.querySelectorAll('.jd2-sec--conditions-grid dd')].filter(vis)
  if (dds[0]) { const b = box(dds[0]); out['conditions.value.x'] = r1(b.x); font('conditions.value', dds[0]) }
  const badge = page.querySelector('.jd2-sec--conditions-grid .jd2-pay-badge')
  if (vis(badge)) { out['conditions.badge.h'] = r1(box(badge).h); font('conditions.badge', badge) }
  const call = page.querySelector('.jd2-conditions-with-contact .jd2-aside-contact__call')
  const zalo = page.querySelector('.jd2-conditions-with-contact .jd2-aside-contact__zalo')
  const condTitle = page.querySelector('.jd2-sec--conditions-grid .jd2-sec__title')
  for (const [n, el] of [['conditions.call', call], ['conditions.zalo', zalo]]) {
    if (!vis(el)) continue
    const b = put(n, el, { size: true })
    out[`${n}.right`] = r1(P.width - b.r)
    if (vis(condTitle)) { const t = box(condTitle); out[`${n}.mid-vs-title-mid`] = r1((b.y + b.h / 2) - (t.y + t.h / 2)) }
  }

  // 5) 길찾기 버튼
  const dir = [...page.querySelectorAll('a')].filter(vis).find((a) => /Chỉ đường|Đến cổng|Gọi hỏi đường/.test(a.textContent || ''))
  if (dir) { const b = box(dir); out['directions.h'] = r1(b.h); out['directions.kind'] = dir.className.split(' ')[0] }

  // 6) 모바일 하단 고정 버튼
  const cta = document.querySelector('.jd2-mobile-cta')
  if (vis(cta)) { const b = cta.getBoundingClientRect(); out['mobile-cta.h'] = r1(b.height); out['mobile-cta.w'] = r1(b.width) }
  return out
}

export async function measureJob(browser, id, view, { blockImages = false } = {}) {
  const v = VIEWS[view]
  const ctx = await browser.newContext({ viewport: v.viewport, isMobile: v.isMobile, hasTouch: v.hasTouch, locale: 'vi-VN' })
  const page = await ctx.newPage()
  if (blockImages) await page.route(/\/storage\/v1\/object\/|\.(png|jpe?g|webp|gif)(\?|$)/i, (r) => r.request().resourceType() === 'image' ? r.abort() : r.continue())
  await page.goto(`${BASE}/viec-lam/sb-${id}`, { waitUntil: 'networkidle', timeout: 90_000 }).catch(() => {})
  await page.waitForSelector('.jd2-page', { timeout: 30_000 }).catch(() => {})
  await page.evaluate(() => document.fonts?.ready)
  await page.waitForTimeout(2500)
  const m = await page.evaluate(measureInPage)
  await ctx.close()
  if (m.error) throw new Error(`#${id} ${view}: 공고 상세 화면이 아님 (${m.error})`)
  return m
}

export function compare(drawing, view, actual, label) {
  const spec = drawing.views[view]
  const tol = drawing.tolerancePx ?? 1
  const problems = []
  const optional = new Set(drawing.optionalAreas ?? [])
  const isOptional = (k) => [...optional].some((p) => k.startsWith(p))
  for (const [k, want] of Object.entries(spec)) {
    const got = actual[k]
    if (got === undefined) { if (!isOptional(k)) problems.push(`${label}: '${k}' 영역이 없음 (도면 ${JSON.stringify(want)})`); continue }
    if (k === 'sections.order') {
      const order = want.split(' > '); const seen = got.split(' > ')
      let i = 0; for (const s of seen) { const j = order.indexOf(s, i); if (j < 0) { problems.push(`${label}: 구역 순서/종류가 도면과 다름 (도면 ${want} / 실제 ${got})`); break } i = j + 1 }
      for (const req of drawing.requiredSections ?? []) if (!seen.includes(req)) problems.push(`${label}: 필수 구역 '${req}' 없음`)
      continue
    }
    if (typeof want === 'number') { if (Math.abs(got - want) > tol) problems.push(`${label}: '${k}' ${got} ≠ 도면 ${want} (허용 ±${tol}px)`) }
    else if (got !== want) problems.push(`${label}: '${k}' "${got}" ≠ 도면 "${want}"`)
  }
  return problems
}

if (import.meta.url === `file://${process.argv[1]}`) {
  const [mode, ...ids] = process.argv.slice(2)
  if (!['extract', 'check'].includes(mode) || !ids.length) { console.error('사용: measure.mjs extract|check <공고id...>'); process.exit(2) }
  const browser = await chromium.launch()
  const results = {}
  try {
    for (const id of ids) for (const view of Object.keys(VIEWS)) for (const blockImages of [false, true]) {
      results[`${id}-${view}${blockImages ? '-noimg' : ''}`] = await measureJob(browser, id, view, { blockImages })
    }
  } finally { await browser.close() }
  mkdirSync('layout-out', { recursive: true })
  writeFileSync('layout-out/measured.json', JSON.stringify(results, null, 2))
  if (mode === 'extract') { console.log(JSON.stringify(results, null, 2)); process.exit(0) }
  if (!existsSync(DRAWING)) { console.error(`::error::도면 없음: ${DRAWING}`); process.exit(1) }
  const drawing = JSON.parse(readFileSync(DRAWING, 'utf8'))
  const problems = []
  for (const [label, m] of Object.entries(results)) problems.push(...compare(drawing, label.split('-')[1], m, `#${label}`))
  writeFileSync('layout-out/violations.json', JSON.stringify(problems, null, 2))
  for (const p of problems) console.log(`::error::${p}`)
  if (problems.length) { console.error(`도면 불일치 ${problems.length}건`); process.exit(1) }
  console.log(`도면 일치: ${Object.keys(results).length}개 화면`)
}
