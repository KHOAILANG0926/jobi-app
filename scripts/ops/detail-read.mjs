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
import { collectScreen, collectCards, waitForMap, SCREEN_CANDIDATES } from './screen-collect.mjs'

const { SUPABASE_DB_URL, ADMIN_E2E_EMAIL, ADMIN_E2E_PASSWORD, GH_TOKEN, REPO, ISSUE } = process.env
const BASE_URL = (process.env.BASE_URL || 'https://viecganban.vn').replace(/\/$/, '')
const ALL = process.env.ALL_PUBLIC === '1'
// 공개 판정 연결(#646): 화면 대조 대상(SCREEN_CANDIDATES)을 관리자 비공개 상세로 대조하고 결과를 ocr_check.screen_audit에 기록한다(job-ocr-check.yml).
const CANDIDATES = process.env.SCREEN_CANDIDATES === '1'
let ids = String(process.env.JOB_IDS || '').split(/[\s,]+/).map((s) => s.replace(/^sb-/, '')).filter((s) => /^\d+$/.test(s)).map(Number)
if (!ids.length && !ALL && !CANDIDATES) { console.error('JOB_IDS 필요(예: "5506 5507") 또는 ALL_PUBLIC=1'); process.exit(2) }
if ((ALL || CANDIDATES) && !SUPABASE_DB_URL) { console.error('ALL_PUBLIC=1·SCREEN_CANDIDATES=1은 SUPABASE_DB_URL 필요'); process.exit(2) }

const OUT = 'detail-read'
mkdirSync(OUT, { recursive: true })
const VIEWPORTS = [
  { name: 'pc', label: 'PC', viewport: { width: 1366, height: 900 } },
  { name: 'mobile', label: '모바일', viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true },
]
const keepText = !ALL && !CANDIDATES

// 대조용 DB 값(읽기만)
const dbJobs = new Map()
let coverage = null
let db
if (SUPABASE_DB_URL) {
  const { default: pg } = await import('pg')
  db = new pg.Client({ connectionString: SUPABASE_DB_URL })
  await db.connect()
  try {
    const rows = (await db.query(`
      select j.id, j.title, j.company, j.origin, j.occupation_code, j.source_text, j.ocr_text, j.employer_phone, j.contact_zalo, j.active, j.admin_hidden,
        public.job_inspect_content_hash(j) as content_hash,
        coalesce((select jsonb_agg(jsonb_build_object('kind', w.point_kind, 'verified', w.location_verified, 'lat', w.lat, 'lng', w.lng,
          'source', w.point_evidence->>'source', 'raw', w.raw_address, 'park', w.industrial_park)) from public.job_work_locations w where w.job_id = j.id), '[]') as locs
      from public.local_jobs j where ${CANDIDATES ? SCREEN_CANDIDATES : ALL ? 'j.active and not j.admin_hidden' : 'j.id = any($1::bigint[])'} order by j.id`, ALL || CANDIDATES ? [] : [ids])).rows
    for (const r of rows) dbJobs.set(Number(r.id), r)
    // 화면 대조가 닿는 범위(R2 잔여 검증): 전체 등록 공고를 출처·공개 상태별로 센다(읽기 전용 집계). 비공개·숨김은 이 대조 대상이 아니다.
    if (ALL) coverage = (await db.query(`select origin, count(*) filter (where active and not admin_hidden) as public, count(*) filter (where not active) as inactive,
        count(*) filter (where admin_hidden) as hidden from public.local_jobs group by origin order by origin`)).rows
  } finally { if (!CANDIDATES) await db.end() }
  if (ALL || CANDIDATES) ids = [...dbJobs.keys()]
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
    if (!r.ok) throw new Error(`HTTP ${r.status}`)
    const data = await r.json()
    // 읽기에 성공하면 공개 공고는 응답에 없어도 "핀 0개"로 대조한다(상세에 핀이 있으면 불일치)
    for (const id of ids.slice(i, i + 100)) if (dbJobs.get(id)?.active && !dbJobs.get(id)?.admin_hidden) apiPins[id] = []
    for (const [k, pts] of Object.entries(data.points ?? {})) apiPins[Number(k.replace('sb-', ''))] = pts.map((p) => `${p.lat},${p.lng}`)
  } catch (e) { console.log(`::warning::지도 목록 핀 읽기 실패: ${e.message}`) }
}

const browser = await chromium.launch()
// 목록·메인 카드(전체 대조 때만): 기기마다 한 번 모은다 — 상세 화면과 같은 공고의 카드 값을 대조하려고
const cardsByDevice = {}
if (ALL) for (const v of VIEWPORTS) {
  const context = await browser.newContext({ viewport: v.viewport, isMobile: v.isMobile, hasTouch: v.hasTouch, locale: 'vi-VN' })
  cardsByDevice[v.label] = await collectCards(await context.newPage(), BASE_URL)
  await context.close()
  console.log(`${v.label} 카드 화면별 ${cardsByDevice[v.label].map((r) => (r ? Object.keys(r).length : '읽기 실패')).join(' / ')}개 수집`)
}
let adminState = null
async function adminLogin() {
  if (adminState) return adminState
  if (!ADMIN_E2E_EMAIL || !ADMIN_E2E_PASSWORD) throw new Error('비공개 공고는 관리자 로그인 필요(ADMIN_E2E_EMAIL·ADMIN_E2E_PASSWORD)')
  // 화면 로그인 대신 앱과 같은 Supabase 클라이언트로 로그인해 그 세션을 브라우저 저장소(앱이 읽는 열쇠 이름)에 넣는다.
  // 2026-11-11 sb-5938: 화면 로그인 뒤 상세에 로그인 흔적이 없어(진단 실행) 관리자 미리 보기가 안 떴다. 같은 방식은 admin-location-confirm.mjs가 이미 씀.
  const { supabase } = await import('../../src/lib/supabase.ts')
  const { data, error } = await supabase.auth.signInWithPassword({ email: ADMIN_E2E_EMAIL, password: ADMIN_E2E_PASSWORD })
  if (error || !data?.session) throw new Error('관리자 로그인 실패: ' + (error?.message ?? '세션 없음'))
  const key = `sb-${new URL(supabase.supabaseUrl).hostname.split('.')[0]}-auth-token`
  adminState = { cookies: [], origins: [{ origin: BASE_URL, localStorage: [{ name: key, value: JSON.stringify(data.session) }] }] }
  return adminState
}

let failed = 0
let openFailed = 0 // 대상 공고 모드: 화면을 못 연 공고 수
const summary = [`## 상세 화면 읽기 (${BASE_URL})`, '']
const audits = []
async function readJob(id) {
  const job = dbJobs.get(id)
  const views = []
  let openError
  for (const v of VIEWPORTS) {
    const context = await browser.newContext({ viewport: v.viewport, isMobile: v.isMobile, hasTouch: v.hasTouch, locale: 'vi-VN',
      ...(job && (!job.active || job.admin_hidden) ? { storageState: await adminLogin().catch((e) => { openError = e.message; return undefined }) } : {}) })
    const page = await context.newPage()
    const errors = []
    page.on('pageerror', (e) => errors.push(String(e.message || e)))
    const url = `${BASE_URL}/viec-lam/sb-${id}`
    let text = ''
    let status = 0
    try {
      const res = await page.goto(url, { waitUntil: keepText ? 'networkidle' : 'domcontentloaded', timeout: 60_000 })
      status = res?.status() ?? 0
      // 공고 제목 머리(h1.jd2-header__title)를 기다린다. 비공개 공고는 관리자 미리 보기를 불러오는 동안 잠깐 'Không tìm thấy' h1이 떠서,
      // 아무 h1이나 기다리면 그 화면을 대조해 '제목 다름' 확정 오류가 났다(sb-5931, 2026-11-10). 끝내 안 뜨면 열기 실패.
      await page.locator('h1.jd2-header__title').first().waitFor({ timeout: 30_000 })
      // 지연 로딩 영역까지 보이도록 끝까지 내렸다가 위로
      await page.evaluate(async () => { for (let y = 0; y < document.body.scrollHeight; y += 600) { window.scrollTo(0, y); await new Promise((r) => setTimeout(r, 150)) } window.scrollTo(0, 0) })
      await page.waitForTimeout(800)
      const mapReady = await waitForMap(page, (apiPins[id]?.length ?? 0) > 0)
      views.push({ ...(await collectScreen(page, v.label)), pinsUnread: !mapReady })
      if (keepText) {
        text = (await page.locator('main').first().innerText().catch(() => '')) || (await page.locator('body').innerText())
        await page.screenshot({ path: `${OUT}/${id}-${v.name}.png`, fullPage: true })
      }
    } catch (e) {
      failed++
      // 왜 못 열었는지 화면 상태를 같이 남긴다(sb-5938 2026-11-11: 관리자 로그인 뒤에도 제목이 안 뜸) — 보이는 h1·주소·로그인 흔적
      const seen = await page.evaluate(() => ({
        h1: document.querySelector('h1')?.textContent?.trim()?.slice(0, 60) ?? '(h1 없음)',
        path: location.pathname,
        auth: Object.keys(localStorage).some((k) => /^sb-.*-auth-token$/.test(k)),
      })).catch(() => null)
      openError = (openError ? openError + ' / ' : '') + String(e.message || e).split('\n')[0] + (seen ? ` — 화면 h1 "${seen.h1}", 주소 ${seen.path}, 로그인 흔적 ${seen.auth ? '있음' : '없음'}` : '')
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
    : screenAudit({ ...job, id, googlePin: googlePinOf(job.locs), apiPins: apiPins[id] ?? null, ...(ALL ? { cards: Object.fromEntries(VIEWPORTS.map((v) => [v.label, (cardsByDevice[v.label] ?? [null]).map((r) => r?.[String(id)] ?? null)])) } : {}) }, views)
  audits.push({ id, title: job.title, active: job.active, findings, views })
  // 기록(대상 공고만): 화면 열기 실패는 기록하지 않는다(일시 오류 — 다음 실행에 다시). 대조 중 내용이 바뀌면 기록하지 않는다.
  if (CANDIDATES && openError) openFailed++
  if (CANDIDATES && !openError) {
    const rec = { content_hash: job.content_hash, ok: !findings.some((f) => f.sure), checked_at: new Date().toISOString(), base_url: BASE_URL,
      findings: findings.map(({ key, sure, device, detail }) => ({ key, sure, device, detail })) }
    const w = await db.query(`update public.local_jobs set ocr_check = coalesce(ocr_check, '{}'::jsonb) || jsonb_build_object('screen_audit', $2::jsonb)
      where id = $1 and public.job_inspect_content_hash(local_jobs) = $3`, [id, JSON.stringify(rec), job.content_hash])
    if (w.rowCount !== 1) console.log(`sb-${id} 대조 중 공고 내용 변경: 다음 실행에서 다시`)
  }
  const sure = findings.filter((f) => f.sure).length
  console.log(`화면 대조 sb-${id}: ${sure ? `확정 오류 ${sure}` : '확정 오류 없음'}${findings.length - sure ? ` · 불명확 ${findings.length - sure}` : ''}`)
}
const queue = [...ids]
// 글·사진을 남길 때는 로그 순서를 지키려고 하나씩, 전체 대조는 3개씩
await Promise.all(Array.from({ length: keepText ? 1 : 3 }, async () => { for (let id; (id = queue.shift()) !== undefined;) await readJob(id) }))
await browser.close()
if (CANDIDATES) await db.end()

let sureCount = 0
if (dbJobs.size) {
  audits.sort((a, b) => a.id - b.id)
  writeFileSync(`${OUT}/screen-audit.json`, JSON.stringify(audits, null, 1))
  const sureJobs = audits.filter((r) => r.findings.some((f) => f.sure))
  const unsureJobs = audits.filter((r) => r.findings.some((f) => !f.sure))
  sureCount = sureJobs.length
  const line = (r, sure) => `- sb-${r.id} ${String(r.title ?? '').slice(0, 45)}${r.active ? '' : ' (비공개)'}\n` +
    r.findings.filter((f) => f.sure === sure).map((f) => `  - [${f.device}] ${f.detail}`).join('\n')
  // 미검증 = 화면을 못 열었거나 4영역을 못 읽어 배치를 대조하지 못한 공고 — 통과로 세지 않는다
  const unverified = audits.filter((r) => r.findings.some((f) => f.key === 'open' || f.key === 'areas' || f.key === 'pin_unread' || f.key === 'card_unread'))
  const originNote = coverage ? ['', '### 대조가 닿는 범위(출처별 등록 공고)', ...coverage.map((c) => `- ${c.origin}: 공개 ${c.public}(이번 대조 ${audits.filter((a) => dbJobs.get(a.id)?.origin === c.origin).length}) · 비공개 ${c.inactive} · 숨김 ${c.hidden} — 비공개·숨김은 화면 대조 대상 아님`)] : []
  const report = [`## 화면 대조 검사 — ${audits.length}건 (${BASE_URL})`, '',
    `확정 오류 ${sureJobs.length}건 · 판정 불명확(관리자 확인) ${unsureJobs.length}건 · 미검증 ${unverified.length}건 · 문제 없음 ${audits.filter((r) => !r.findings.length).length}건`, '',
    ...(sureJobs.length ? ['### 확정 오류', ...sureJobs.map((r) => line(r, true)), ''] : []),
    ...(unsureJobs.length ? ['### 판정 불명확', ...unsureJobs.map((r) => line(r, false))] : []), ...originNote].join('\n')
  console.log('\n' + report)
  summary.unshift(report, '')
  if (GH_TOKEN && REPO && ISSUE && !CANDIDATES) {
    // 매일 실행(공개 공고 전체)은 결과가 지난번과 같으면 댓글을 남기지 않는다 — 공고 번호·찾은 문제가 같으면 같은 결과.
    const marker = '<!-- screen-audit-digest'
    const { createHash } = await import('node:crypto')
    const digest = createHash('md5').update(JSON.stringify(audits.map((r) => [r.id, r.findings.map((f) => f.key + f.sure + f.device + f.detail)]))).digest('hex').slice(0, 12)
    let last = ''
    if (ALL) try { last = execFileSync('gh', ['api', `repos/${REPO}/issues/${ISSUE}/comments?per_page=100`, '--paginate', '--jq', `.[] | select(.body | contains("${marker}")) | .body`], { encoding: 'utf8', maxBuffer: 32 * 1024 * 1024 }).split(marker).at(-1) ?? '' } catch { last = '' }
    if (ALL && last.includes(digest)) console.log('지난 화면 대조와 결과 같음 — 댓글 생략')
    else {
      const body = (report.length > 60000 ? report.slice(0, 60000) + '\n\n(길어서 잘림 — 실행 첨부 detail-read/screen-audit.json)' : report) + (ALL ? `\n\n${marker} ${digest} -->` : '')
      execFileSync('gh', ['issue', 'comment', ISSUE, '--repo', REPO, '--body', body], { stdio: 'inherit' })
    }
  }
}
if (process.env.GITHUB_STEP_SUMMARY) appendFileSync(process.env.GITHUB_STEP_SUMMARY, summary.join('\n').slice(0, 900_000) + '\n')
// 대상 공고 모드: 확정 오류는 검사표(job-inspect)가 공개 판정·알림으로 이어 받으므로 종료 코드로 멈추지 않는다.
// 단 화면 열기 실패(관리자 로그인·상세 로딩)는 기록이 없어 알림이 안 가므로 모든 공고를 처리한 뒤 실패로 끝내 '공고 처리 멈춤' 알림(failure())이 가게 한다.
// 뒤 단계(검사표 다시)는 !cancelled()라 실패 뒤에도 돈다.
if (CANDIDATES && openFailed) console.log(`::error::공개 후보 ${openFailed}건 화면 열기 실패 — 로그인·상세 로딩 확인 필요`)
process.exit(CANDIDATES ? (openFailed ? 1 : 0) : failed || sureCount ? 1 : 0)
