// 공고 화면 도면 측정기 (결정 0005, 2026-10-18 Lee 지시)
// 사진 비교가 아니라 "치수 측정": 화면의 각 영역 위치·폭·높이·간격·글자 크기를 숫자로 재서 도면(숫자)과 대조한다.
// 사용:
//   BASE_URL=... node docs/decisions/drawings/measure.mjs extract <공고id...|all>   → 측정값 JSON 출력
//   BASE_URL=... node docs/decisions/drawings/measure.mjs check  <공고id...|all>   → 도면과 대조, 어긋나면 실패
// all = 기준 공고(#4824) + 목록 화면에 나오는 모든 공개 공고.
// 이 파일과 도면은 Lee 승인 없이 바꿀 수 없다(CODEOWNERS: docs/decisions/).
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

  // 6) 구조(도면에 없는 영역 끼워 넣기 감지): 영역 안 직계 요소 목록
  const kids = (el) => el ? [...el.children].filter(vis).map((c) => (c.tagName.toLowerCase() + '.' + ([...c.classList].find((x) => !/--/.test(x)) || ''))).join(' | ') : undefined
  out['structure.page'] = kids(page)
  out['structure.header'] = kids(header)
  out['structure.header.info'] = kids(header?.querySelector('.jd2-header__info'))

  // 7) 모바일 하단 고정 버튼
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
  // 시험 전용 고장 주입(LAYOUT_FAULT="id:css"): 차단 장치가 실제로 잡는지 확인할 때만. 이때 비공개 전환은 하지 않는다(게이트 워크플로가 강제).
  const [faultId, ...faultCss] = String(process.env.LAYOUT_FAULT || '').split(':')
  if (faultId && faultId === String(id)) await page.addStyleTag({ content: faultCss.join(':') })
  await page.evaluate(() => document.fonts?.ready)
  await page.waitForTimeout(2500)
  const m = await page.evaluate(measureInPage)
  await ctx.close()
  if (m.error) throw new Error(`#${id} ${view}: 공고 상세 화면이 아님 (${m.error})`)
  return m
}

// 공고 카드(목록) 측정: 메인 화면에서 그 공고 카드 1장을 잰다.
function measureCardInPage(id) {
  const r1 = (n) => Math.round(n * 10) / 10
  const vis = (el) => !!el && !!(el.offsetWidth || el.offsetHeight) && getComputedStyle(el).display !== 'none'
  const card = [...document.querySelectorAll('.jc[data-job-id]')].find((c) => String(c.getAttribute('data-job-id')).replace(/\D/g, '') === String(id))
  if (!card) return { 'card.missing': true }
  const C = card.getBoundingClientRect()
  const out = { 'card.w': r1(C.width), 'card.h': r1(C.height) }
  const st = getComputedStyle(card); out['card.padding'] = st.padding; out['card.radius'] = st.borderRadius; out['card.border'] = st.border
  let prev = null
  for (const sel of ['.jc__header', '.jc__logo-wrap', '.jc__identity', '.jc__company', '.jc__meta', '.jc__title', '.jc__footer', '.jc__salary']) {
    const el = card.querySelector(sel)
    if (!vis(el)) continue
    const b = el.getBoundingClientRect(), n = `card.${sel.slice(5)}`
    out[`${n}.x`] = r1(b.left - C.left); out[`${n}.y`] = r1(b.top - C.top); out[`${n}.w`] = r1(b.width); out[`${n}.h`] = r1(b.height)
    const s = getComputedStyle(el); out[`${n}.font`] = `${s.fontSize} ${s.fontWeight}`
  }
  out['structure.card'] = [...card.children].filter(vis).map((c) => c.tagName.toLowerCase() + '.' + ([...c.classList].find((x) => !/--/.test(x)) || '')).join(' | ')
  return out
}

export async function measureCard(browser, id, view, { blockImages = false } = {}) {
  const v = VIEWS[view]
  const ctx = await browser.newContext({ viewport: v.viewport, isMobile: v.isMobile, hasTouch: v.hasTouch, locale: 'vi-VN' })
  const page = await ctx.newPage()
  if (blockImages) await page.route(/\/storage\/v1\/object\/|\.(png|jpe?g|webp|gif)(\?|$)/i, (r) => r.request().resourceType() === 'image' ? r.abort() : r.continue())
  await page.goto(`${BASE}/`, { waitUntil: 'networkidle', timeout: 90_000 }).catch(() => {})
  await page.waitForSelector('.jc[data-job-id]', { timeout: 30_000 }).catch(() => {})
  const [faultId, ...faultCss] = String(process.env.LAYOUT_FAULT || '').split(':')
  if (faultId && faultId === String(id)) await page.addStyleTag({ content: faultCss.join(':') })
  await page.evaluate(() => document.fonts?.ready)
  await page.waitForTimeout(1500)
  const m = await page.evaluate(measureCardInPage, id)
  await ctx.close()
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
  // 도면에 없는 영역(새로 끼워 넣은 구역·줄 등)은 불합격
  for (const k of Object.keys(actual)) if (!(k in spec) && !isOptional(k)) problems.push(`${label}: 도면에 없는 영역 '${k}' (${JSON.stringify(actual[k])})`)
  return problems
}

if (import.meta.url === `file://${process.argv[1]}`) {
  const [mode, ...args] = process.argv.slice(2)
  if (mode === 'selftest') {
    // 실제 사고 사례를 시험으로 고정(결정 0001 3절): 대조기가 이 어긋남을 반드시 잡아야 한다.
    const drawing = JSON.parse(readFileSync(DRAWING, 'utf8'))
    const cases = [
      ['#4828 회사명 빈값으로 급여가 4px 당겨짐(2026-10-18)', 'pc', { 'header.company→salary.gap': drawing.views.pc['header.company→salary.gap'] - 4 }],
      ['필수 구역(근무지역) 누락', 'pc', { 'sections.order': 'jd-sec-conditions > jd-sec-description' }],
      ['로고 칸 축소(이미지 없음)', 'mobile', { 'header.logo.w': 0 }],
      ['머리 영역에 도면에 없는 줄 끼워 넣기', 'pc', { 'structure.header.info': drawing.views.pc['structure.header.info'] + ' | p.new-line' }],
      ['도면에 없는 새 구역', 'mobile', { 'sec[jd-sec-new].x': 16 }],
      ['카드 이미지 칸 축소', 'card-pc', { 'card.logo-wrap.w': 0 }],
    ]
    for (const [name, view, patch] of cases) {
      const found = compare(drawing, view, { ...drawing.views[view], ...patch }, name)
      if (!found.length) { console.error(`::error::대조기 자가시험 실패 — 못 잡음: ${name}`); process.exit(1) }
      console.log(`자가시험 통과: ${name} → ${found[0]}`)
    }
    if (compare(drawing, 'pc', drawing.views.pc, '기준').length) { console.error('::error::기준 자체가 도면과 불일치'); process.exit(1) }
    process.exit(0)
  }
  let ids = args
  if (process.env.LAYOUT_IDS) ids = [...new Set(['4824', ...process.env.LAYOUT_IDS.split(/[\s,]+/).filter(Boolean)])]
  if (args.includes('all')) {
    const b = await chromium.launch(); const p = await b.newPage()
    await p.goto(`${BASE}/`, { waitUntil: 'networkidle', timeout: 90_000 }).catch(() => {})
    await p.waitForTimeout(3000)
    const found = await p.evaluate(() => [
      ...[...document.querySelectorAll('a[href*="/viec-lam/sb-"]')].map((a) => (a.getAttribute('href').match(/sb-(\d+)/) || [])[1]),
      ...[...document.querySelectorAll('.jc[data-job-id]')].map((c) => String(c.getAttribute('data-job-id')).replace(/\D/g, '')),
    ].filter(Boolean))
    await b.close()
    ids = [...new Set(['4824', ...ids.filter((x) => x !== 'all'), ...found])]
    console.log(`측정 대상 공고: ${ids.join(', ')}`)
  }
  if (!['extract', 'check', 'gate'].includes(mode) || !ids.length) { console.error('사용: measure.mjs extract|check|gate <공고id...|all>'); process.exit(2) }
  const browser = await chromium.launch()
  const results = {}
  try {
    for (const id of ids) for (const view of Object.keys(VIEWS)) for (const blockImages of [false, true]) {
      const tag = `${id}-${view}${blockImages ? '-noimg' : ''}`
      results[tag] = await measureJob(browser, id, view, { blockImages })
      results[`card:${tag}`] = await measureCard(browser, id, view, { blockImages })
    }
  } finally { await browser.close() }
  mkdirSync('layout-out', { recursive: true })
  writeFileSync('layout-out/measured.json', JSON.stringify(results, null, 2))
  if (mode === 'extract') { console.log(JSON.stringify(results, null, 2)); process.exit(0) }
  if (!existsSync(DRAWING)) { console.error(`::error::도면 없음: ${DRAWING}`); process.exit(1) }
  const drawing = JSON.parse(readFileSync(DRAWING, 'utf8'))
  const problems = []
  const byJob = {}
  for (const [label, m] of Object.entries(results)) {
    const isCard = label.startsWith('card:')
    const tag = isCard ? label.slice(5) : label
    const [id, view] = tag.split('-')
    const found = compare(drawing, isCard ? `card-${view}` : view, m, `#${isCard ? '카드 ' : ''}${tag}`)
    if (found.length) (byJob[id] ??= []).push(...found)
    problems.push(...found)
  }
  writeFileSync('layout-out/violations.json', JSON.stringify(problems, null, 2))
  if (mode === 'gate') {
    // 기준 공고(#4824)가 어긋나면 공고 문제가 아니라 화면 코드·운영 문제 → 공고를 숨기지 않고 경고만(사이트 전체가 비는 사고 방지).
    const ref = String(drawing.reference.jobId)
    const out = { baseOk: !byJob[ref], failing: Object.entries(byJob).filter(([id]) => id !== ref).map(([id, p]) => ({ id: Number(id), problems: p })) }
    writeFileSync('layout-out/gate.json', JSON.stringify(out, null, 2))
    for (const p of problems) console.log(`::warning::${p}`)
    console.log(JSON.stringify(out, null, 2))
    process.exit(0)
  }
  for (const p of problems) console.log(`::error::${p}`)
  if (problems.length) { console.error(`도면 불일치 ${problems.length}건`); process.exit(1) }
  console.log(`도면 일치: ${Object.keys(results).length}개 화면`)
}
