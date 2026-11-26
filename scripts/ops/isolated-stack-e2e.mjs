// 격리 실제 스택 E2E(대표 2026-11-26 지시 5·6번): 실제 GoTrue 로그인 + 실제 PostgREST 권한 + 웹·앱 화면까지 이어서 확인한다.
// 운영 DB·운영 열쇠는 쓰지 않는다 — 로컬 스택(127.0.0.1) 주소·로컬 열쇠만 받고, 아니면 시작 전에 중단한다.
// 웹 코드는 운영 Supabase 주소가 고정돼 있어, 브라우저의 그 주소 요청을 로컬 스택으로 바꿔 보낸다(앱 코드 변경 없음). 운영 주소로는 한 건도 나가지 않는다(바꿔 보내거나 막음).
// 출력에는 상태 코드·오류 코드·통과 여부만 낸다(토큰·열쇠·계정 비밀번호는 내지 않는다).
import { spawnSync } from 'node:child_process'
import { appendFileSync, mkdirSync, writeFileSync } from 'node:fs'
import { chromium } from 'playwright'

const API = process.env.LOCAL_API_URL, ANON = process.env.LOCAL_ANON_KEY, SERVICE = process.env.LOCAL_SERVICE_KEY, DB = process.env.LOCAL_DB_URL
const BASE = process.env.BASE_URL, SHOTS = process.env.SCREENSHOT_DIR || 'isolated-stack-proof'
if (![API, DB].every((u) => u && /(127\.0\.0\.1|localhost)/.test(u)) || !ANON || !SERVICE) { console.error('로컬 격리 스택 주소·열쇠(LOCAL_API_URL·LOCAL_DB_URL·LOCAL_ANON_KEY·LOCAL_SERVICE_KEY)가 필요 — 로컬이 아니면 중단'); process.exit(2) }
mkdirSync(SHOTS, { recursive: true })
const PROD_HOST = 'edhuesdnuxlbcfephutq.supabase.co'
const results = []
const rec = (id, label, pass, note = '') => { results.push({ id, label, pass, note }); console.log(`${pass ? 'PASS' : 'FAIL'} ${id} ${label}${note ? ' — ' + note : ''}`) }
const observe = (id, label, note) => { results.push({ id, label, pass: null, note }); console.log(`OBSERVE ${id} ${label} — ${note}`) }

const call = async (method, path, { token, body, headers } = {}) => {
  const r = await fetch(API + path, { method, headers: { apikey: ANON, authorization: `Bearer ${token ?? ANON}`, 'content-type': 'application/json', ...headers }, body: body === undefined ? undefined : JSON.stringify(body) })
  const text = await r.text(); let json; try { json = JSON.parse(text) } catch { /* 본문이 JSON이 아닐 수 있음 */ }
  return { status: r.status, json, code: json?.code ?? json?.error_code ?? '', msg: (json?.message ?? json?.msg ?? '').slice(0, 120) }
}
const sql = (q) => { const r = spawnSync('psql', [DB, '-X', '-q', '-At', '-v', 'ON_ERROR_STOP=1', '-c', q], { encoding: 'utf8' }); if (r.status !== 0) throw new Error(`psql 실패: ${(r.stderr.match(/ERROR:.*/) || [''])[0]}`); return r.stdout.trim() }

const RUN = Date.now()
const PW = `Pw-${RUN}-aA1!`
const COMPANY = 'E2E Isolated Co', TITLE = 'E2E Isolated Role'
const users = {}
const makeUser = async (key, role = 'seeker') => {
  const email = `e2e-${key}-${RUN}@example.com`
  const c = await call('POST', '/auth/v1/admin/users', { token: SERVICE, body: { email, password: PW, email_confirm: true, user_metadata: { role } } })
  if (c.status !== 200 || !c.json?.id) throw new Error(`계정 생성 실패(${key}): ${c.status} ${c.code}`)
  const l = await call('POST', '/auth/v1/token?grant_type=password', { body: { email, password: PW } })
  if (l.status !== 200 || !l.json?.access_token) throw new Error(`로그인 실패(${key}): ${l.status} ${l.code}`)
  users[key] = { email, id: c.json.id, token: l.json.access_token }
  return l
}

// ── 1. 실제 인증(GoTrue) ──
try {
  const l = await makeUser('employer', 'employer'); await makeUser('employer2', 'employer'); await makeUser('seeker'); await makeUser('seeker2')
  rec('A1', '실제 GoTrue 로그인(비밀번호) → 사용자 토큰', l.status === 200)
  const me = await call('GET', '/auth/v1/user', { token: users.seeker.token })
  rec('A2', '발급 토큰으로 사용자 조회', me.status === 200 && me.json?.email === users.seeker.email)
  const bad = await call('POST', '/auth/v1/token?grant_type=password', { body: { email: users.seeker.email, password: 'wrong-password' } })
  rec('A3', '틀린 비밀번호는 거부', bad.status === 400, `status ${bad.status}`)
  const forged = await call('GET', '/rest/v1/local_jobs?select=id&limit=1', { token: users.seeker.token.slice(0, -4) + 'AAAA' })
  rec('A4', '서명이 다른 토큰은 거부', forged.status === 401, `status ${forged.status}`)
  const st = sql(`select count(*) from public.account_statuses where user_id in ('${users.seeker.id}','${users.employer.id}') and status='active'`)
  rec('A5', '가입(auth.users 생성) 때 계정 상태 active 자동 기록(트리거)', st === '2', `active ${st}/2`)
} catch (e) { rec('A0', '인증 준비', false, e.message) }

// ── 2. 시험 데이터(격리 DB 전용): 등록 관문은 별도 시험이 검증하므로 여기선 사용자 트리거를 잠시 끄고 고정 공고 1건을 둔다 ──
let jobId
try {
  const r = spawnSync('psql', [DB, '-X', '-q', '-At', '-v', 'ON_ERROR_STOP=1', '-v', `employer_id=${users.employer.id}`, '-f', 'supabase/tests/baseline/isolated_stack_fixture.sql'], { encoding: 'utf8' })
  if (r.status !== 0) throw new Error(`psql 실패: ${(r.stderr.match(/ERROR:.*/) || [''])[0]}`)
  jobId = Number(r.stdout.split('\n').find((l) => /^\d+$/.test(l)))
  rec('B0', '시험 공고 1건 준비(격리 DB)', Number.isInteger(jobId) && jobId > 0, `id ${jobId}`)
} catch (e) { rec('B0', '시험 공고 준비', false, e.message) }

// ── 3. 실제 PostgREST: 노출·권한·흐름 ──
const openapi = await call('GET', '/rest/v1/')
const paths = Object.keys(openapi.json?.paths ?? {})
rec('C1', 'PostgREST 노출 스키마에 ingest_private 도우미 없음(OpenAPI 경로)', openapi.status === 200 && !paths.some((p) => /\/rpc\/(open_raw|job_state|branch_key|find_existing|audit_admin_create)$/.test(p) || /\/rpc\/link$/.test(p) || /\/rpc\/log$/.test(p)), `경로 ${paths.length}개`)
const priv = await call('POST', '/rest/v1/rpc/job_state', { body: { p_id: 1 }, headers: { 'accept-profile': 'ingest_private', 'content-profile': 'ingest_private' } })
rec('C2', 'ingest_private 스키마로 직접 호출하면 거부(스키마 미노출)', priv.status === 406 || priv.status === 404 || priv.status === 403, `status ${priv.status} ${priv.code}`)

const GUEST_TOKEN = 'g'.repeat(24)
const flows = (label) => [
  ['익명: 공개 공고 목록', async () => { const r = await call('GET', `/rest/v1/local_jobs?select=id,title,company&id=eq.${jobId}`); return r.status === 200 && r.json?.length === 1 }],
  ['익명: 원문 주소(source_url) 열은 못 읽음', async () => { const r = await call('GET', `/rest/v1/local_jobs?select=source_url&id=eq.${jobId}`); return r.status === 401 || r.status === 403 || (r.status === 200 && (r.json ?? []).every((x) => x.source_url == null)) }],
  ['익명: 게스트 등록(ingest_job)', async () => { const r = await call('POST', '/rest/v1/rpc/ingest_job', { body: { p: { channel: 'employer', guest_manage_token: GUEST_TOKEN + label, source_text: `${COMPANY} tuyen. LH 0912345678`, company: COMPANY, title: `guest-${label}`, employer_phone: '0912345678', location: 'KCN Yên Phong, Bắc Ninh', active: true } } }); flows.guestId = r.json; return r.status === 200 && Number.isInteger(r.json) }],
  ['익명: 게스트 관리 링크 조회(get_guest_job)', async () => { const r = await call('POST', '/rest/v1/rpc/get_guest_job', { body: { p_job_id: flows.guestId, p_token: GUEST_TOKEN + label } }); return r.status === 200 && r.json?.length === 1 }],
  ['익명: 지원 insert는 거부', async () => { const r = await call('POST', '/rest/v1/applications', { body: { job_id: jobId, seeker_id: users.seeker.id, employer_id: users.employer.id } }); return r.status === 401 || r.status === 403 }],
  // 운영에는 0020 초안(관리자 함수 anon 회수)이 적용돼 있지 않아 anon이 실행 권한을 가진다(#1070 구조 대조) — 실행 권한이 있어도 함수 안 관리자 확인이 막는지 실제 PostgREST로 본다.
  ['익명: 관리자 함수(admin_set_job_hidden) 호출은 거부되고 공고는 그대로', async () => { const r = await call('POST', '/rest/v1/rpc/admin_set_job_hidden', { body: { target_job_id: jobId, hidden: true, reason: 'e2e' } }); const s = await call('GET', `/rest/v1/local_jobs?select=id&id=eq.${jobId}`); return r.status >= 400 && s.json?.length === 1 }],
  ['익명: 관리자 목록(admin_list_users) 호출은 거부', async () => { const r = await call('POST', '/rest/v1/rpc/admin_list_users', { body: {} }); return r.status >= 400 }],
  ['일반 구직자: 관리자 함수(admin_set_job_hidden) 호출은 거부되고 공고는 그대로', async () => { const u = users[`seeker${label === 'after' ? '2' : ''}`]; const r = await call('POST', '/rest/v1/rpc/admin_set_job_hidden', { token: u.token, body: { target_job_id: jobId, hidden: true, reason: 'e2e' } }); const s = await call('GET', `/rest/v1/local_jobs?select=id&id=eq.${jobId}`); return r.status >= 400 && s.json?.length === 1 }],
  ['익명·일반 구직자: 관리자 함수(admin_set_account_status) 호출은 거부되고 계정 상태 그대로', async () => { const u = users[`seeker${label === 'after' ? '2' : ''}`]; const a = await call('POST', '/rest/v1/rpc/admin_set_account_status', { body: { target_user_id: users.employer.id, next_status: 'suspended', reason: 'e2e' } }); const b = await call('POST', '/rest/v1/rpc/admin_set_account_status', { token: u.token, body: { target_user_id: users.employer.id, next_status: 'suspended', reason: 'e2e' } }); return a.status >= 400 && b.status >= 400 && sql(`select status from public.account_statuses where user_id = '${users.employer.id}'`) === 'active' }],
  ['익명·일반 구직자: 관리자 함수(admin_handle_report) 호출은 거부', async () => { const u = users[`seeker${label === 'after' ? '2' : ''}`]; const id = '00000000-0000-0000-0000-000000000000'; const a = await call('POST', '/rest/v1/rpc/admin_handle_report', { body: { target_report_id: id, next_status: 'resolved', note: 'e2e' } }); const b = await call('POST', '/rest/v1/rpc/admin_handle_report', { token: u.token, body: { target_report_id: id, next_status: 'resolved', note: 'e2e' } }); return a.status >= 400 && b.status >= 400 && /admin access required|42501/.test(JSON.stringify([a.json, b.json])) }],
  ['구직자: 공고 목록', async () => { const r = await call('GET', `/rest/v1/local_jobs?select=id&id=eq.${jobId}`, { token: users[`seeker${label === 'after' ? '2' : ''}`].token }); return r.status === 200 && r.json?.length === 1 }],
  ['구직자: 사이트 안 지원(applications insert)', async () => { const u = users[`seeker${label === 'after' ? '2' : ''}`]; const r = await call('POST', '/rest/v1/applications', { token: u.token, body: { job_id: jobId, seeker_id: u.id, employer_id: users.employer.id, job_title: TITLE, company: COMPANY, seeker_name: 'E2E', seeker_phone: '0900000000' } }); flows.apply = r.status; return r.status === 201 }],
  ['구직자: 남의 이름으로 지원은 거부', async () => { const u = users[`seeker${label === 'after' ? '2' : ''}`]; const r = await call('POST', '/rest/v1/applications', { token: u.token, body: { job_id: jobId, seeker_id: users.employer.id, employer_id: users.employer.id } }); return r.status === 401 || r.status === 403 }],
  ['구직자: 본인 활성 여부(is_account_active)', async () => { const u = users[`seeker${label === 'after' ? '2' : ''}`]; const r = await call('POST', '/rest/v1/rpc/is_account_active', { token: u.token, body: { user_id: u.id } }); return r.status === 200 && r.json === true }],
  ['고용주: 내 공고의 지원자 보기', async () => { const r = await call('GET', `/rest/v1/applications?select=id,seeker_id&job_id=eq.${jobId}`, { token: users.employer.token }); return r.status === 200 && r.json?.length >= 1 }],
  ['고용주: 남의 지원 내역은 못 봄(구직자 토큰으로 전체 조회 시 본인 것만)', async () => { const r = await call('GET', '/rest/v1/applications?select=seeker_id', { token: users.seeker.token }); return r.status === 200 && (r.json ?? []).every((x) => x.seeker_id === users.seeker.id) }],
]
const runFlows = async (label) => { const out = {}; for (const [name, fn] of flows(label)) { try { out[name] = await fn() } catch (e) { out[name] = false } } return out }
let before = {}, after = {}
if (jobId) {
  before = await runFlows('before')
  for (const [n, ok] of Object.entries(before)) rec('D', `현재 권한: ${n}`, ok)
  // 비로그인(anon)이 is_account_active를 부를 수 있는지 — 값만 관찰(대표 결정 항목: 막으면 어떤 흐름이 깨지는지)
  const anonActive = await call('POST', '/rest/v1/rpc/is_account_active', { body: { user_id: users.seeker?.id } })
  observe('E1', '비로그인의 is_account_active 호출', `status ${anonActive.status}${anonActive.status === 200 ? ' (임의 사용자 번호의 활성 여부 조회 가능)' : ' ' + anonActive.code}`)
  // 격리 DB에서만: anon·public 실행 권한을 회수한 뒤 같은 흐름을 다시 돌려 영향을 본다(복구함)
  const had = sql(`select has_function_privilege('anon','public.is_account_active(uuid)','execute')`) === 't'
  sql(`revoke execute on function public.is_account_active(uuid) from anon, public`)
  try {
    after = await runFlows('after')
    const broke = Object.keys(before).filter((n) => before[n] && !after[n])
    observe('E2', 'anon 실행 권한을 회수하면 깨지는 흐름', broke.length ? broke.join(' / ') : '없음(모든 흐름 동일)')
    // 실험 결과(관찰): 격리 DB에서 anon 실행 권한을 회수해 본 것이므로 통과·실패가 아니라 '무엇이 깨지는지'를 남긴다 — 대표 결정 항목(0020 초안)의 근거.
    observe('E3', 'anon 회수 뒤에도 유지되는 익명 흐름', ['익명: 공개 공고 목록', '익명: 게스트 등록(ingest_job)', '익명: 게스트 관리 링크 조회(get_guest_job)'].filter((n) => after[n]).join(' / ') || '없음')
  } finally { if (had) sql(`grant execute on function public.is_account_active(uuid) to anon`) }
}

// ── 3-2. 기업 이용 과정(실제 인증·PostgREST·DB): 등록 → 공개 전 검사 대기 → 수정 → 남의 수정 차단 → 마감, 지원 중복 방지, 세션 만료 뒤 재로그인 ──
if (jobId) {
  const E = users.employer, E2 = users.employer2, S = users.seeker
  try {
    const reg = await call('POST', '/rest/v1/rpc/ingest_job', { token: E.token, body: { p: { channel: 'employer', employer_id: E.id, source_text: 'E2E Life Co\nTuyen nhan vien chay ban nha hang\nKCN Yen Phong, Bac Ninh\nLH 0912345678', company: 'E2E Life Co', title: 'Nhan vien chay ban nha hang', description: 'Phuc vu ban an tai nha hang', location: 'KCN Yen Phong, Bac Ninh', employer_phone: '0912345678', active: true, occupation_code: '5', occupation_evidence: 'Tuyen nhan vien chay ban nha hang' } } })
    const lifeId = reg.json
    rec('H1', '기업회원 공고 등록(실제 ingest_job, 기업 토큰)', reg.status === 200 && Number.isInteger(lifeId), `status ${reg.status} ${reg.code}`)
    if (Number.isInteger(lifeId)) {
      const pub = await call('GET', `/rest/v1/local_jobs?select=id&id=eq.${lifeId}`)
      rec('H2', '새 기업 공고는 검사 통과 전 비로그인에게 공개되지 않음(공개 전 검사 대기 정책)', pub.status === 200 && pub.json?.length === 0, `익명 조회 ${pub.json?.length}건`)
      const own = await call('GET', `/rest/v1/local_jobs?select=id,active&id=eq.${lifeId}`, { token: E.token })
      rec('H3', '등록한 기업은 자기 공고를 조회', own.status === 200 && own.json?.length === 1)
      const upd = await call('PATCH', `/rest/v1/local_jobs?id=eq.${lifeId}`, { token: E.token, body: { salary: '9 triệu/tháng' }, headers: { prefer: 'return=representation' } })
      rec('H4', '기업이 자기 공고 수정(급여)', upd.status === 200 && upd.json?.[0]?.salary === '9 triệu/tháng', `status ${upd.status}`)
      const other = await call('PATCH', `/rest/v1/local_jobs?id=eq.${lifeId}`, { token: E2.token, body: { salary: '1 triệu' }, headers: { prefer: 'return=representation' } })
      const after = await call('GET', `/rest/v1/local_jobs?select=salary&id=eq.${lifeId}`, { token: E.token })
      rec('H5', '다른 기업은 남의 공고를 수정할 수 없음', (other.json?.length ?? 0) === 0 && after.json?.[0]?.salary === '9 triệu/tháng', `status ${other.status}`)
    }
    // 공개 중인 시험 공고로: 중복 지원 방지 → 기업 마감 → 마감 뒤 지원·공개 목록
    const dup = await call('POST', '/rest/v1/applications', { token: S.token, body: { job_id: jobId, seeker_id: S.id, employer_id: E.id, job_title: TITLE, company: COMPANY, seeker_name: 'E2E', seeker_phone: '0900000000' } })
    const first = await call('GET', `/rest/v1/applications?select=id&job_id=eq.${jobId}&seeker_id=eq.${S.id}`, { token: S.token })
    rec('H6', '같은 공고에 중복 지원은 거부(이미 지원한 구직자)', first.json?.length >= 1 && dup.status === 409, `status ${dup.status} ${dup.code}`)
    const close = await call('PATCH', `/rest/v1/local_jobs?id=eq.${jobId}`, { token: E.token, body: { active: false }, headers: { prefer: 'return=representation' } })
    rec('H7', '기업이 자기 공고를 마감(active=false)', close.status === 200 && close.json?.[0]?.active === false, `status ${close.status}`)
    const gone = await call('GET', `/rest/v1/local_jobs?select=id&id=eq.${jobId}`)
    rec('H8', '마감한 공고는 공개 목록에서 즉시 빠짐', gone.status === 200 && gone.json?.length === 0)
    const S2 = users.seeker2
    const late = await call('POST', '/rest/v1/applications', { token: S2.token, body: { job_id: jobId, seeker_id: S2.id, employer_id: E.id, job_title: TITLE, company: COMPANY, seeker_name: 'E2E', seeker_phone: '0900000001' } })
    rec('H9', '마감한 공고에는 새 지원이 거부됨', late.status >= 400, `status ${late.status} ${late.code}`)
    // 다음 화면 단계가 쓰므로 다시 연다(기업이 다시 공개로 되돌리는 것은 검사 정책 대상이라, 격리 DB 고정 공고를 직접 되돌린다)
    sql(`alter table public.local_jobs disable trigger user; update public.local_jobs set active = true where id = ${jobId}; alter table public.local_jobs enable trigger user;`)
    // 세션: 로그아웃하면 새로고침 토큰이 더 이상 통하지 않고, 다시 로그인하면 정상
    const sess = await call('POST', '/auth/v1/token?grant_type=password', { body: { email: S.email, password: PW } })
    const rt = sess.json?.refresh_token
    const out = await call('POST', '/auth/v1/logout?scope=global', { token: sess.json?.access_token })
    const refreshed = await call('POST', '/auth/v1/token?grant_type=refresh_token', { body: { refresh_token: rt } })
    const again = await call('POST', '/auth/v1/token?grant_type=password', { body: { email: S.email, password: PW } })
    rec('H10', '로그아웃 뒤 예전 새로고침 토큰은 거부되고 다시 로그인하면 정상', out.status < 300 && refreshed.status >= 400 && again.status === 200, `logout ${out.status} refresh ${refreshed.status} relogin ${again.status}`)
  } catch (e) { rec('H0', '기업 이용 과정', false, e.message) }
}

// ── 4. 웹·앱 화면(실제 브라우저, 실제 로컬 스택) ──
if (BASE && jobId) {
  const browser = await chromium.launch()
  const outside = new Set()
  const prepare = async (context) => {
    await context.route('**/*', async (route) => {
    try {
      const u = new URL(route.request().url())
      if (u.host === PROD_HOST) {
        const headers = { ...route.request().headers() }
        const bearer = (headers.authorization ?? '').replace(/^Bearer /, '')
        let ref = ''; try { ref = JSON.parse(Buffer.from(bearer.split('.')[1] ?? '', 'base64url').toString()).ref ?? '' } catch { /* 토큰 모양이 아니면 그대로 */ }
        headers.apikey = ANON
        // 운영 anon 열쇠(웹 코드에 박혀 있음)로 온 요청만 로컬 anon 열쇠로 바꾼다. 사용자 로그인 토큰은 로컬 GoTrue가 발급한 것이라 그대로 둔다.
        if (!bearer || ref === 'edhuesdnuxlbcfephutq') headers.authorization = `Bearer ${ANON}`
        try { return await route.fetch({ url: API + u.pathname + u.search, headers }).then((resp) => route.fulfill({ response: resp })) } catch { return await route.abort() }
      }
      if (u.host === new URL(BASE).host || u.hostname === '127.0.0.1' || u.hostname === 'localhost' || u.protocol === 'data:' || u.protocol === 'blob:') return await route.continue()
      outside.add(u.host); return await route.abort()
    } catch { /* 페이지가 닫히는 중에 이미 처리된 요청 — 무시 */ }
    })
  }
  const reachedProd = () => [...outside].some((h) => /supabase\.co$|viecganban\.vn$/.test(h))
  for (const [name, vp] of [['pc', { width: 1366, height: 900 }], ['mobile', { width: 390, height: 844 }]]) {
    const context = await browser.newContext({ viewport: vp }); await prepare(context)
    const page = await context.newPage()
    const authCalls = []
    page.on('response', (r) => { if (/\/auth\/v1\/token/.test(r.url())) authCalls.push(r.status()) })
    try {
      await page.goto(`${BASE}/dang-nhap`, { waitUntil: 'domcontentloaded' })
      await page.locator('input[type="email"]').fill(users.seeker.email)
      await page.locator('input[type="password"]').fill(PW)
      await page.locator('button[type="submit"]').click()
      await page.waitForFunction(() => Object.keys(localStorage).some((k) => /auth-token/.test(k)), null, { timeout: 30_000 })
      const session = await page.evaluate(() => { const k = Object.keys(localStorage).find((x) => /auth-token/.test(x)); try { return JSON.parse(localStorage.getItem(k)).user?.email } catch { return null } })
      rec('F1', `웹(${name}) 화면 로그인 → 실제 GoTrue 토큰 발급·세션 저장`, session === users.seeker.email && authCalls.includes(200), `토큰 요청 ${authCalls.join(',')}`)
      await page.goto(`${BASE}/viec-lam/sb-${jobId}`, { waitUntil: 'domcontentloaded' })
      await page.waitForFunction((t) => document.body.innerText.includes(t), COMPANY, { timeout: 30_000 })
      rec('F2', `웹(${name}) 공고 상세가 로컬 스택 데이터로 열림`, true)
      await page.screenshot({ path: `${SHOTS}/web-detail-${name}.png` })
      await page.goto(`${BASE}/app/viec-lam/sb-${jobId}`, { waitUntil: 'domcontentloaded' })
      await page.locator('[data-testid="app-detail"][data-job-id]').first().waitFor({ state: 'visible', timeout: 30_000 })
      rec('F3', `앱(${name}) 공고 상세가 같은 데이터로 열림(웹 로그인 세션 공유 환경)`, true)
      const appSession = await page.evaluate(() => { const k = Object.keys(localStorage).find((x) => /auth-token/.test(x)); try { return JSON.parse(localStorage.getItem(k)).user?.email } catch { return null } })
      rec('F4', `앱(${name})에서도 같은 로그인 세션이 보임(웹→앱 교차)`, appSession === users.seeker.email)
      await page.screenshot({ path: `${SHOTS}/app-detail-${name}.png` })
      await page.goto(`${BASE}/app/`, { waitUntil: 'domcontentloaded' })
      await page.locator('[data-testid="app-tabbar"]').first().waitFor({ state: 'visible', timeout: 30_000 })
      const card = page.locator(`[data-job-id="sb-${jobId}"], a[href$="/viec-lam/sb-${jobId}"]`)
      await card.first().waitFor({ state: 'attached', timeout: 30_000 }).then(() => rec('F5', `앱(${name}) 홈에 시험 공고 카드가 보임`, true), async () => rec('F5', `앱(${name}) 홈에 시험 공고 카드가 보임`, false, `홈에 나온 공고 카드 ${await page.locator('[data-job-id]').count()}개 중 없음`))
    } catch (e) { rec('F0', `웹·앱 화면(${name})`, false, e.message.split('\n')[0]) }
    await context.close()
  }
  rec('G1', '브라우저에서 운영 주소(Supabase·서비스)로 나간 요청 없음(전부 로컬로 바꿔 보내거나 막음)', !reachedProd(), `바깥 호스트 ${[...outside].join(',') || '없음'}`)
  await browser.close()
} else observe('F', '웹·앱 화면 단계', 'BASE_URL 없음 또는 시험 공고 없음 — 건너뜀')

const failed = results.filter((r) => r.pass === false)
writeFileSync(`${SHOTS}/result.json`, JSON.stringify(results, null, 1))
const summary = `## 격리 실제 스택 E2E\n통과 ${results.filter((r) => r.pass).length} / 실패 ${failed.length} / 관찰 ${results.filter((r) => r.pass === null).length}\n\n${results.map((r) => `- ${r.pass === null ? '👁' : r.pass ? '✅' : '❌'} ${r.id} ${r.label}${r.note ? ' — ' + r.note : ''}`).join('\n')}\n`
if (process.env.GITHUB_STEP_SUMMARY) appendFileSync(process.env.GITHUB_STEP_SUMMARY, summary)
process.exit(failed.length ? 1 : 0)
