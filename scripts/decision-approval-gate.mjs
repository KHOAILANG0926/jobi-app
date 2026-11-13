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
export function approvedFramePaths(baselineSource) {
  return [...String(baselineSource ?? '').matchAll(/"path":\s*"([^"]+)"/g)].map((m) => m[1])
}
export const frameApproved = (path, framePaths) => framePaths.includes(path)

export function decisionApproval({ files, reviews, comments, sha, labels = [], framePaths = [] }) {
  const names = files.map((f) => f.filename ?? f)
  const decision = names.filter(PROTECTED)
  const frame = names.filter((f) => !PROTECTED(f) && frameApproved(f, framePaths))
  const labeled = labels.includes(NEEDS_LEE_LABEL)
  const touched = [...decision, ...frame]
  if (!touched.length && !labeled) return { required: false, approved: true, touched, reasons: [] }
  const review = reviews.some((r) => r.user?.login === OWNER && r.state === 'APPROVED' && r.commit_id === sha)
  const first = (c) => String(c.body ?? '').split('\n')[0].trim()
  const approveComment = comments.some((c) => c.user?.login === OWNER && String(c.body ?? '').trim() === `LEE-APPROVE ${sha}`)
  const demoComment = comments.some((c) => c.user?.login === OWNER && first(c) === `LEE-DEMO-APPLY ${sha}`)
  // 결정 문서는 LEE-DEMO-APPLY를 인정하지 않는다(데모 적용 표시는 화면 틀 승인용).
  const reasons = [...(decision.length ? ['결정 문서'] : []), ...(frame.length ? ['승인된 화면 틀'] : []), ...(labeled ? ['needs-lee 라벨'] : [])]
  const ok = decision.length ? (review || approveComment) : (review || approveComment || demoComment)
  return { required: true, approved: ok, touched, reasons }
}

export const REQUEST_MARKER = '<!-- decision-approval-request -->'
export function requestText(sha, touched, reasons = ['결정 문서']) {
  return `${REQUEST_MARKER}\nLee 승인 필요: 이 PR은 ${reasons.join('·')} 대상입니다${touched.length ? `(${touched.join(', ')})` : ''}. ` +
    `내용을 확인하고 승인하시면 병합됩니다. 승인 전에는 자동 병합하지 않습니다.\n` +
    `승인 방법: 이 커밋(${sha.slice(0, 7)})에 대한 "Approve" 리뷰, 또는 댓글 \`LEE-APPROVE ${sha}\`.`
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
