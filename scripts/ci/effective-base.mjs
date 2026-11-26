// PR 검사가 '이 PR이 바꾼 파일'을 셀 때 쓸 기준 커밋을 한 곳에서 계산한다(2026-11-26, 통합 운영 정상화 J그룹).
// 문제: pull_request 검사의 HEAD는 GitHub이 만든 병합본(첫째 부모 = 그때의 기준 브랜치 끝)인데, 이벤트의 base.sha는 이벤트 때 값이다.
//   이벤트 뒤 기준 브랜치가 앞으로 가면(수집 작업이 몇 분마다 커밋함) `git diff <이벤트 base.sha> HEAD`에 남(크롤러·다른 PR)이 한 변경이 이 PR의 변경으로 섞인다
//   (#1074 checks run 45731277070: 00:45에 master에 들어간 crawler 시험 수정이 '기존 줄 수정'으로 잘못 차단됨).
// 해결: ① HEAD가 부모 둘인 병합본이고 ② 둘째 부모가 이벤트의 실제 PR head 커밋과 같으며(= GitHub이 이 PR로 만든 병합본) ③ 첫째 부모가 이벤트 기준의 후손이고
//   ④ 기준 브랜치 현재 끝(origin/<기준 브랜치>)의 조상일 때만(= 기준 브랜치 역사 위에서 앞으로만) 첫째 부모를 쓴다.
//   하나라도 어긋나면 이벤트 값 그대로 — 후보가 기준을 스스로 고를 수 없고, 결과는 항상 '이벤트 기준 이상의 기준 브랜치 커밋'이라 PR이 바꾼 파일을 빠뜨리지 않는다.
// 사용(워크플로 셸): 신뢰하는 기준 사본으로 실행 — node "$RUNNER_TEMP/effective-base.mjs" "$BASE_SHA" "$BASE_REF" "$HEAD_SHA" → 기준 커밋 해시 한 줄(실패하면 이벤트 값).
import { execFileSync } from 'node:child_process'

export function effectiveBase({ eventBase, headSha, parents, baseTip, isAncestor }) {
  if (!eventBase || !headSha || !Array.isArray(parents) || parents.length !== 2 || !baseTip) return eventBase
  const [first, second] = parents
  if (second !== headSha) return eventBase // 이 PR의 head로 만든 병합본이 아니면 보정하지 않음
  if (first === eventBase) return eventBase
  return isAncestor(eventBase, first) && isAncestor(first, baseTip) ? first : eventBase
}

const gitOut = (...a) => execFileSync('git', a, { encoding: 'utf8', stdio: ['ignore', 'pipe', 'ignore'] }).trim()
const gitIsAncestor = (a, b) => { try { execFileSync('git', ['merge-base', '--is-ancestor', a, b], { stdio: 'ignore' }); return true } catch { return false } }

/** 실제 git 저장소에서 계산(현재 폴더). 어떤 단계든 실패하면 이벤트 값. */
export function resolveBase(eventBase, baseRef, headSha) {
  try {
    const baseTip = gitOut('rev-parse', `origin/${baseRef}`)
    const parents = gitOut('rev-list', '--parents', '-n', '1', 'HEAD').split(' ').slice(1)
    return effectiveBase({ eventBase, headSha, parents, baseTip, isAncestor: gitIsAncestor })
  } catch { return eventBase }
}

if (process.argv[1]?.endsWith('effective-base.mjs')) {
  const [, , eventBase, baseRef, headSha] = process.argv
  if (!eventBase || !baseRef) { console.error('사용: effective-base.mjs <이벤트 base sha> <기준 브랜치> <PR head sha>'); process.exit(2) }
  process.stdout.write(resolveBase(eventBase, baseRef, headSha) + '\n')
}
