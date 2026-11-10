import { readFileSync } from 'node:fs'
import { execFileSync } from 'node:child_process'
import { changedPhotoPayloads } from './ops/photo-process-changed.mjs'
import { photoProcessPrProblems } from './ops/photo-process-pr.mjs'

/** 봇 수정 뒤 자동 검증 줄(claude-auto codex-response가 고친 커밋을 올린 뒤 tsc·시험·빌드를 돌려 적는 줄, #648). */
export const BOT_PROOF_LABEL = '봇 수정 뒤 tsc / npm test / build (자동)'

/**
 * @param botOnlySince 옛 SHA 이후 커밋이 모두 봇(claude[bot]) 커밋인지 — #648: 봇이 Codex 지적을 고쳐 올린 뒤에도
 *   작업자 검증 줄(옛 SHA)을 거짓으로 새 SHA로 바꾸지 않고 둔 채, 봇이 새 HEAD에서 직접 돌린 검증 줄이 있으면 통과.
 */
export function checkCompletion(body, headSha, botOnlySince = () => false) {
  const errors = []
  const headings = [
    '사용자 요청 및 확정된 완료 조건',
    '작업 범위와 변경 파일',
    '필수 테스트 결과 및 검증 SHA',
    '미충족 조건 또는 실제 병합 차단 사유',
  ]
  for (const heading of headings) {
    const section = body.split('## ' + heading + '\n')[1]?.split('\n## ')[0]?.trim()
    if (!section) errors.push(heading + ': 내용 없음')
  }
  if (!/^- 요청:\s*\S/m.test(body) || !/^- 완료 조건:\s*\S/m.test(body))
    errors.push('요청 및 확정된 완료 조건 누락')
  if (!/^- 변경 파일:\s*\S/m.test(body)) errors.push('변경 파일 누락')
  // Lee 2026-11-10: 끝내지 못한 일이 기록 없이 사라지지 않게(11-07 VPS 정리를 다 하지 않고 기록도 안 해 다시 문제로 꺼낸 일).
  // 후속 칸은 "없음"이거나, 줄마다 할 일 번호(#이슈)가 있어야 한다.
  const later = body.split(/^## 후속 개선 과제[^\n]*\n/m)[1]?.split('\n## ')[0]
  if (later === undefined) errors.push('후속 개선 과제: 칸 없음(없으면 "없음")')
  else {
    const lines = later.replace(/<!--[\s\S]*?-->/g, '').split('\n').map(l => l.trim()).filter(Boolean)
    if (!lines.length) errors.push('후속 개선 과제: 내용 없음(없으면 "없음")')
    for (const line of lines) {
      if (/^(?:-\s*)?없음(?:$|[\s—(,.:-])/.test(line)) continue
      if (!/#\d+/.test(line)) errors.push('후속 개선 과제: 할 일 번호(#이슈) 없는 줄 — ' + line.slice(0, 60))
    }
  }

  // 2026-11-01 Lee "기초 정리": 이 검사(checks)가 끝나기 전에 checks·app-screen 성공을 설명란에 미리 적으라는 요구는
  // 스스로를 증명하라는 순환이라 삭제. 실제 검사 결과는 봇 병합(bot-pr-automerge.yml)이 GitHub check-runs로 직접 확인한다.
  // 대신 설명란이 거짓·옛 근거를 담지 못하게 한다: 표에 적은 SHA는 현재 HEAD여야 하고, 실패라고 적었으면 READY 불가.
  const proof = body.split('## 필수 테스트 결과 및 검증 SHA\n')[1]?.split('\n## ')[0] || ''
  if (!headSha || !/^[0-9a-f]{40}$/i.test(headSha)) errors.push('현재 PR HEAD SHA 확인 불가')
  const rows = proof.split('\n').filter(l => l.startsWith('|')).map(line => line.split('|').map(c => c.trim()))
  const shaOf = (cells) => cells.find(c => /^[0-9a-f]{40}$/i.test(c))
  const botProofAtHead = !!headSha && rows.some(cells => cells[1] === BOT_PROOF_LABEL && /통과|success/i.test(cells[2] ?? '') && shaOf(cells)?.toLowerCase() === headSha.toLowerCase())
  for (const cells of rows) {
    const sha = shaOf(cells)
    const stale = sha && headSha && sha.toLowerCase() !== headSha.toLowerCase()
    if (stale && !(botProofAtHead && botOnlySince(sha))) errors.push(cells[1] + ': 표의 SHA가 현재 HEAD가 아님(옛 근거)')
    if (/^(?:failure|failed|실패)$/i.test(cells[2] ?? '')) errors.push(cells[1] + ': 실패로 적힌 검사가 있으면 READY 불가')
  }
  if (!/^- \[x\] READY FOR APPROVAL\s*$/mi.test(body) ||
      /^- \[x\] (?:BLOCKED|MERGED)\s*$/mi.test(body))
    errors.push('READY FOR APPROVAL만 선택해야 함')
  return errors
}

if (process.argv[1]?.endsWith('check-pr-ready.mjs')) {
  const event = JSON.parse(readFileSync(process.env.GITHUB_EVENT_PATH, 'utf8'))
  const pr = event.pull_request
  if (!pr || pr.draft) {
    console.log('Draft/master: READY 근거 검사는 생략, 코드 검사는 유지')
    process.exit(0)
  }
  // 설명란은 실행 때의 최신 글로 본다(다시 돌리기·봇 수정 뒤 이벤트 글이 옛 글일 수 있음, #648). 못 읽으면 이벤트 글.
  let body = pr.body || ''
  try {
    if (process.env.GH_TOKEN) body = execFileSync('gh', ['api', `repos/${process.env.GITHUB_REPOSITORY}/pulls/${pr.number}`, '--jq', '.body // ""'], { encoding: 'utf8' }).replace(/\n$/, '')
  } catch (e) { console.log('::warning::최신 PR 설명을 못 읽어 이벤트 글로 검사: ' + String(e.message).split('\n')[0]) }
  // 옛 SHA 이후 커밋이 모두 봇 커밋인지 — GitHub이 계정으로 연결한 작성자(login)로 본다(git 이름은 아무나 쓸 수 있음).
  let prCommits = []
  try {
    if (process.env.GH_TOKEN) prCommits = execFileSync('gh', ['api', `repos/${process.env.GITHUB_REPOSITORY}/pulls/${pr.number}/commits?per_page=100`, '--paginate', '--jq', '.[] | {sha, login: .author.login} | @json'], { encoding: 'utf8' }).split('\n').filter(Boolean).map(l => JSON.parse(l))
  } catch (e) { console.log('::warning::PR 커밋 목록을 못 읽음: ' + String(e.message).split('\n')[0]) }
  const botOnlySince = (sha) => {
    const i = prCommits.findIndex(c => c.sha.toLowerCase() === sha.toLowerCase())
    const after = i < 0 ? [] : prCommits.slice(i + 1)
    return after.length > 0 && after.every(c => c.login === 'claude[bot]') && after.at(-1).sha === pr.head.sha
  }
  const errors = checkCompletion(body, pr.head?.sha, botOnlySince)
  errors.push(...photoProcessPrProblems(body, changedPhotoPayloads(event)))
  for (const error of errors) console.error('::error::' + error)
  if (errors.length) process.exit(1)
  console.log('READY 근거 형식 확인; 실제 테스트 성공 여부는 필수 CI에서 별도 판정')
}
