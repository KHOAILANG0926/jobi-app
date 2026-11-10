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

/**
 * 확인한 기록(#666, Lee 2026-11-10 "규칙을 확인도 안 할 거면 규칙은 왜 있니"): PR이 바꾼 파일을 최근에 바꾼 PR·지금 같은 파일을 고치는
 * 다른 열린 PR을 검사가 직접 찾고(recentPrsFor), PR 설명 `## 확인한 기록` 칸에 그 번호가 줄마다 설명과 함께 있는지 본다.
 * 목록은 검사가 정하므로 작성자가 빼거나 "확인함"만 적고 넘어갈 수 없다. 읽고 이해했는지는 기계가 확인하지 못한다(한계).
 * 사례: #661이 companyReader.ts에 새 단계를 붙일 때 11-07 결정·#616을 안 보고, 같은 파일을 고치던 #663도 몰랐다.
 */
export const RECORD_HEADING = '확인한 기록'
/** 기록을 볼 필요 없는 파일(모든 PR이 같이 바꾸는 작업 기록·자동 생성 파일) */
export const RECORD_SKIP = /^(?:WORK_LOG\.md|CHATGPT_HANDOFF\.md|package-lock\.json|tsconfig\.tsbuildinfo)$/
export function recordProblems(body, required) {
  if (!required.length) return []
  const section = body.split(/^## 확인한 기록[^\n]*\n/m)[1]?.split('\n## ')[0]
  if (section === undefined) return [`${RECORD_HEADING}: 칸 없음 — 이 PR이 바꾼 파일의 최근·진행 중 PR(${required.map((r) => '#' + r.num).join(' ')})을 읽고 줄마다 한 줄씩 적어야 함`]
  const lines = section.replace(/<!--[\s\S]*?-->/g, '').split('\n')
  const errors = []
  for (const r of required) {
    const line = lines.find((l) => new RegExp(`#${r.num}(?!\\d)`).test(l))
    // 번호만 적은 줄은 안 됨: 번호·기호를 뺀 설명 글자가 8자 이상
    const said = line?.replace(/#\d+/g, '').replace(/[\s\-–—:·,.|()[\]*`]/g, '') ?? ''
    if (!line) errors.push(`${RECORD_HEADING}: #${r.num} 없음 (${r.why})`)
    else if (said.length < 8) errors.push(`${RECORD_HEADING}: #${r.num} 설명 없음(번호만) — 무엇을 왜 바꿨고 이번 변경과 어떤 관계인지 한 줄`)
  }
  return errors
}
/** 바뀐 파일마다 ① 최근 14일 그 파일을 바꾼 병합 PR(파일당 최근 5개) ② 최근 3일 갱신된 다른 열린 PR 중 같은 파일을 고치는 것. */
export function recentPrsFor({ files, self, now = Date.now(), api }) {
  const need = new Map()
  const since = new Date(now - 14 * 864e5).toISOString()
  const targets = files.filter((f) => !RECORD_SKIP.test(f))
  for (const f of targets) {
    const nums = api(`commits?sha=master&path=${encodeURIComponent(f)}&since=${since}&per_page=30`)
      .map((c) => /\(#(\d+)\)\s*$/.exec(String(c.commit?.message ?? '').split('\n')[0])?.[1]).filter(Boolean)
    for (const n of [...new Set(nums)].slice(0, 5)) if (Number(n) !== self && !need.has(Number(n))) need.set(Number(n), `최근 ${f}를 바꾼 병합 PR`)
  }
  const open = api('pulls?state=open&sort=updated&direction=desc&per_page=30')
    .filter((p) => p.number !== self && Date.parse(p.updated_at) >= now - 3 * 864e5)
  for (const p of open) {
    const same = api(`pulls/${p.number}/files?per_page=100`).map((x) => x.filename).filter((f) => targets.includes(f))
    if (same.length && !need.has(p.number)) need.set(p.number, `지금 같은 파일(${same.slice(0, 3).join(', ')})을 고치는 열린 PR`)
  }
  return [...need].map(([num, why]) => ({ num, why }))
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
  // 확인한 기록(#666): 목록은 검사가 GitHub에서 직접 찾는다. 못 읽으면 통과시키지 않는다(우회 방지).
  try {
    const api = (path) => JSON.parse(execFileSync('gh', ['api', `repos/${process.env.GITHUB_REPOSITORY}/${path}`], { encoding: 'utf8' }))
    const files = execFileSync('gh', ['api', `repos/${process.env.GITHUB_REPOSITORY}/pulls/${pr.number}/files?per_page=100`, '--paginate', '--jq', '.[].filename'], { encoding: 'utf8' }).split('\n').filter(Boolean)
    const required = recentPrsFor({ files, self: pr.number, api })
    if (required.length) console.log('확인한 기록 대상: ' + required.map((r) => `#${r.num}(${r.why})`).join(', '))
    errors.push(...recordProblems(body, required))
  } catch (e) { errors.push(`${RECORD_HEADING}: 최근·진행 중 PR 목록을 못 읽음 — ${String(e.message).split('\n')[0]}`) }
  for (const error of errors) console.error('::error::' + error)
  if (errors.length) process.exit(1)
  console.log('READY 근거 형식 확인; 실제 테스트 성공 여부는 필수 CI에서 별도 판정')
}
