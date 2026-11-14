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
export function approvedFramePaths(baselineSource) {
  return [...String(baselineSource ?? '').matchAll(/"path":\s*"([^"]+)"/g)].map((m) => m[1])
}
export const frameApproved = (path, framePaths) => framePaths.includes(path)

export function decisionApproval({ files, reviews, comments, sha, labels = [], framePaths = [] }) {
  const names = files.map((f) => f.filename ?? f)
  const decision = names.filter(PROTECTED)
  const frame = names.filter((f) => !PROTECTED(f) && frameApproved(f, framePaths))
  const gate = names.filter((f) => !PROTECTED(f) && GATE_CODE(f))
  const labeled = labels.includes(NEEDS_LEE_LABEL)
  const touched = [...decision, ...frame, ...gate]
  if (!touched.length && !labeled) return { required: false, approved: true, touched, reasons: [] }
  const ok = reviews.some((r) => r.user?.login === OWNER && r.state === 'APPROVED' && r.commit_id === sha)
  const reasons = [...(decision.length ? ['결정 문서'] : []), ...(frame.length ? ['승인된 화면 틀'] : []), ...(gate.length ? ['검사·보호 장치'] : []), ...(labeled ? ['needs-lee 라벨'] : [])]
  return { required: true, approved: ok, touched, reasons }
}

export const REQUEST_MARKER = '<!-- decision-approval-request -->'
export function requestText(sha, touched, reasons = ['결정 문서']) {
  return `${REQUEST_MARKER}\nLee 승인 필요: 이 PR은 ${reasons.join('·')} 대상입니다${touched.length ? `(${touched.join(', ')})` : ''}. ` +
    `내용을 확인하고 승인하시면 병합됩니다. 승인 전에는 자동 병합하지 않습니다.\n` +
    `승인 방법: GitHub 앱에서 이 PR을 열고 이 커밋(${sha.slice(0, 7)})에 "Approve" 리뷰. 댓글 승인은 인정하지 않습니다.`
}

// CLI (trusted master checkout in bot-pr-automerge.yml): files.json reviews.json comments.json sha
if (process.argv[1]?.endsWith('decision-approval-gate.mjs')) {
  const { readFileSync } = await import('node:fs')
  const [files, reviews, comments] = process.argv.slice(2, 5).map((p) => JSON.parse(readFileSync(p, 'utf8')))
  const sha = process.argv[5]
  // 선택 인자: 라벨 이름 목록 JSON(자리 6). 잠긴 화면 파일 목록은 master의 기존 잠금 파일에서 읽는다.
  const labels = process.argv[6] ? JSON.parse(readFileSync(process.argv[6], 'utf8')) : []
  let framePaths = []
  try { framePaths = approvedFramePaths(readFileSync(new URL('./test-desktop-baseline.mjs', import.meta.url), 'utf8')) } catch { /* 잠금 파일을 못 읽으면 닫힌 실패 */ process.exit(3) }
  const r = decisionApproval({ files, reviews, comments, sha, labels, framePaths })
  if (!r.approved) console.log(requestText(sha, r.touched, r.reasons))
  process.exit(r.approved ? 0 : 3)
}
