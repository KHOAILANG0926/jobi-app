// 운영 공고 상세 화면 읽기 + 화면 대조 검사.
// - 읽기(Lee 2026-11-06 "캡처할 거면 왜 너랑 일해" — 등록 후 상세 화면은 작업자가 직접 읽는다): 번호를 주면
//   PC(1366×900)·모바일(390×844)로 /viec-lam/sb-<번호>를 실제 브라우저로 열어 화면 글 전체(detail-read/<번호>-<기기>.txt)와
//   전체 화면 사진(.png)을 남기고, 글을 실행 로그·Summary에 찍는다.
// - 화면 대조(#646, Lee 2026-11-10, 계획 docs/plans/2026-11-10-screen-audit.md): 같은 순회에서 보이는 제목·회사 줄·Google 버튼·
//   지도 핀·전화·Zalo·복리후생 아이콘·급여를 모아 원문·DB와 대조한다(판정 src/lib/screenAudit.ts). SUPABASE_DB_URL이 있을 때만.
//   ALL_PUBLIC=1이면 공개 공고 전체(글·사진은 남기지 않고 대조만). 비공개 공고는 관리자 로그인(ADMIN_E2E_*)으로 관리자 비공개 상세를 연다.
// 읽기만 하고 아무것도 바꾸지 않는다. 대조 결과: detail-read/screen-audit.json, 확정 오류가 있으면 종료 코드 1.
// 사용: BASE_URL=https://viecganban.vn JOB_IDS="5506 5507" [SUPABASE_DB_URL=…] node --experimental-strip-types --import ./scripts/ts-extensionless-register.mjs scripts/ops/detail-read.mjs
import { chromium } from 'playwright'
import { appendFileSync, mkdirSync, writeFileSync } from 'node:fs'
import { execFileSync } from 'node:child_process'
import { screenAudit } from '../../src/lib/screenAudit.ts'
import { preciseStreetAddressQuery } from '../../src/lib/directionsPlan.ts'

const { SUPABASE_DB_URL, ADMIN_E2E_EMAIL, ADMIN_E2E_PASSWORD, GH_TOKEN, REPO, ISSUE } = process.env
const BASE_URL = (process.env.BASE_URL || 'https://viecganban.vn').replace(/\/$/, '')
const ALL = process.env.ALL_PUBLIC === '1'
let ids = String(process.env.JOB_IDS || '').split(/[\s,]+/).map((s) => s.replace(/^sb-/, '')).filter((s) => /^\d+$/.test(s)).map(Number)
if (!ids.length && !ALL) { console.error('JOB_IDS 필요(예: "5506 5507") 또는 ALL_PUBLIC=1'); process.exit(2) }
if (ALL && !SUPABASE_DB_URL) { console.error('ALL_PUBLIC=1은 SUPABASE_DB_URL 필요'); process.exit(2) }

const OUT = 'detail-read'
mkdirSync(OUT, { recursive: true })
const VIEWPORTS = [
  { name: 'pc', label: 'PC', viewport: { width: 1366, height: 900 } },
  { name: 'mobile', label: '모바일', viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true },
]
const keepText = !ALL

// 대조용 DB 값(읽기만)
const dbJobs = new Map()
if (SUPABASE_DB_URL) {
  const { default: pg } = await import('pg')
  const db = new pg.Client({ connectionString: SUPABASE_DB_URL })
  await db.connect()
  try {
    const rows = (await db.query(`
      select j.id, j.title, j.company, j.source_text, j.ocr_text, j.employer_phone, j.contact_zalo, j.active,
        coalesce((select jsonb_agg(jsonb_build_object('kind', w.point_kind, 'verified', w.location_verified, 'lat', w.lat, 'lng', w.lng,
          'source', w.point_evidence->>'source', 'raw', w.raw_address, 'park', w.industrial_park)) from public.job_work_locations w where w.job_id = j.id), '[]') as locs
      from public.local_jobs j where ${ALL ? 'j.active and not j.admin_hidden' : 'j.id = any($1::bigint[])'} order by j.id`, ALL ? [] : [ids])).rows
    for (const r of rows) dbJobs.set(Number(r.id), r)
  } finally { await db.end() }
  if (ALL) ids = [...dbJobs.keys()]
}
console.log(`대상 ${ids.length}건`)

// 상세 Google 버튼이 지도 핀 좌표로 가야 하는 경우(src/lib/directionsPlan.ts planJobDirections와 같은 조건)
const googlePinOf = (locs) => {
  if (locs.length !== 1 || locs.some((l) => l.kind === 'gate' || (l.kind === 'exact' && l.verified))) return null
  const l = locs[0]
  return l.kind === 'area' && l.source === 'Google' && typeof l.lat === 'number' && typeof l.lng === 'number' && !preciseStreetAddressQuery(l.raw, l.park) ? { lat: l.lat, lng: l.lng } : null
}
// 지도 목록 핀(/api/map-locations, 100건씩 — 공개 공고만 돌려줌)
const apiPins = {}
if (dbJobs.size) for (let i = 0; i < ids.length; i += 100) {
  try {
    const r = await fetch(`${BASE_URL}/api/map-locations?ids=${ids.slice(i, i + 100).join(',')}`, { signal: AbortSignal.timeout(20_000) })
    const data = r.ok ? await r.json() : {}
    for (const [k, pts] of Object.entries(data.points ?? {})) apiPins[Number(k.replace('sb-', ''))] = pts.map((p) => `${p.lat},${p.lng}`)
  } catch (e) { console.log(`::warning::지도 목록 핀 읽기 실패: ${e.message}`) }
}

const browser = await chromium.launch()
let adminState = null
async function adminLogin() {
  if (adminState) return adminState
  if (!ADMIN_E2E_EMAIL || !ADMIN_E2E_PASSWORD) throw new Error('비공개 공고는 관리자 로그인 필요(ADMIN_E2E_EMAIL·ADMIN_E2E_PASSWORD)')
  const ctx = await browser.newContext()
  const page = await ctx.newPage()
  await page.goto(BASE_URL + '/dang-nhap?redirect=/admin', { waitUntil: 'domcontentloaded' })
  await page.locator('input[type="email"]').fill(ADMIN_E2E_EMAIL)
  await page.locator('input[type="password"]').fill(ADMIN_E2E_PASSWORD)
  await page.locator('button[type="submit"]').click()
  await page.waitForURL(/\/admin(?:[?#]|$)/, { timeout: 30_000 })
  adminState = await ctx.storageState()
  await ctx.close()
  return adminState
}

let failed = 0
const summary = [`## 상세 화면 읽기 (${BASE_URL})`, '']
const audits = []
async function readJob(id) {
  const job = dbJobs.get(id)
  const views = []
  let openError
  for (const v of VIEWPORTS) {
    const context = await browser.newContext({ viewport: v.viewport, isMobile: v.isMobile, hasTouch: v.hasTouch, locale: 'vi-VN',
      ...(job && !job.active ? { storageState: await adminLogin().catch((e) => { openError = e.message; return undefined }) } : {}) })
    const page = await context.newPage()
    const errors = []
    page.on('pageerror', (e) => errors.push(String(e.message || e)))
    const url = `${BASE_URL}/viec-lam/sb-${id}`
    let text = ''
    let status = 0
    try {
      const res = await page.goto(url, { waitUntil: keepText ? 'networkidle' : 'domcontentloaded', timeout: 60_000 })
      status = res?.status() ?? 0
      await page.getByRole('heading', { level: 1 }).first().waitFor({ timeout: 30_000 })
      // 지연 로딩 영역까지 보이도록 끝까지 내렸다가 위로
      await page.evaluate(async () => { for (let y = 0; y < document.body.scrollHeight; y += 600) { window.scrollTo(0, y); await new Promise((r) => setTimeout(r, 150)) } window.scrollTo(0, 0) })
      await page.waitForTimeout(800)
      views.push(await page.evaluate((device) => {
        const txt = (s) => document.querySelector(s)?.textContent?.trim() ?? null
        const hrefs = (s) => [...document.querySelectorAll(s)].map((a) => a.getAttribute('href') ?? '')
        return {
          device, title: txt('h1.jd2-header__title') ?? txt('h1') ?? '', company: txt('.jd2-header__company'), salary: txt('.jd2-hl-salary__val'),
          mapLinks: [...new Set(hrefs('a[href*="google.com/maps"]'))],
          pins: [...new Set([...document.querySelectorAll('[data-map-pins]')].flatMap((e) => (e.getAttribute('data-map-pins') ?? '').split(';')).filter(Boolean))],
          tel: [...new Set(hrefs('a[href^="tel:"]').map((h) => h.slice(4)))],
          zalo: [...new Set(hrefs('a[href*="zalo.me"]').map((h) => (/zalo\.me\/(\+?\d+)/.exec(h) ?? [])[1]).filter(Boolean))],
          benefits: [...document.querySelectorAll('.jd2-benefit--active[data-benefit-key]')].map((e) => e.getAttribute('data-benefit-key')),
        }
      }, v.label))
      if (keepText) {
        text = (await page.locator('main').first().innerText().catch(() => '')) || (await page.locator('body').innerText())
        await page.screenshot({ path: `${OUT}/${id}-${v.name}.png`, fullPage: true })
      }
    } catch (e) {
      failed++
      openError = String(e.message || e).split('\n')[0]
      text = `열기 실패: ${openError}`
    }
    if (keepText) {
      if (errors.length) text += `\n\n[페이지 오류] ${errors.slice(0, 3).join(' | ').slice(0, 300)}`
      writeFileSync(`${OUT}/${id}-${v.name}.txt`, `${url} (${v.label}, HTTP ${status})\n\n${text}\n`)
      console.log(`\n===== sb-${id} ${v.label} (HTTP ${status}) ${url} =====\n${text}\n===== 끝 sb-${id} ${v.label} =====`)
      summary.push(`### sb-${id} ${v.label} — ${url}`, '', '```', text.slice(0, 6000), '```', '')
    }
    await context.close()
  }
  if (!job) return
  const findings = openError ? [{ key: 'open', sure: true, device: '-', detail: `화면 열기 실패: ${openError}` }]
    : screenAudit({ ...job, id, googlePin: googlePinOf(job.locs), apiPins: apiPins[id] ?? null }, views)
  audits.push({ id, title: job.title, active: job.active, findings, views })
  const sure = findings.filter((f) => f.sure).length
  console.log(`화면 대조 sb-${id}: ${sure ? `확정 오류 ${sure}` : '확정 오류 없음'}${findings.length - sure ? ` · 불명확 ${findings.length - sure}` : ''}`)
}
const queue = [...ids]
// 글·사진을 남길 때는 로그 순서를 지키려고 하나씩, 전체 대조는 3개씩
await Promise.all(Array.from({ length: keepText ? 1 : 3 }, async () => { for (let id; (id = queue.shift()) !== undefined;) await readJob(id) }))
await browser.close()

let sureCount = 0
if (dbJobs.size) {
  audits.sort((a, b) => a.id - b.id)
  writeFileSync(`${OUT}/screen-audit.json`, JSON.stringify(audits, null, 1))
  const sureJobs = audits.filter((r) => r.findings.some((f) => f.sure))
  const unsureJobs = audits.filter((r) => r.findings.some((f) => !f.sure))
  sureCount = sureJobs.length
  const line = (r, sure) => `- sb-${r.id} ${String(r.title ?? '').slice(0, 45)}${r.active ? '' : ' (비공개)'}\n` +
    r.findings.filter((f) => f.sure === sure).map((f) => `  - [${f.device}] ${f.detail}`).join('\n')
  const report = [`## 화면 대조 검사 — ${audits.length}건 (${BASE_URL})`, '',
    `확정 오류 ${sureJobs.length}건 · 판정 불명확(관리자 확인) ${unsureJobs.length}건 · 문제 없음 ${audits.filter((r) => !r.findings.length).length}건`, '',
    ...(sureJobs.length ? ['### 확정 오류', ...sureJobs.map((r) => line(r, true)), ''] : []),
    ...(unsureJobs.length ? ['### 판정 불명확', ...unsureJobs.map((r) => line(r, false))] : [])].join('\n')
  console.log('\n' + report)
  summary.unshift(report, '')
  if (GH_TOKEN && REPO && ISSUE) {
    const body = report.length > 60000 ? report.slice(0, 60000) + '\n\n(길어서 잘림 — 실행 첨부 detail-read/screen-audit.json)' : report
    execFileSync('gh', ['issue', 'comment', ISSUE, '--repo', REPO, '--body', body], { stdio: 'inherit' })
  }
}
if (process.env.GITHUB_STEP_SUMMARY) appendFileSync(process.env.GITHUB_STEP_SUMMARY, summary.join('\n').slice(0, 900_000) + '\n')
process.exit(failed || sureCount ? 1 : 0)
