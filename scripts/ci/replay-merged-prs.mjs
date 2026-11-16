// S4 재현 도구(읽기 전용): 최근 병합된 PR N건(기본 60)을 지금의 위험도 판정(decision-approval-gate)에 다시 넣어 '새로 Lee 승인 대상이 되는 PR'을 센다.
// 사용: node scripts/ci/replay-merged-prs.mjs [건수]   (gh 로그인 필요, GitHub API 읽기만 — 아무것도 쓰지 않음)
import { execFileSync } from 'node:child_process'
import { readFileSync } from 'node:fs'
import { decisionApproval, approvedFramePaths, contentRisks } from '../decision-approval-gate.mjs'
const R = process.env.GITHUB_REPOSITORY ?? 'KHOAILANG0926/jobi-app', N = process.argv[2] ?? '60'
const gh = (...a) => execFileSync('gh', a, { encoding: 'utf8', maxBuffer: 1 << 28 })
const prs = JSON.parse(gh('pr', 'list', '--repo', R, '--state', 'merged', '--limit', N, '--json', 'number'))
const framePaths = approvedFramePaths(readFileSync(new URL('../test-desktop-baseline.mjs', import.meta.url), 'utf8'))
const onlyNew = []
for (const { number } of prs) {
  const files = JSON.parse(gh('api', `repos/${R}/pulls/${number}/files?per_page=100`, '--paginate', '--slurp')).flat()
  const r = decisionApproval({ files, reviews: [], comments: [], sha: 'x'.repeat(40), author: 'viecganban-bot', framePaths, body: '' })
  // 경로·라벨 등 기존 사유 없이 '변경 내용 위험/판단 불가'만으로 새로 막히는 PR
  if (r.required && r.reasons.every((x) => /변경 내용 위험|판단 불가/.test(x))) onlyNew.push(`#${number} ${contentRisks(files).slice(0, 2).join(' ; ')}`)
}
console.log(`최근 병합 ${prs.length}건 중 새 규칙(내용 위험·판단 불가)만으로 Lee 승인 대상이 되는 PR: ${onlyNew.length}건`)
for (const l of onlyNew) console.log(`  ${l}`)
