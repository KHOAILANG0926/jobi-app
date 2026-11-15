// 결정 0003 강제 보강(Lee 2026-10-28, 방법 A): 결정 문서(docs/decisions/)나 .github/CODEOWNERS를 바꾼 PR은
// 현재 head 커밋에 대한 Lee 계정(KHOAILANG0926) 승인이 있어야 봇이 병합한다. 다른 PR은 영향 없음.
// master 보호 설정이 승인 수 0이라 코드 소유자 승인이 실제로 막지 못한 문제(2026-10-28 #295)의 보완이다.
// 승인 근거: 현재 head SHA에 대한 Lee 계정의 APPROVED 리뷰만(S3-2: 댓글 승인 폐지). 다른 SHA에 대한 승인은 무효(새 커밋이 오면 다시 승인).
// PR 작성자는 작업 계정(viecganban-bot)이라 Lee가 리뷰할 수 있다. Lee 계정이 만든 예전 PR은 Lee가 자기 승인을 못 하므로 보류된다(닫힌 실패).
export const OWNER = 'KHOAILANG0926'
export const PROTECTED = (path) => path.startsWith('docs/decisions/') || path === '.github/CODEOWNERS'
// R2 자동 병합 통제 강화(Lee 2026-11-13 승인): 승인 대상은 파일 내용으로 자동 감지한다 — 라벨·Claude 답글·작성자 말이 아니라 실제 변경 파일이 기준이라 라벨을 빼거나 답글을 달아도 우회되지 않는다.
//  ① 결정 문서·CODEOWNERS(기존, 결정 0003)
//  ② 승인된 PC 화면 틀(기존 잠금 scripts/test-desktop-baseline.mjs의 파일 목록 — 목록을 따로 만들지 않고 그 파일에서 읽음, CLAUDE.md '승인된 공고 틀 보존'):
//     (예전에는 댓글 승인도 인정 — S3-2에서 폐지, 아래)
//  ③ `needs-lee` 라벨이 붙은 PR(이슈 라벨 정의: Lee 결정 대기): 같은 승인이 현재 head에 있어야 병합
// 한계: 이 저장소의 자동화·세션은 Lee 계정 열쇠를 쓰므로 승인 댓글을 사람이 달았는지 AI가 달았는지는 GitHub 기록으로 구분되지 않는다(계정 분리는 별도 승인 사항).
export const NEEDS_LEE_LABEL = 'needs-lee'
// S3-2(#808, Lee 2026-11-14 결정 6①): 승인은 현재 head 커밋에 대한 Lee 계정의 GitHub 승인 리뷰(Approve)만 인정한다.
// 예전 `LEE-APPROVE <sha>`·`LEE-DEMO-APPLY <sha>` 댓글은 AI가 Lee 계정 열쇠로 달 수 있어(S1 F11) 폐지 — AI가 Lee 승인을 대신 기록하지 않는다.
// ④ 검사·보호 장치 변경(검사 약화 가능): 워크플로·검사/판정 스크립트·검토 기준을 바꾸는 PR도 Lee 승인 대상(#807 '검사 약화는 대표님 결정').
export const GATE_CODE = (path) => /^\.github\//.test(path) || /^scripts\/(?:ci|status)\//.test(path)
  || /^scripts\/(?:check-[^/]+|[^/]+-gate|approved-migrations)\.mjs$/.test(path) || path === 'AGENTS.md'
// ⑤ 의존성·검증 약화(S4, Lee 2026-11-15 "package.json 전체를 고위험으로 지정하지 말 것"): package.json을 바꿨다고 다 승인 대상이 아니다.
//    승인 대상 = 새 의존성 / 설치 스크립트(직접·의존성 lockfile hasInstallScript) / 패키지 출처 변경(registry 밖 주소·git·file·npm 별칭·.npmrc·overrides)
//               / 검증 약화(test·build·typecheck 등 scripts 변경, 시험 파일 삭제·이름 바꿈, 시험 실행기·tsconfig 변경).
//    기존 의존성의 일반 업데이트(같은 이름, registry 버전 범위·lockfile 버전만 바뀜)는 자동 검증(필수 검사)으로 진행한다.
//    package.json·lockfile 내용을 받지 못하면 판단할 수 없으므로 승인 대상으로 본다(닫힌 실패).
const DEP_SECTIONS = ['dependencies', 'devDependencies', 'optionalDependencies', 'peerDependencies']
const INSTALL_SCRIPTS = ['preinstall', 'install', 'postinstall', 'prepare', 'prepublish', 'preprepare', 'postprepare', 'prepack', 'postpack']
const SAFE_SCRIPTS = ['dev', 'preview', 'start']  // 개발 서버만 — 검사·빌드에 쓰이지 않음
const REGISTRY = 'https://registry.npmjs.org/'
// registry 버전 범위만 '일반'(^1.2.3 ~1.2 >=1 <2 1.x * 1.2.3-beta.1 …). git·github 줄임(user/repo)·URL·file:·link:·npm: 별칭·
// 'latest' 같은 태그(가리키는 버전을 바꿀 수 있음)는 출처·버전 방식 변경으로 본다(검토 지적 6).
const plainRange = (spec) => typeof spec === 'string' && /^\s*[\^~<>=]*\s*(\d+|[xX*])(\.(\d+|[xX*])){0,2}(-[0-9A-Za-z.-]+)?(\+[0-9A-Za-z.-]+)?(\s*(\|\||-|\s)\s*[\^~<>=]*\s*(\d+|[xX*])(\.(\d+|[xX*])){0,2}(-[0-9A-Za-z.-]+)?)*\s*$|^\s*[*xX]\s*$/.test(spec)
// 루트 밖 의존성 목록·설치 설정(하위 폴더 package.json·lockfile·.npmrc, yarn/pnpm lock)은 드물고 판정이 어려워 바뀌면 승인 대상(검토 지적 6).
const OTHER_MANIFEST = (path) => /(^|\/)(package(-lock)?\.json|\.npmrc|\.yarnrc(\.yml)?|yarn\.lock|pnpm-lock\.yaml|npm-shrinkwrap\.json|pyproject\.toml|poetry\.lock|Pipfile(\.lock)?|bunfig\.toml|bun\.lockb?)$/.test(path)
  && path !== 'package.json' && path !== 'package-lock.json'
// Python 의존성(VPS 수집기 등 비밀값 있는 곳에서 설치됨): 새 이름·버전 고정 해제·패키지 출처 지정 줄만 승인 대상, 같은 이름 버전 변경은 자동.
const PY_REQ = (path) => /(^|\/)requirements[^/]*\.txt$/.test(path)
const pyName = (line) => (line.match(/^\s*([A-Za-z0-9][A-Za-z0-9._-]*)/)?.[1] ?? '').toLowerCase().replace(/[-_.]+/g, '-')
export function pythonReqRisks(f) {
  if (typeof f.patch !== 'string') return [`${f.filename}: 변경 내용을 받지 못함(판단 불가)`]
  const lines = f.patch.split('\n')
  const added = lines.filter((l) => l.startsWith('+') && !l.startsWith('+++')).map((l) => l.slice(1).split('#')[0].trim()).filter(Boolean)
  const removed = new Set(lines.filter((l) => l.startsWith('-') && !l.startsWith('---')).map((l) => pyName(l.slice(1))).filter(Boolean))
  const out = []
  for (const l of added) {
    if (/^(-|--)|:\/\/|@|git\+|\.whl\b|\.tar\.gz\b|^\.|^\//.test(l)) out.push(`${f.filename}: 패키지 출처·설치 방식 줄: ${l.slice(0, 80)}`)
    else if (!removed.has(pyName(l))) out.push(`${f.filename}: 새 의존성: ${pyName(l)}`)
    else if (!/[=<>~!]=?/.test(l)) out.push(`${f.filename}: 버전 고정 해제: ${pyName(l)}`)
  }
  return out
}
export const VERIFY_CONFIG = (path) => /^tsconfig[^/]*\.json$/.test(path) || /^scripts\/(?:run-tests|ts-extensionless-[^/]+)\.mjs$/.test(path)
  || /^\.npmrc$|^\.yarnrc(\.yml)?$/.test(path)
const isTestFile = (path) => /(^|\/)[^/]+\.test\.[cm]?[jt]sx?$|(^|\/)tests?\//.test(path)
const deps = (pkg) => Object.fromEntries(DEP_SECTIONS.flatMap((s) => Object.entries(pkg?.[s] ?? {})))
const lockPackages = (lock) => lock?.packages ?? {}

export function dependencyRisks({ files, basePkg, headPkg, baseLock, headLock }) {
  const out = []
  const list = files.map((f) => (typeof f === 'string' ? { filename: f, status: 'modified' } : f))
  const names = list.map((f) => f.filename)
  for (const f of list) {
    if (isTestFile(f.filename) && (f.status === 'removed' || f.status === 'renamed')) out.push(`시험 파일 ${f.status === 'removed' ? '삭제' : '이름 바꿈'}: ${f.filename}`)
    if (f.status === 'renamed' && f.previous_filename && isTestFile(f.previous_filename) && !isTestFile(f.filename)) out.push(`시험 파일이 시험 밖으로: ${f.previous_filename}`)
    if (VERIFY_CONFIG(f.filename)) out.push(`검증·설치 설정 변경: ${f.filename}`)
    if (OTHER_MANIFEST(f.filename) || (f.previous_filename && OTHER_MANIFEST(f.previous_filename))) out.push(`루트 밖 의존성·설치 설정 변경: ${f.filename}`)
    if (PY_REQ(f.filename)) out.push(...pythonReqRisks(f))
  }
  const pkgChanged = names.includes('package.json'), lockChanged = names.includes('package-lock.json')
  if (!pkgChanged && !lockChanged) return out
  if (!basePkg || !headPkg || (lockChanged && (!baseLock || !headLock))) return [...out, '의존성 파일 내용을 확인하지 못함(판단 불가)']
  const b = deps(basePkg), h = deps(headPkg)
  for (const [name, spec] of Object.entries(h)) {
    if (!(name in b)) out.push(`새 의존성: ${name}@${spec}`)
    else if (!plainRange(spec) && spec !== b[name]) out.push(`패키지 출처 변경: ${name} → ${spec}`)
  }
  for (const s of DEP_SECTIONS) for (const [name, spec] of Object.entries(headPkg[s] ?? {})) {
    if (name in b && !(name in (basePkg[s] ?? {}))) out.push(`의존성 구분 이동: ${name} → ${s}`)
  }
  const bs = basePkg.scripts ?? {}, hs = headPkg.scripts ?? {}
  for (const k of new Set([...Object.keys(bs), ...Object.keys(hs)])) {
    if (bs[k] === hs[k]) continue
    if (INSTALL_SCRIPTS.includes(k)) out.push(`설치 스크립트 변경: ${k}`)
    else if (!SAFE_SCRIPTS.includes(k)) out.push(`검사·빌드 명령 변경: scripts.${k}`)
  }
  for (const k of ['overrides', 'resolutions', 'workspaces', 'bundleDependencies', 'bundledDependencies', 'publishConfig', 'packageManager']) {
    if (JSON.stringify(basePkg[k] ?? null) !== JSON.stringify(headPkg[k] ?? null)) out.push(`패키지 출처·설치 방식 변경: ${k}`)
  }
  const bl = lockPackages(baseLock), hl = lockPackages(headLock)
  for (const [path, p] of Object.entries(hl)) {
    if (!path) continue
    const old = bl[path]
    if (p.hasInstallScript && !old?.hasInstallScript) out.push(`설치 스크립트가 있는 의존성: ${path.replace(/^node_modules\//, '')}`)
    if (p.resolved && !p.resolved.startsWith(REGISTRY) && p.resolved !== old?.resolved) out.push(`registry 밖에서 받는 의존성: ${path.replace(/^node_modules\//, '')} (${p.resolved.split('/')[2] ?? p.resolved})`)
    if (p.link && !old?.link) out.push(`로컬 연결 의존성: ${path}`)
    // 검토 2차 지적 7: 바뀌었거나 새로 생긴 항목은 registry 주소·정확한 버전이 있어야 한다(주소를 지우고 버전 칸에 git 주소를 넣는 우회 차단).
    if (JSON.stringify(p) !== JSON.stringify(old) && !p.link && !p.inBundle && !p.bundled) {
      if (!p.resolved || !/^\d+\.\d+\.\d+(-[0-9A-Za-z.-]+)?(\+[0-9A-Za-z.-]+)?$/.test(String(p.version ?? ''))) out.push(`lockfile 항목에 registry 주소·정확한 버전 없음: ${path.replace(/^node_modules\//, '')}`)
    }
    // 검토 지적 6: registry 주소여도 '다른 패키지 tarball'을 가리키게 바꿀 수 있다 → 주소의 패키지 이름·버전이 설치 경로·version과 같아야 한다.
    if (p.resolved?.startsWith(REGISTRY) && p.resolved !== old?.resolved) {
      const name = path.slice(path.lastIndexOf('node_modules/') + 'node_modules/'.length)
      const want = `${REGISTRY}${name}/-/${name.split('/').pop()}-${p.version}.tgz`
      if (p.resolved !== want) out.push(`lockfile 받는 파일이 이름·버전과 다름: ${name} (${p.resolved.slice(REGISTRY.length, REGISTRY.length + 80)})`)
    }
  }
  return [...new Set(out)]
}

export function approvedFramePaths(baselineSource) {
  return [...String(baselineSource ?? '').matchAll(/"path":\s*"([^"]+)"/g)].map((m) => m[1])
}
export const frameApproved = (path, framePaths) => framePaths.includes(path)
// ⑥ 위험도 판단 불가(S4, Lee 2026-11-15 "위험도를 명확히 판단할 수 없는 변경은 자동 보류"): 위 ①~⑤에 걸리지 않으면서
//    아래 '일반으로 확인된 곳'에도 없는 파일은 고위험으로 올려 Lee 승인 대상으로 둔다(새 최상위 폴더·배포/빌드 설정·서버 접속 파일 등).
//    일반 = 평소 작업(화면·서버 함수·수집기·운영 스크립트·규칙 데이터·시험·문서·DB migration — 파괴적 migration·STRICT 경로는 검사가 따로 막음).
//    목록은 '일반'을 적고 나머지를 판단 불가로 본다(새 파일 종류가 생겨도 빠뜨리지 않게 — 닫힌 실패).
export const NORMAL_PATH = (path) => [
  /^src\//, /^api\//, /^public\//, /^crawler\//, /^scripts\//, /^policy\//, /^test-fixtures\//, /^data\//,
  /^docs\//, /^supabase\/(?:migrations|tests|pending)\//,
  /^[A-Za-z0-9_-]+\.md$/, /^\.claude\/RULES_CORE\.md$/, /^tsconfig\.tsbuildinfo$/, /^package(?:-lock)?\.json$/,
].some((re) => re.test(path))

// ⑦ 바뀐 줄 내용 위험(S4, Lee 2026-11-15 "파일 경로 + 실제 바뀐 줄 내용으로 판정"): 경로가 일반이어도 코드 파일의 추가·삭제된 줄에
//    DB 권한(RLS·policy·grant·security definer)·인증/비밀값(service_role·토큰·Authorization)·실행(exec·eval)·새 외부 주소가 있으면 고위험.
//    코드 파일인데 변경 내용(patch)을 받지 못했으면(큰 변경·잘림) 판단 불가 → 닫힌 실패. 문서·데이터·시험 파일은 내용 검사 대상이 아님(시험 약화는 ⑤가 봄).
const CODE_EXT = /\.(?:[cm]?[jt]sx?|py|sql|sh|ya?ml)$/
const CONTENT_SCAN = (path) => CODE_EXT.test(path) && !/(^|\/)[^/]+\.test\.[cm]?[jt]sx?$|(^|\/)test_[^/]+\.py$|(^|\/)[^/]+_test\.py$|\.fixtures?\.[^/]+$|(^|\/)(?:tests?|fixtures?)\/|^docs\/|^test-fixtures\//.test(path)
export const CONTENT_SIGNALS = [
  ['DB 권한·보안 설정', /\b(?:create|alter|drop)\s+(?:or\s+replace\s+)?(?:policy|role|user|extension)\b|row\s+level\s+security|\b(?:grant|revoke)\s+\w|security\s+definer|\bauth\.(?:users|uid\(|jwt\(|role\()|\bset\s+role\b|pgsodium|vault\./i],
  ['인증·비밀값', /service_role|SERVICE_ROLE|\bauth\.admin\b|\.auth\.admin\b|verify_jwt|jsonwebtoken|\bjwt\.(?:sign|verify)\b|\bAuthorization\b\s*[:=]|\bBearer\s+\$|process\.env\.[A-Za-z0-9_]*(?:KEY|SECRET|TOKEN|PASSWORD|PASSWD)\b|os\.environ(?:\.get)?\W+["'][A-Za-z0-9_]*(?:KEY|SECRET|TOKEN|PASSWORD)\b|secrets\.[A-Z_]+|-----BEGIN [A-Z ]*PRIVATE KEY|timingSafeEqual|createHmac|signInWith|resetPasswordForEmail/],
  ['명령 실행·위험 API', /\bchild_process\b|\bexec(?:Sync|File|FileSync)?\s*\(|\bspawn(?:Sync)?\s*\(|\beval\s*\(|new\s+Function\s*\(|dangerouslySetInnerHTML|\.innerHTML\s*=|\bos\.system\b|\bsubprocess\.|\bpickle\.loads?\b|Access-Control-Allow-Origin/],
]
// 이미 쓰는 것으로 확인된 외부 주소(표준·문서·이 서비스가 쓰는 지도/DB/배포/소셜) — 이 밖의 새 주소가 추가되면 '새 외부 API'로 본다
const KNOWN_HOSTS = /(?:^|\.)(?:w3\.org|schema\.org|github\.com|githubusercontent\.com|npmjs\.org|npmjs\.com|supabase\.co|supabase\.com|vercel\.app|vercel\.com|viecganban\.vn|vietmap\.vn|google\.com|googleapis\.com|gstatic\.com|google-analytics\.com|openstreetmap\.org|facebook\.com|fb\.com|zalo\.me|anthropic\.com|openai\.com|cloudflare\.com|example\.(?:com|org)|localhost|127\.0\.0\.1)$/i
const hostsOf = (text) => [...String(text).matchAll(/https?:\/\/([A-Za-z0-9.-]+)/g)].map((m) => m[1].toLowerCase())
export function contentRisks(files) {
  const out = []
  for (const f of files) {
    if (typeof f === 'string') continue  // 이름만 있는 목록(예전 호출·시험)은 내용을 볼 수 없다 — 실제 호출(CLI)은 항상 patch가 든 목록
    const name = f.filename
    if (!CONTENT_SCAN(name)) continue
    if (typeof f.patch !== 'string') {
      // 이름만 바뀐 파일(변경 0줄)은 내용이 같다 — 그 밖에 patch가 없으면 읽지 못한 것
      if (f.status === 'renamed' && f.changes === 0) continue
      out.push(`${name}: 변경 내용을 받지 못함(판단 불가)`); continue
    }
    const lines = f.patch.split('\n').filter((l) => /^[+-]/.test(l) && !/^(?:\+\+\+|---)/.test(l))
    const text = lines.map((l) => l.slice(1)).join('\n')
    for (const [label, re] of CONTENT_SIGNALS) if (re.test(text)) out.push(`${name}: ${label}`)
    const before = new Set(hostsOf(lines.filter((l) => l[0] === '-').join('\n')))
    for (const h of new Set(hostsOf(lines.filter((l) => l[0] === '+').join('\n')))) if (!KNOWN_HOSTS.test(h) && !before.has(h)) out.push(`${name}: 새 외부 주소 ${h}`)
  }
  return out
}

// ⑧ 고위험·판단 불가 PR 본문의 4대 보고: 무엇을 바꾸나 / 왜 필요한가 / 승인 시 남는 위험 / 미승인 시 영향 + 검증 링크(실행 기록·커밋·PR 주소).
//    칸마다 실제 내용이 있어야 한다(빈 칸·'-'·TODO·'…' 제외). 보고가 없으면 Lee 승인이 있어도 이 판정은 통과하지 않고, 봇은 Lee 승인 요청 대신 보고 요청을 남긴다.
export const REPORT_FIELDS = ['무엇을 바꾸나', '왜 필요한가', '승인 시 남는 위험', '미승인 시 영향']
export function highRiskReport(body, repo = '') {
  const text = String(body ?? '').replace(/<!--[\s\S]*?-->/g, '')
  const section = text.split(/^## 고위험 4대 보고[^\n]*\n/m)[1]?.split(/^## /m)[0] ?? ''
  const missing = []
  for (const k of REPORT_FIELDS) {
    const m = section.match(new RegExp(`^[-*][ \\t]*${k}[ \\t]*:[ \\t]*(.*)$`, 'm'))
    const v = (m?.[1] ?? '').trim()
    if (v.replace(/[\s\-—_.…]/g, '').length < 4 || /^(?:todo|tbd|미정|작성 ?예정)/i.test(v)) missing.push(k)
  }
  const origin = `https://github.com/${repo || '[^/\\s]+/[^/\\s]+'}/`
  const link = new RegExp(`${repo ? origin.replace(/[.*+?^${}()|[\]\\]/g, '\\$&') : origin}(?:actions/runs/\\d+|pull/\\d+|commit/[0-9a-f]{7,40}|issues/\\d+)`)
  if (!link.test(section)) missing.push('검증 링크(실행 기록·커밋·PR 주소)')
  return { ok: !missing.length, missing }
}

// 유효한 Lee 승인 하나의 판정(S4-4, Lee 2026-11-15 승인 조건 ③): Lee 계정의 '마지막 결정 리뷰'(승인·변경 요청·철회 — 의견만 단 리뷰는 제외)가
// 승인(APPROVED)이고 그 리뷰가 지금 head 커밋에 대한 것이어야 한다. 예전 커밋 승인·승인 뒤 변경 요청은 무효. PR 작성자가 Lee 계정이면 자기 승인이라 무효.
export function leeApprovedAt(reviews = [], sha, author) {
  if (!sha || !author || author === OWNER) return false  // 작성자를 모르면 자기 승인인지 알 수 없어 승인 없음(닫힌 실패)
  const decisive = reviews.filter((r) => r.user?.login === OWNER && ['APPROVED', 'CHANGES_REQUESTED', 'DISMISSED'].includes(r.state))
    .sort((x, y) => String(x.submitted_at ?? '').localeCompare(String(y.submitted_at ?? '')))
  const last = decisive[decisive.length - 1]
  return !!last && last.state === 'APPROVED' && last.commit_id === sha
}

export function decisionApproval({ files, reviews, comments, sha, labels = [], framePaths = [], deps: depFiles = {}, author, body = '', repo = '' }) {
  const names = files.map((f) => f.filename ?? f)
  const decision = names.filter(PROTECTED)
  const frame = names.filter((f) => !PROTECTED(f) && frameApproved(f, framePaths))
  const gate = names.filter((f) => !PROTECTED(f) && GATE_CODE(f))
  const unknown = names.filter((f) => !PROTECTED(f) && !frameApproved(f, framePaths) && !GATE_CODE(f) && !NORMAL_PATH(f))
  const labeled = labels.includes(NEEDS_LEE_LABEL)
  const depRisk = dependencyRisks({ files, ...depFiles })
  // 경로만으로 이미 고위험인 파일(결정 문서·화면 틀·검사 장치)은 내용 검사를 겹치지 않는다
  const content = contentRisks(files.filter((f) => { const n = f.filename ?? f; return !PROTECTED(n) && !frameApproved(n, framePaths) && !GATE_CODE(n) }))
  const unreadable = content.filter((c) => c.endsWith('(판단 불가)')), realContent = content.filter((c) => !c.endsWith('(판단 불가)'))
  // 변경 파일 목록이 비어 있으면 분석이 실패한 것이다(PR은 항상 파일을 바꾼다) — 닫힌 실패
  const empty = names.length === 0
  const touched = [...decision, ...frame, ...gate, ...depRisk, ...content, ...unknown, ...(empty ? ['(변경 파일 목록 비어 있음)'] : [])]
  if (!touched.length && !labeled) return { required: false, approved: true, touched, reasons: [], risk: 'normal' }
  const report = highRiskReport(body, repo)
  // 4대 보고가 없으면 Lee 승인이 있어도 통과하지 않는다(승인할 내용이 설명되지 않은 PR)
  const ok = leeApprovedAt(reviews, sha, author) && report.ok
  const reasons = [...(decision.length ? ['결정 문서'] : []), ...(frame.length ? ['승인된 화면 틀'] : []), ...(gate.length ? ['검사·보호 장치'] : []), ...(depRisk.length ? ['의존성·검증 약화'] : []), ...(realContent.length ? ['변경 내용 위험(DB 권한·인증·실행·외부 주소)'] : []), ...(unknown.length || empty || unreadable.length ? ['위험도 판단 불가'] : []), ...(labeled ? ['needs-lee 라벨'] : [])]
  return { required: true, approved: ok, touched, reasons, changed: names, report, leeApproved: leeApprovedAt(reviews, sha, author), risk: decision.length || frame.length || gate.length || depRisk.length || realContent.length || labeled ? 'high' : 'unknown' }
}

export const REQUEST_MARKER = '<!-- decision-approval-request -->'
// S4 9회 지적 3: 승인할 때 무엇이 바뀌었는지 보이게 — 라벨만으로 대상이 된 PR도 이 커밋의 바뀐 파일 전체를 적는다(최대 40개 + 나머지 개수)
// 댓글에 넣는 파일 이름: 코드 칸 안(@ 알림 없음), 백틱·줄바꿈 지움, '<'·'>'는 바꿔서 <!-- 표시 --> 위조 불가(10회 지적 — 표시는 contains()로 찾는 곳이 있음), 200자까지
export const safeName = (f) => String(f).replace(/[`\r\n]/g, '').replace(/</g, '‹').replace(/>/g, '›').slice(0, 200)
export function changedList(changed = []) {
  if (!changed.length) return ''
  const shown = changed.slice(0, 40).map((f) => `- \`${safeName(f)}\``).join('\n')
  return `\n바뀐 파일 ${changed.length}개:\n${shown}${changed.length > 40 ? `\n- …그 밖 ${changed.length - 40}개` : ''}`
}
export function requestText(sha, touched, reasons = ['결정 문서'], changed = []) {
  return `${REQUEST_MARKER}\nLee 승인 필요: 이 PR은 ${reasons.join('·')} 대상입니다${touched.length ? `(${touched.slice(0, 20).map((f) => `\`${safeName(f)}\``).join(', ')}${touched.length > 20 ? ' 등' : ''})` : ''}. ` +
    `내용을 확인하고 승인하시면 병합됩니다. 승인 전에는 자동 병합하지 않습니다.\n` +
    `승인 방법: GitHub 앱에서 이 PR을 열고 이 커밋(${sha.slice(0, 7)})에 "Approve" 리뷰. 댓글 승인은 인정하지 않습니다.` +
    changedList(changed)
}

export const REPORT_REQUEST_MARKER = '<!-- decision-report-request -->'
export const reportRequestText = (sha, reasons, missing) =>
  `${REPORT_REQUEST_MARKER}\n이 PR(${sha.slice(0, 7)})은 ${reasons.join('·')} 대상이라 Lee 승인이 필요하지만, 승인 요청 전에 PR 본문의 "## 고위험 4대 보고" 칸이 필요합니다. ` +
  `없는 항목: ${missing.join(', ')}. 형식: "- 무엇을 바꾸나: …", "- 왜 필요한가: …", "- 승인 시 남는 위험: …", "- 미승인 시 영향: …" 네 줄과 검증 링크(이 저장소의 actions/runs·pull·commit 주소) 한 개 이상. 본문을 고치면 자동으로 다시 봅니다.`

// CLI (trusted master checkout in bot-pr-automerge.yml): files.json reviews.json comments.json sha
if (process.argv[1]?.endsWith('decision-approval-gate.mjs')) {
  const { readFileSync } = await import('node:fs')
  const [files, reviews, comments] = process.argv.slice(2, 5).map((p) => JSON.parse(readFileSync(p, 'utf8')))
  const sha = process.argv[5]
  // 선택 인자: 라벨 이름 목록 JSON(자리 6). 잠긴 화면 파일 목록은 master의 기존 잠금 파일에서 읽는다.
  const labels = process.argv[6] ? JSON.parse(readFileSync(process.argv[6], 'utf8')) : []
  // 선택 인자 7: {basePkg, headPkg, baseLock, headLock} JSON(package.json·lockfile이 바뀐 PR이면 병합 실행기가 기준·head 내용을 넣는다. 없으면 닫힌 실패)
  const depFiles = process.argv[7] ? JSON.parse(readFileSync(process.argv[7], 'utf8')) : {}
  let framePaths = []
  try { framePaths = approvedFramePaths(readFileSync(new URL('./test-desktop-baseline.mjs', import.meta.url), 'utf8')) } catch { /* 잠금 파일을 못 읽으면 닫힌 실패 */ process.exit(3) }
  // 인자 8: PR 작성자 로그인(병합 실행기가 넘김). 비어 있으면 leeApprovedAt이 승인 없음으로 본다(닫힌 실패, S4-4).
  const author = process.argv[8] ?? ''
  // 인자 9: PR 본문 파일(4대 보고 확인), 인자 10: owner/repo(검증 링크 주소 확인). 못 읽으면 빈 본문 → 보고 없음으로 막힘(닫힌 실패).
  let body = ''
  try { if (process.argv[9]) body = readFileSync(process.argv[9], 'utf8') } catch { body = '' }
  const r = decisionApproval({ files, reviews, comments, sha, labels, framePaths, deps: depFiles, author, body, repo: process.argv[10] ?? '' })
  // 승인 요청은 4대 보고가 갖춰진 뒤에만 한다 — 보고가 없으면 보고를 먼저 요청(Lee에게 설명 없는 승인 요청을 보내지 않음)
  if (!r.approved) console.log(r.report && !r.report.ok ? reportRequestText(sha, r.reasons, r.report.missing) : requestText(sha, r.touched, r.reasons, r.changed))
  process.exit(r.approved ? 0 : 3)
}
