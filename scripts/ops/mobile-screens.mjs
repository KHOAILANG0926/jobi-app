// 모바일 화면 자동 캡처(Lee 2026-11-11 "내가 일일이 캡처해서 보내줘?"): 작업 세션은 데이터 서버·검사 결과 그림 저장소에 닿지 못해
// 모바일 화면을 직접 볼 수 없었다. GitHub에서 실제 핸드폰 크기로 운영 화면을 찍어 저장소 'screens' 브랜치에 올리면 작업자가 git으로 받아 본다.
// 사용: BASE_URL=https://viecganban.vn OUT=screens node scripts/ops/mobile-screens.mjs
// 키는 쓰지 않는다: 공개 공고 번호는 사이트 번들의 공개 값(src/lib/supabase.ts)으로 공개 조회만 한다(app-smoke.mjs와 같은 방식).
import { chromium, devices } from 'playwright'
import { readFileSync, writeFileSync, mkdirSync } from 'node:fs'

const BASE_URL = (process.env.BASE_URL || '').replace(/\/$/, '')
const OUT = process.env.OUT || 'screens'
if (!BASE_URL) { console.error('BASE_URL 필요'); process.exit(2) }
const src = readFileSync(new URL('../../src/lib/supabase.ts', import.meta.url), 'utf8')
const SUPABASE_URL = src.match(/https:\/\/[a-z0-9]+\.supabase\.co/)?.[0]
const ANON = src.match(/eyJ[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+/)?.[0]

async function latestJobs(n) {
  if (!SUPABASE_URL || !ANON) return []
  try {
    const res = await fetch(`${SUPABASE_URL}/rest/v1/local_jobs?select=id&active=eq.true&admin_hidden=eq.false&order=id.desc&limit=${n}`,
      { headers: { apikey: ANON, Authorization: `Bearer ${ANON}` } })
    return res.ok ? (await res.json()).map((j) => j.id) : []
  } catch { return [] } // 조회 실패해도 나머지 화면은 찍는다
}

const PAGES = [
  ['home', '/'], ['search', '/viec-lam/tim-kiem'], ['area', '/viec-lam/khu-vuc'], ['map', '/ban-do'],
  ['korea', '/viec-han-quoc'], ['post', '/dang-tin'], ['saved', '/viec-lam/da-luu'],
  ['detail-kda', '/viec-lam/sb-4824'], ...(await latestJobs(4)).map((id) => [`detail-${id}`, `/viec-lam/sb-${id}`]),
]
const DEVICES = [['iphone', devices['iPhone 13']], ['galaxy', devices['Galaxy S8']]]

mkdirSync(OUT, { recursive: true })
const report = []
const browser = await chromium.launch(process.env.HTTPS_PROXY ? { proxy: { server: process.env.HTTPS_PROXY } } : {})
for (const [dname, dev] of DEVICES) {
  const context = await browser.newContext({ ...dev, locale: 'vi-VN' })
  for (const [name, path] of PAGES) {
    const page = await context.newPage()
    const errors = []
    page.on('pageerror', (e) => errors.push(String(e.message).slice(0, 160)))
    try {
      await page.goto(BASE_URL + path, { waitUntil: 'networkidle', timeout: 60_000 }).catch(() => {})
      await page.waitForTimeout(3000)
      // 아래까지 한 번 내려 지연 표시(지도·목록)를 깨운 뒤 맨 위로
      for (let i = 0; i < 6; i++) { await page.mouse.wheel(0, 800); await page.waitForTimeout(400) }
      await page.evaluate(() => window.scrollTo(0, 0)); await page.waitForTimeout(800)
      // 화면 폭보다 넓은 요소(가로로 삐져나감) — 모바일 깨짐의 가장 흔한 원인
      const m = await page.evaluate(() => {
        const vw = document.documentElement.clientWidth
        // 가로 스크롤 칸(메뉴 탭 줄 등)·잘라 보이는 칸 안의 요소는 일부러 넘친 것이라 뺀다
        const clipped = (e) => { for (let a = e.parentElement; a && a !== document.body; a = a.parentElement) { if (getComputedStyle(a).overflowX !== 'visible') return true } return false }
        const wide = [...document.querySelectorAll('body *')].filter((e) => { const r = e.getBoundingClientRect(); return r.width > 0 && (r.right > vw + 1 || r.left < -1) && getComputedStyle(e).position !== 'fixed' && !clipped(e) })
          .slice(0, 8).map((e) => `${e.tagName.toLowerCase()}${e.className && typeof e.className === 'string' ? '.' + e.className.trim().split(/\s+/).slice(0, 2).join('.') : ''} ${Math.round(e.getBoundingClientRect().right)}px`)
        const small = [...document.querySelectorAll('body *')].filter((e) => e.childNodes.length && [...e.childNodes].some((n) => n.nodeType === 3 && n.textContent.trim()) && parseFloat(getComputedStyle(e).fontSize) < 11 && e.getBoundingClientRect().width > 0).length
        return { vw, scrollW: document.documentElement.scrollWidth, height: document.documentElement.scrollHeight, wide, smallText: small }
      })
      await page.screenshot({ path: `${OUT}/${dname}-${name}-top.jpg`, type: 'jpeg', quality: 70 })
      await page.screenshot({ path: `${OUT}/${dname}-${name}-full.jpg`, type: 'jpeg', quality: 60, fullPage: true })
      report.push({ device: dname, name, path, ...m, errors })
    } catch (e) {
      report.push({ device: dname, name, path, failed: String(e.message).slice(0, 200), errors })
    }
    await page.close()
  }
  await context.close()
}
await browser.close()
writeFileSync(`${OUT}/report.json`, JSON.stringify(report, null, 2))
const lines = report.map((r) => `- ${r.device} ${r.name} (${r.path}): ${r.failed ? '실패 ' + r.failed : `폭 ${r.vw}/${r.scrollW}${r.scrollW > r.vw ? ' 가로 넘침' : ''}, 높이 ${r.height}, 11px 미만 글자 ${r.smallText}곳${r.wide.length ? ', 넘친 요소 ' + r.wide.join(' · ') : ''}${r.errors.length ? ', 오류 ' + r.errors.join(' / ') : ''}`}`)
writeFileSync(`${OUT}/README.md`, `# 모바일 화면 캡처 (${new Date().toISOString()})\n\n${lines.join('\n')}\n`)
console.log(lines.join('\n'))
