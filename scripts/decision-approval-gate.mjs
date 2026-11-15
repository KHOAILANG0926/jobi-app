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

// 유효한 Lee 승인 하나의 판정(S4-4, Lee 2026-11-15 승인 조건 ③): Lee 계정의 '마지막 결정 리뷰'(승인·변경 요청·철회 — 의견만 단 리뷰는 제외)가
// 승인(APPROVED)이고 그 리뷰가 지금 head 커밋에 대한 것이어야 한다. 예전 커밋 승인·승인 뒤 변경 요청은 무효. PR 작성자가 Lee 계정이면 자기 승인이라 무효.
export function leeApprovedAt(reviews = [], sha, author) {
  if (!sha || !author || author === OWNER) return false  // 작성자를 모르면 자기 승인인지 알 수 없어 승인 없음(닫힌 실패)
  const decisive = reviews.filter((r) => r.user?.login === OWNER && ['APPROVED', 'CHANGES_REQUESTED', 'DISMISSED'].includes(r.state))
    .sort((x, y) => String(x.submitted_at ?? '').localeCompare(String(y.submitted_at ?? '')))
  const last = decisive[decisive.length - 1]
  return !!last && last.state === 'APPROVED' && last.commit_id === sha
}

export function decisionApproval({ files, reviews, comments, sha, labels = [], framePaths = [], deps: depFiles = {}, author }) {
  const names = files.map((f) => f.filename ?? f)
  const decision = names.filter(PROTECTED)
  const frame = names.filter((f) => !PROTECTED(f) && frameApproved(f, framePaths))
  const gate = names.filter((f) => !PROTECTED(f) && GATE_CODE(f))
  const labeled = labels.includes(NEEDS_LEE_LABEL)
  const depRisk = dependencyRisks({ files, ...depFiles })
  const touched = [...decision, ...frame, ...gate, ...depRisk]
  if (!touched.length && !labeled) return { required: false, approved: true, touched, reasons: [] }
  const ok = leeApprovedAt(reviews, sha, author)
  const reasons = [...(decision.length ? ['결정 문서'] : []), ...(frame.length ? ['승인된 화면 틀'] : []), ...(gate.length ? ['검사·보호 장치'] : []), ...(depRisk.length ? ['의존성·검증 약화'] : []), ...(labeled ? ['needs-lee 라벨'] : [])]
  return { required: true, approved: ok, touched, reasons, changed: names }
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
  const r = decisionApproval({ files, reviews, comments, sha, labels, framePaths, deps: depFiles, author })
  if (!r.approved) console.log(requestText(sha, r.touched, r.reasons, r.changed))
  process.exit(r.approved ? 0 : 3)
}
