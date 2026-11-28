// 고용주·구직자 실제 로그인 시험(운영 화면, 일회용 시험 계정). 계정은 기존 Supabase 관리자 계정 생성 경로(auth.admin.createUser,
// scripts/e2e-p0-foundation.mjs와 같은 방식)로 이 실행 안에서만 만들고 끝에 지운다 — 대표가 가입하거나 비밀번호를 저장할 필요가 없다.
// 비밀값은 GitHub ops-keys 환경(SUPABASE_URL·SUPABASE_SERVICE_ROLE_KEY·SUPABASE_DB_URL)만 쓴다. 공고를 공개하지 않는다(신규 공개 금지 유지).
import pg from 'pg'
import { chromium } from 'playwright'
import { createClient } from '@supabase/supabase-js'
import { randomUUID } from 'node:crypto'

const { SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, SUPABASE_DB_URL } = process.env
if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY || !SUPABASE_DB_URL) {
  console.log('FAILED: 비밀값 없음 (SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY / SUPABASE_DB_URL)')
  process.exit(1)
}
const base = process.env.E2E_BASE_URL || 'https://www.viecganban.vn'
const admin = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, { auth: { autoRefreshToken: false, persistSession: false } })
const db = new pg.Client({ connectionString: SUPABASE_DB_URL, connectionTimeoutMillis: 15000 })
const SWEEP_ONLY = process.argv.includes('--sweep')
const marker = randomUUID().replace(/-/g, '').slice(0, 10)
const password = `${randomUUID()}aA1!`
const users = [] // { id, email, role }
let browser
const results = []
const pass = (m) => { results.push(['PASS', m]); console.log('PASS:', m) }

async function createUser(role) {
  const email = `vgb-e2e-${marker}-${role}@example.invalid`
  const { data, error } = await admin.auth.admin.createUser({ email, password, email_confirm: true, user_metadata: { role, name: `E2E ${role} ${marker}`, e2e_marker: marker } })
  if (error) throw error
  users.push({ id: data.user.id, email, role })
  return users[users.length - 1]
}

async function uiLogin(page, u) {
  await page.goto(base + '/dang-nhap', { waitUntil: 'domcontentloaded' })
  await page.locator('input[type="email"]').fill(u.email)
  await page.locator('input[type="password"]').fill(password)
  await page.locator('button[type="submit"]').click()
  await page.waitForURL((url) => !url.pathname.startsWith('/dang-nhap'), { timeout: 30000 })
  const hasSession = await page.evaluate(() => Object.keys(localStorage).some((k) => /^sb-.*-auth-token$/.test(k) && localStorage.getItem(k)))
  if (!hasSession) throw Error(`${u.role}: 로그인 뒤 브라우저에 세션 없음`)
}

// 이전 실행이 강제 종료(취소·시간 초과·실행기 중단)돼 남긴 일회용 계정을 먼저 지운다. 이 실행기가 만든 계정만 지운다:
// 이메일이 vgb-e2e-*@example.invalid 이고 가입 정보에 e2e_marker가 있는 계정(실제 회원 계정은 이 조건에 걸리지 않는다).
async function sweepLeftovers() {
  const r = await db.query("select id, email from auth.users where email like 'vgb-e2e-%@example.invalid' and raw_user_meta_data ? 'e2e_marker'")
  for (const row of r.rows) {
    const { error } = await admin.auth.admin.deleteUser(row.id)
    if (error) { console.error('SWEEP error:', row.email, error.message); process.exitCode = 1 }
    else console.log('SWEEP: 남아 있던 시험 계정 삭제', row.email)
  }
  const left = await db.query("select count(*)::int as n from auth.users where email like 'vgb-e2e-%@example.invalid' and raw_user_meta_data ? 'e2e_marker'")
  if (left.rows[0].n !== 0) { console.error('CRITICAL: 잔존 시험 계정 삭제 확인 실패', left.rows[0].n); process.exitCode = 1 }
  else console.log('PASS: 잔존 시험 계정 0건 확인')
}
let cleaned = false
async function cleanup() {
  if (cleaned) return
  cleaned = true
  if (browser) await browser.close().catch(() => {})
  for (const u of users) {
    const { error } = await admin.auth.admin.deleteUser(u.id)
    if (error) { console.error('CLEANUP user error:', u.role, error.message); process.exitCode = 1 }
  }
  if (users.length) {
    const left = await db.query('select (select count(*) from auth.users where id = any($1::uuid[]))::int as au, (select count(*) from public.account_roles where user_id = any($1::uuid[]))::int as ar', [users.map((u) => u.id)]).catch(() => null)
    if (left?.rows[0]?.au !== 0 || left?.rows[0]?.ar !== 0) { console.error('CRITICAL: 시험 계정 삭제 확인 실패', JSON.stringify(left?.rows[0])); process.exitCode = 1 }
    else console.log('PASS: 시험 계정 2개와 역할 행 삭제 확인(auth.users·account_roles 0)')
  }
}
// 실행 취소·종료 신호가 오면 계정부터 지우고 끝낸다(GitHub Actions 취소는 SIGINT→SIGTERM으로 온다).
for (const sig of ['SIGINT', 'SIGTERM']) process.on(sig, async () => { console.error('신호', sig, '— 시험 계정 정리 후 종료'); await cleanup().catch(() => {}); await db.end().catch(() => {}); process.exit(1) })

try {
  await db.connect()
  await sweepLeftovers()
  if (SWEEP_ONLY) { await db.end(); process.exit(process.exitCode ?? 0) }
  const employer = await createUser('employer')
  const seeker = await createUser('seeker')
  pass(`일회용 시험 계정 2개 생성(기존 관리자 계정 생성 경로) — 표식 ${marker}`)
  const roles = await db.query('select user_id, role from public.account_roles where user_id = any($1::uuid[])', [users.map((u) => u.id)])
  const roleOf = Object.fromEntries(roles.rows.map((r) => [r.user_id, r.role]))
  if (roleOf[employer.id] !== 'employer' || roleOf[seeker.id] !== 'seeker') throw Error('account_roles 역할 불일치: ' + JSON.stringify(roleOf))
  pass('DB 역할 확인: 고용주=employer, 구직자=seeker(가입 시 역할 메타데이터 → 기존 트리거)')

  browser = await chromium.launch({ headless: true })
  for (const [u, protectedPath, label] of [[employer, '/bang-dieu-khien', '고용주 대시보드'], [seeker, '/ho-so', '구직자 프로필']]) {
    const ctx = await browser.newContext({ viewport: { width: 1366, height: 900 } })
    const page = await ctx.newPage()
    const errors = []
    page.on('pageerror', (e) => errors.push(e.message))
    await uiLogin(page, u)
    pass(`${u.role} 실제 화면 로그인 성공(세션 저장 확인)`)
    await page.goto(base + protectedPath, { waitUntil: 'networkidle', timeout: 45000 })
    const url = new URL(page.url())
    if (url.pathname.startsWith('/dang-nhap')) throw Error(`${label}: 로그인 상태인데 로그인 화면으로 되돌아감(${protectedPath})`)
    const text = (await page.innerText('body')).replace(/\s+/g, ' ')
    if (text.length < 200) throw Error(`${label}: 화면 내용 너무 짧음`)
    if (errors.length) throw Error(`${label}: 스크립트 오류 ${errors[0]}`)
    await page.screenshot({ path: `employer-seeker-e2e-${u.role}.png`, fullPage: true })
    pass(`${label} 접근·표시 확인(${protectedPath}, 글자 ${text.length}자, 스크립트 오류 0)`)
    await ctx.close()
  }

  // ── 앱(/app) 실제 화면(Lee 2026-11-28, #1031 (2)~(5)): 모바일 폭에서 기업·구직자 로그인 연결, 지도, 한국 일자리 칸, 상세 고정 하단 버튼 ──
  const mobile = { viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true }
  const appLogin = async (page, u) => {
    await page.goto(base + '/app/dang-nhap', { waitUntil: 'domcontentloaded' })
    await page.locator('input[type="email"]').fill(u.email)
    await page.locator('input[type="password"]').fill(password)
    await page.locator('button[type="submit"]').click()
    await page.waitForURL((url) => !url.pathname.startsWith('/app/dang-nhap'), { timeout: 30000 })
  }
  const tabCount = async (page) => Number(await page.locator('[data-testid="app-tabbar"]').first().getAttribute('data-tab-count', { timeout: 30000 }))
  {
    const ctx = await browser.newContext(mobile)
    const page = await ctx.newPage()
    const errors = []
    page.on('pageerror', (e) => errors.push(e.message))
    await page.goto(base + '/app/', { waitUntil: 'networkidle', timeout: 60000 })
    if ((await tabCount(page)) !== 5) throw Error('앱 구직자 탭이 5개가 아님')
    // (4) 한국 일자리 칸: 사진이 실제로 받아지고 링크가 열린다
    const kr = page.locator('.app-kr').first()
    await kr.waitFor({ state: 'visible', timeout: 30000 })
    const bg = await kr.locator('.app-kr__photo').evaluate((el) => getComputedStyle(el).backgroundImage)
    const m = /url\("?([^")]+)"?\)/.exec(bg)
    if (!m) throw Error('한국 일자리 칸에 사진 배경이 없음')
    const img = await page.request.get(new URL(m[1], base).toString())
    if (!img.ok() || !String(img.headers()['content-type']).startsWith('image/')) throw Error('한국 일자리 사진 받기 실패 ' + img.status())
    const krHref = await kr.getAttribute('href')
    const krPage = await page.request.get(new URL(krHref, base).toString())
    if (!krPage.ok()) throw Error('한국 일자리 페이지가 열리지 않음 ' + krPage.status())
    pass(`앱 홈: 탭 5개 · 한국 일자리 칸(배너 사진 ${img.status()} · 링크 ${krHref} ${krPage.status()})`)
    // 배너 사진(정적 파일)과 실제 한국 공고 사진 데이터는 구분한다: 공개 한국 공고 수, 한국 공고 뷰에 사진 칸이 있는지, 목록 화면에 공고가 표시되는지.
    const kc = await db.query('select count(*)::int as n from public.korea_jobs_public')
    const kcols = await db.query("select column_name from information_schema.columns where table_schema = 'public' and table_name = 'korea_jobs_public' and column_name ~* '(image|photo|logo|picture|thumb)'")
    await page.goto(base + '/viec-han-quoc/tim-viec', { waitUntil: 'networkidle', timeout: 60000 })
    const krLinks = await page.locator('a[href^="/viec-han-quoc/"]:not([href$="/tim-viec"])').count()
    if (kc.rows[0].n > 0 && krLinks === 0) throw Error(`한국 공고 ${kc.rows[0].n}건이 있는데 목록 화면에 공고 링크가 없음`)
    pass(`한국 일자리: 공개 공고 ${kc.rows[0].n}건 · 목록 화면 공고 링크 ${krLinks}개 · 공고 사진 칸 ${kcols.rows.length}개(0이면 실제 공고 사진 데이터 없음, 배너 사진만 있음)`)
    await page.goto(base + '/app/', { waitUntil: 'networkidle', timeout: 60000 })
    // (3) 지도: 앱 지도 화면에 지도 캔버스와 핀이 있다(웹 홈 지도는 app-smoke가 같은 데이터로 확인)
    await page.goto(base + '/app/ban-do', { waitUntil: 'networkidle', timeout: 60000 })
    const mapEl = page.locator('[data-testid="app-map"]').first()
    await mapEl.waitFor({ state: 'visible', timeout: 45000 })
    await page.locator('[data-testid="app-map"] canvas').first().waitFor({ state: 'attached', timeout: 45000 })
    const pins = Number(await mapEl.getAttribute('data-pins'))
    if (!(pins > 0)) throw Error('앱 지도 핀 0개')
    pass(`앱 지도: 캔버스 표시 · 핀 ${pins}개`)
    // (5) 상세 하단 고정 버튼: 공고 상세를 열어 스크롤해도 하단 바가 화면 아래에 붙어 있다
    await page.goto(base + '/app/', { waitUntil: 'networkidle' })
    const href = await page.locator('a[href^="/app/viec-lam/"], a[href^="/viec-lam/"]').first().getAttribute('href')
    await page.goto(new URL(href.startsWith('/app/') ? href : '/app' + href, base).toString(), { waitUntil: 'networkidle', timeout: 60000 })
    const bar = page.locator('[data-testid="app-actionbar"]').first()
    await bar.waitFor({ state: 'visible', timeout: 30000 })
    const kind = await bar.getAttribute('data-action')
    const box1 = await bar.boundingBox()
    await page.evaluate(() => window.scrollTo(0, document.body.scrollHeight / 2)); await page.waitForTimeout(400)
    const box2 = await bar.boundingBox()
    if (!box1 || !box2 || Math.abs(box1.y - box2.y) > 2 || box2.y + box2.height < 800) throw Error(`상세 하단 바가 고정되지 않음 ${JSON.stringify([box1, box2])}`)
    if (!(await bar.locator('a, button').count())) throw Error('상세 하단 바에 단추가 없음')
    await page.screenshot({ path: 'employer-seeker-e2e-app-detail.png' })
    pass(`앱 상세: 하단 고정 바(동작 ${kind}) 스크롤 후에도 같은 위치`)
    // 지원 버튼 클릭 연결: 내부 지원 공고(employer_id 있는 공개 공고)에서 비로그인이면 로그인으로 가고(되돌아올 주소 포함), 없으면 '표본 없음'으로 기록한다.
    const internal = await db.query('select id from public.local_jobs where active and not admin_hidden and employer_id is not null order by id desc limit 1')
    if (internal.rows[0]) {
      await page.goto(`${base}/app/viec-lam/sb-${internal.rows[0].id}`, { waitUntil: 'networkidle', timeout: 60000 })
      await page.getByRole('button', { name: /Ứng tuyển ngay/ }).first().click()
      await page.waitForURL((url) => url.pathname.startsWith('/app/dang-nhap') && url.searchParams.get('redirect')?.includes('/viec-lam/'), { timeout: 20000 })
      pass('앱 상세 지원 버튼(비로그인) → 로그인 화면(되돌아올 주소 포함)')
    } else pass('내부 지원 공개 공고 0건 — 지원 버튼 클릭 시험 대상 없음(표본 없음, 기능 결함 아님)')
    if (errors.length) throw Error('앱 비로그인 화면 스크립트 오류 ' + errors[0])
    await ctx.close()
  }
  for (const u of [employer, seeker]) {
    const ctx = await browser.newContext(mobile)
    const page = await ctx.newPage()
    const errors = []
    page.on('pageerror', (e) => errors.push(e.message))
    await appLogin(page, u)
    if (u.role === 'employer') {
      await page.waitForURL((url) => url.pathname.replace(/\/$/, '') === '/app/biz', { timeout: 30000 })   // (2) 기업 로그인 → 기업 홈 자동 전환
      await page.locator('[data-testid="app-biz-home"]').first().waitFor({ state: 'visible', timeout: 30000 })
      if ((await tabCount(page)) !== 4) throw Error('기업 탭이 4개가 아님')
      await page.screenshot({ path: 'employer-seeker-e2e-app-biz.png' })
      pass('앱 기업 로그인 → /app/biz 기업 홈 · 기업 탭 4개')
      for (const to of ['/app/biz/quan-ly-tin', '/app/biz/dang-tin', '/app/biz/doanh-nghiep', '/app/biz']) {
        await page.locator(`[data-testid="app-tabbar"] a[href="${to}"]`).first().click()
        await page.waitForURL((url) => url.pathname.replace(/\/$/, '') === to, { timeout: 20000 })
        await page.waitForLoadState('networkidle')
        if (await page.locator('[data-testid="app-biz-denied"]').count()) throw Error(`기업 탭 ${to}에서 접근 거절 화면`)
        if ((await tabCount(page)) !== 4) throw Error(`기업 탭 ${to}에서 탭이 4개가 아님`)
      }
      pass('앱 기업 탭 4개 모두 눌러서 이동·표시(관리·등록·기업정보·홈)')
    } else {
      await page.waitForURL((url) => url.pathname.replace(/\/$/, '') === '/app', { timeout: 30000 })
      if ((await tabCount(page)) !== 5) throw Error('구직자 로그인 뒤 탭이 5개가 아님')
      await page.goto(base + '/app/biz', { waitUntil: 'networkidle', timeout: 45000 })
      await page.locator('[data-testid="app-biz-denied"]').first().waitFor({ state: 'visible', timeout: 30000 })
      pass('앱 구직자 로그인 → 홈 · 기업 화면은 접근 거절 안내')
      const internal = await db.query('select id from public.local_jobs where active and not admin_hidden and employer_id is not null order by id desc limit 1')
      if (internal.rows[0]) {
        await page.goto(`${base}/app/viec-lam/sb-${internal.rows[0].id}`, { waitUntil: 'networkidle', timeout: 60000 })
        await page.getByRole('button', { name: /Ứng tuyển ngay/ }).first().click()
        await page.locator('[data-testid="app-apply"]').first().waitFor({ state: 'visible', timeout: 20000 })
        pass('앱 상세 지원 버튼(구직자 로그인) → 지원 창 열림(제출은 하지 않음)')
      } else pass('내부 지원 공개 공고 0건 — 로그인 후 지원 창 시험 대상 없음(표본 없음)')
    }
    if (errors.length) throw Error(`앱 ${u.role} 화면 스크립트 오류 ${errors[0]}`)
    await ctx.close()
  }
  console.log('E2E PASS: 고용주·구직자 로그인·권한 화면 확인(공고 공개·지원 없음, 앱 /app 화면 포함)')
} catch (e) {
  console.error('E2E FAIL:', e instanceof Error ? e.stack : String(e))
  process.exitCode = 1
} finally {
  await cleanup()
  await db.end().catch(() => {})
}
