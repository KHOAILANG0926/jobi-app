// 결정 0003 강제 보강(Lee 2026-10-28, 방법 A): 결정 문서(docs/decisions/)나 .github/CODEOWNERS를 바꾼 PR은
// 현재 head 커밋에 대한 Lee 계정(KHOAILANG0926) 승인이 있어야 봇이 병합한다. 다른 PR은 영향 없음.
// master 보호 설정이 승인 수 0이라 코드 소유자 승인이 실제로 막지 못한 문제(2026-10-28 #295)의 보완이다.
// 승인 근거: ① 현재 head SHA에 대한 APPROVED 리뷰, 또는 ② PR 작성자가 Lee 계정이라 리뷰가 불가능할 때
//   Lee 계정 댓글 "LEE-APPROVE <현재 head SHA 전체>". 다른 SHA에 대한 승인은 무효(새 커밋이 오면 다시 승인).
export const OWNER = 'KHOAILANG0926'
export const PROTECTED = (path) => path.startsWith('docs/decisions/') || path === '.github/CODEOWNERS'

export function decisionApproval({ files, reviews, comments, sha }) {
  const touched = files.map((f) => f.filename ?? f).filter(PROTECTED)
  if (!touched.length) return { required: false, approved: true, touched }
  const review = reviews.some((r) => r.user?.login === OWNER && r.state === 'APPROVED' && r.commit_id === sha)
  const comment = comments.some((c) => c.user?.login === OWNER && String(c.body ?? '').trim() === `LEE-APPROVE ${sha}`)
  return { required: true, approved: review || comment, touched }
}

export const REQUEST_MARKER = '<!-- decision-approval-request -->'
export function requestText(sha, touched) {
  return `${REQUEST_MARKER}\nLee 승인 필요: 이 PR은 결정 문서를 바꿉니다(${touched.join(', ')}). ` +
    `내용을 확인하고 승인하시면 병합됩니다. 승인 전에는 자동 병합하지 않습니다.\n` +
    `승인 방법: 이 커밋(${sha.slice(0, 7)})에 대한 "Approve" 리뷰, 또는 댓글 \`LEE-APPROVE ${sha}\`.`
}

// CLI (trusted master checkout in bot-pr-automerge.yml): files.json reviews.json comments.json sha
if (process.argv[1]?.endsWith('decision-approval-gate.mjs')) {
  const { readFileSync } = await import('node:fs')
  const [files, reviews, comments] = process.argv.slice(2, 5).map((p) => JSON.parse(readFileSync(p, 'utf8')))
  const sha = process.argv[5]
  const r = decisionApproval({ files, reviews, comments, sha })
  if (!r.approved) console.log(requestText(sha, r.touched))
  process.exit(r.approved ? 0 : 3)
}
