// 결정 0003 강제 보강(Lee 2026-10-28, 방법 A): 결정 문서(docs/decisions/)나 .github/CODEOWNERS를 바꾼 PR은
// 현재 head 커밋에 대한 Lee 계정(KHOAILANG0926) 승인이 있어야 봇이 병합한다. 다른 PR은 영향 없음.
// master 보호 설정이 승인 수 0이라 코드 소유자 승인이 실제로 막지 못한 문제(2026-10-28 #295)의 보완이다.
// 승인 근거: ① 현재 head SHA에 대한 APPROVED 리뷰, 또는 ② PR 작성자가 Lee 계정이라 리뷰가 불가능할 때
//   Lee 계정 댓글 "LEE-APPROVE <현재 head SHA 전체>". 다른 SHA에 대한 승인은 무효(새 커밋이 오면 다시 승인).
export const OWNER = 'KHOAILANG0926'
export const PROTECTED = (path) => path.startsWith('docs/decisions/') || path === '.github/CODEOWNERS'
// R2 자동 병합 통제 강화(Lee 2026-11-13 승인): 승인 대상은 파일 내용으로 자동 감지한다 — 라벨·Claude 답글·작성자 말이 아니라 실제 변경 파일이 기준이라 라벨을 빼거나 답글을 달아도 우회되지 않는다.
//  ① 결정 문서·CODEOWNERS(기존, 결정 0003): Lee 승인 리뷰 또는 `LEE-APPROVE <sha>`만 인정(작업자가 달지 않는 표시)
//  ② 승인된 PC 화면 틀(기존 잠금 scripts/test-desktop-baseline.mjs의 파일 목록 — 목록을 따로 만들지 않고 그 파일에서 읽음, CLAUDE.md '승인된 공고 틀 보존'):
//     Lee 승인 리뷰, `LEE-APPROVE <sha>`, 또는 Lee가 채팅에서 "적용"한 데모의 `LEE-DEMO-APPLY <sha>`(첫 줄)
//  ③ `needs-lee` 라벨이 붙은 PR(이슈 라벨 정의: Lee 결정 대기): 같은 승인이 현재 head에 있어야 병합
// 한계: 이 저장소의 자동화·세션은 Lee 계정 열쇠를 쓰므로 승인 댓글을 사람이 달았는지 AI가 달았는지는 GitHub 기록으로 구분되지 않는다(계정 분리는 별도 승인 사항).
export const NEEDS_LEE_LABEL = 'needs-lee'
// R3 승인 우회 해소(Lee 2026-11-13 승인): 이 검사는 PR 검사(checks, 필수)에서도 같은 판정으로 돈다 — 봇·수동 병합 모두 통과해야 한다.
//  ④ 승인 장치 자체(이 검사·그 시험·PR 검사/봇 워크플로·화면 잠금 목록)를 바꾸는 PR은 결정 문서와 같은 문턱(LEE-DEMO-APPLY 불인정) — 검사를 지우거나 약하게 하는 PR이 스스로 통과하지 못하게.
//  ⑤ needs-lee 라벨은 '지금 붙어 있음'이 아니라 '한 번이라도 붙었음'(이슈 이벤트 기록)으로 본다 — 라벨을 지워도 승인 요구가 남는다. 라벨 이력을 못 읽으면 보류.
//  PR 본문·작성자 말은 읽지 않는다(자기신고 무효). 검사는 master의 파일로 돌려(워크플로) PR이 검사 자체를 고쳐 통과할 수 없게 한다.
export const MACHINERY = ['scripts/decision-approval-gate.mjs', 'scripts/decision-approval-gate.test.mjs', 'scripts/test-desktop-baseline.mjs',
  '.github/workflows/pr-checks.yml', '.github/workflows/bot-pr-automerge.yml']
export function approvedFramePaths(baselineSource) {
  return [...String(baselineSource ?? '').matchAll(/"path":\s*"([^"]+)"/g)].map((m) => m[1])
}
export const frameApproved = (path, framePaths) => framePaths.includes(path)

export function decisionApproval({ files, reviews, comments, sha, labels = [], framePaths = [], labelEvents = [] }) {
  const names = files.map((f) => f.filename ?? f)
  const decision = names.filter(PROTECTED)
  const machinery = names.filter((f) => MACHINERY.includes(f))
  const frame = names.filter((f) => !PROTECTED(f) && !MACHINERY.includes(f) && frameApproved(f, framePaths))
  const labeled = labels.includes(NEEDS_LEE_LABEL) || labelEvents.some((e) => e.event === 'labeled' && e.label?.name === NEEDS_LEE_LABEL)
  const touched = [...decision, ...machinery, ...frame]
  if (!touched.length && !labeled) return { required: false, approved: true, touched, reasons: [] }
  const review = reviews.some((r) => r.user?.login === OWNER && r.state === 'APPROVED' && r.commit_id === sha)
  const first = (c) => String(c.body ?? '').split('\n')[0].trim()
  const approveComment = comments.some((c) => c.user?.login === OWNER && String(c.body ?? '').trim() === `LEE-APPROVE ${sha}`)
  const demoComment = comments.some((c) => c.user?.login === OWNER && first(c) === `LEE-DEMO-APPLY ${sha}`)
  // 결정 문서는 LEE-DEMO-APPLY를 인정하지 않는다(데모 적용 표시는 화면 틀 승인용).
  const reasons = [...(decision.length ? ['결정 문서'] : []), ...(machinery.length ? ['승인 장치'] : []), ...(frame.length ? ['승인된 화면 틀'] : []), ...(labeled ? ['needs-lee 라벨'] : [])]
  const ok = (decision.length || machinery.length) ? (review || approveComment) : (review || approveComment || demoComment)
  return { required: true, approved: ok, touched, reasons }
}

export const REQUEST_MARKER = '<!-- decision-approval-request -->'
export function requestText(sha, touched, reasons = ['결정 문서']) {
  return `${REQUEST_MARKER}\nLee 승인 필요: 이 PR은 ${reasons.join('·')} 대상입니다${touched.length ? `(${touched.join(', ')})` : ''}. ` +
    `내용을 확인하고 승인하시면 병합됩니다. 승인 전에는 자동 병합하지 않습니다.\n` +
    `승인 방법: 이 커밋(${sha.slice(0, 7)})에 대한 "Approve" 리뷰, 또는 댓글 \`LEE-APPROVE ${sha}\`.`
}

// PR 검사(checks)용 입력 읽기: 승인 판정에 쓰는 GitHub 기록(변경 파일·리뷰·댓글·라벨·라벨 이력·head SHA)만 읽는다. 하나라도 못 읽으면 판정하지 않는다(보류).
export function fetchPrInputs({ repo, pr, gh, headSha }) {
  const list = (path) => { const pages = JSON.parse(gh(['api', '--paginate', '--slurp', path])); return pages.flat() }
  const files = list(`repos/${repo}/pulls/${pr}/files?per_page=100`)
  const reviews = list(`repos/${repo}/pulls/${pr}/reviews?per_page=100`)
  const comments = list(`repos/${repo}/issues/${pr}/comments?per_page=100`)
  const labelEvents = list(`repos/${repo}/issues/${pr}/events?per_page=100`)
  const issue = JSON.parse(gh(['api', `repos/${repo}/issues/${pr}`]))
  const labels = (issue.labels ?? []).map((l) => l.name)
  const sha = headSha || JSON.parse(gh(['api', `repos/${repo}/pulls/${pr}`])).head?.sha
  if (!sha || !Array.isArray(files) || !Array.isArray(reviews) || !Array.isArray(comments) || !Array.isArray(labelEvents)) throw new Error('incomplete GitHub records')
  return { files, reviews, comments, labels, labelEvents, sha }
}
// 종료 코드: 0 통과 / 3 승인 필요 / 4 승인 확인 불가(보류) — 둘 다 병합을 막는다.
export function runPr({ repo, pr, gh, headSha, framePaths, log = console.log }) {
  let inputs
  try { inputs = fetchPrInputs({ repo, pr, gh, headSha }) } catch (e) { log(`승인 확인 불가 — 보류: ${String(e.message).slice(0, 200)}`); return 4 }
  const r = decisionApproval({ ...inputs, framePaths })
  if (r.approved) { log(r.required ? `Lee 승인 확인됨(${r.reasons.join('·')}, head ${inputs.sha.slice(0, 7)})` : '승인 대상 아님'); return 0 }
  log(requestText(inputs.sha, r.touched, r.reasons) + '\n승인 댓글을 단 뒤에는 이 검사(checks)를 다시 실행해야 통과로 바뀝니다.')
  return 3
}

// CLI (trusted master checkout in bot-pr-automerge.yml / pr-checks.yml): files.json reviews.json comments.json sha [labels.json] | --pr <번호>
if (process.argv[1]?.endsWith('decision-approval-gate.mjs')) {
  const { readFileSync } = await import('node:fs')
  let framePaths = []
  try { framePaths = approvedFramePaths(readFileSync(new URL('./test-desktop-baseline.mjs', import.meta.url), 'utf8')) } catch { /* 잠금 파일을 못 읽으면 닫힌 실패 */ process.exit(3) }
  if (process.argv[2] === '--pr') {
    const { execFileSync } = await import('node:child_process')
    const repo = process.env.REPO || process.env.GITHUB_REPOSITORY
    const pr = Number(process.argv[3])
    if (!repo || !Number.isSafeInteger(pr) || pr <= 0) { console.log('승인 확인 불가 — 보류: 저장소·PR 번호 없음'); process.exit(4) }
    process.exit(runPr({ repo, pr, headSha: process.env.HEAD_SHA, framePaths,
      gh: (args) => execFileSync('gh', args, { encoding: 'utf8', maxBuffer: 64 * 1024 * 1024 }) }))
  }
  const [files, reviews, comments] = process.argv.slice(2, 5).map((p) => JSON.parse(readFileSync(p, 'utf8')))
  const sha = process.argv[5]
  // 선택 인자: 라벨 이름 목록 JSON(자리 6). 잠긴 화면 파일 목록은 master의 기존 잠금 파일에서 읽는다.
  const labels = process.argv[6] ? JSON.parse(readFileSync(process.argv[6], 'utf8')) : []
  const r = decisionApproval({ files, reviews, comments, sha, labels, framePaths })
  if (!r.approved) console.log(requestText(sha, r.touched, r.reasons))
  process.exit(r.approved ? 0 : 3)
}
