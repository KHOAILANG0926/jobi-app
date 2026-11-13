import { readFileSync, readdirSync, appendFileSync, statSync } from 'node:fs'
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
const foldWords = (t) => String(t ?? '').normalize('NFD').replace(/[\u0300-\u036f]/g, '').normalize('NFC').replace(/đ/gi, 'd').toLowerCase()
const STOP = new Set(['fix', 'feat', 'docs', 'test', 'tests', 'chore', 'ci', 'rules', 'ops', 'lee', 'pr', '추가', '고침', '수정', '검사', '정리', '반영', '확인', '변경', '공통', '자동', '실제', '기록'])
export const FIX_TITLE = /고침|고쳐|수정|오판|오류|예외|보정|막기|fix\b|bug/i
/** PR 제목(병합 커밋 첫 줄)의 낱말 — 확인한 기록 줄에 이 중 하나는 있어야 그 PR을 열어 본 것으로 본다. */
export function titleWords(title) {
  return [...new Set(foldWords(String(title ?? '').replace(/\(#\d+\)/g, ' ')).split(/[^a-z0-9\uac00-\ud7a3]+/)
    .filter((w) => !STOP.has(w) && !/^\d+$/.test(w) && (/[\uac00-\ud7a3]/.test(w) ? w.length >= 2 : w.length >= 4)))]
}
export function recordProblems(body, required) {
  if (!required.length) return []
  const section = body.split(/^## 확인한 기록[^\n]*\n/m)[1]?.split('\n## ')[0]
  if (section === undefined) return [`${RECORD_HEADING}: 칸 없음 — 이 PR이 바꾼 파일의 최근·진행 중 PR(${required.map((r) => '#' + r.num).join(' ')})을 읽고 줄마다 한 줄씩 적어야 함`]
  const lines = section.replace(/<!--[\s\S]*?-->/g, '').split('\n')
  const errors = []
  for (const r of required) {
    // 번호마다 자기 줄: 줄 맨 앞(글머리 뒤)의 번호가 그 PR이어야 하고, 다른 필수 PR 번호가 같이 있는 줄은 쓰지 않는다
    const others = required.filter((o) => o.num !== r.num).map((o) => new RegExp(`#${o.num}(?!\\d)`))
    const line = lines.find((l) => new RegExp(`^\\s*(?:[-*]\\s*)?#${r.num}(?!\\d)`).test(l) && !others.some((re) => re.test(l)))
    // 번호만 적은 줄은 안 됨: 번호·기호를 뺀 설명 글자가 8자 이상
    const said = line?.replace(/#\d+/g, '').replace(/[\s\-–—:·,.|()[\]*`]/g, '') ?? ''
    if (!line) errors.push(`${RECORD_HEADING}: #${r.num} 없음 (${r.why})`)
    else if (said.length < 8) errors.push(`${RECORD_HEADING}: #${r.num} 설명 없음(번호만) — 무엇을 왜 바꿨고 이번 변경과 어떤 관계인지 한 줄`)
    // 그 PR을 실제로 열어 봤는지: 제목 낱말이 하나도 없으면 실패(번호만 베껴 아무 말이나 쓴 줄을 막음)
    else if (r.words?.length && !r.words.some((w) => foldWords(line).includes(w))) errors.push(`${RECORD_HEADING}: #${r.num} 줄에 그 PR 내용이 없음 — 제목 낱말(${r.words.slice(0, 4).join(', ')} …) 중 하나 이상으로 무엇을 바꿨는지 적기`)
  }
  return errors
}
/** 바뀐 파일마다 ① 최근 14일 그 파일을 바꾼 병합 PR(파일당 최근 5개) ② 최근 3일 갱신된 다른 열린 PR 중 같은 파일을 고치는 것. */
export function recentPrsFor({ files, self, now = Date.now(), api, stats }) {
  const need = new Map()
  const since = new Date(now - 14 * 864e5).toISOString()
  const targets = files.filter((f) => !RECORD_SKIP.test(f))
  for (const f of targets) {
    const nums = api(`commits?sha=master&path=${encodeURIComponent(f)}&since=${since}&per_page=30`)
      .map((c) => { const t = String(c.commit?.message ?? '').split('\n')[0]; const n = /\(#(\d+)\)\s*$/.exec(t)?.[1]; return n && { n: Number(n), t } }).filter(Boolean)
    const seen = new Set()
    for (const { n, t } of nums) {
      if (seen.size >= 5) break
      if (seen.has(n)) continue
      seen.add(n)
      // 같은 파일을 '고치는' 병합 PR 수(제목에 고침 낱말) — 반복 수정 표시용(stats.fixCounts)
      if (n !== self && stats && FIX_TITLE.test(t)) stats.fixCounts[f] = (stats.fixCounts[f] ?? 0) + 1
      if (n !== self && !need.has(n)) need.set(n, { why: `최근 ${f}를 바꾼 병합 PR`, words: titleWords(t) })
    }
  }
  // 열린 PR 목록도 끝 페이지까지(최근 갱신 순이라 3일 범위를 벗어나는 PR이 나오면 거기서 멈춤)
  const cutoff = now - 3 * 864e5
  const open = []
  for (let page = 1; page <= 30; page++) {
    const got = api(`pulls?state=open&sort=updated&direction=desc&per_page=100&page=${page}`)
    open.push(...got.filter((p) => p.number !== self && Date.parse(p.updated_at) >= cutoff))
    if (got.length < 100 || got.some((p) => Date.parse(p.updated_at) < cutoff)) break
  }
  for (const p of open) {
    // 파일 목록은 끝 페이지까지(100개 넘는 큰 PR에서 뒤쪽 공통 파일을 놓치지 않게)
    const all = []
    for (let page = 1; page <= 30; page++) {
      const got = api(`pulls/${p.number}/files?per_page=100&page=${page}`)
      all.push(...got)
      if (got.length < 100) break
    }
    const same = all.map((x) => x.filename).filter((f) => targets.includes(f))
    if (same.length && !need.has(p.number)) need.set(p.number, { why: `지금 같은 파일(${same.slice(0, 3).join(', ')})을 고치는 열린 PR`, words: titleWords(p.title) })
  }
  return [...need].map(([num, v]) => ({ num, ...v }))
}

// ───────── R3(Lee 2026-11-13): 변경 범위 대조 · 지운 것/합친 것 대조 · 반복 수정 표시 · 공고 번호 예외 차단 ─────────
// 모두 GitHub가 준 실제 변경 파일(pulls/N/files)과 PR 본문을 대조한다(작업자가 Claude든 Codex든 같은 필수 검사 `checks`). 본문 문구가 있다는 것만으로 통과시키지 않는다.
// 한계: 본문의 변경 파일 목록은 작성자가 선언한 범위이지 Lee의 승인 기록이 아니다 — 목록이 맞아도 '승인됨'으로 보지 않으며, 승인이 필요한 운영·보안·DB 파일은
// 기존 장치(check-repository-policy STRICT·approved-migrations·decision-approval-gate)가 따로 막는다. 승인 기록을 확인할 수 없으면 승인된 것으로 처리하지 않는다.
const sectionOf = (body, heading) => body.split(new RegExp(`^## ${heading}[^\\n]*\\n`, 'm'))[1]?.split('\n## ')[0] ?? ''
/** `- <이름>:` 칸의 값(그 줄 + 이어지는 들여쓴·글머리 줄, 다음 칸 이름 줄 전까지). 주석은 뺀다. */
export function fieldOf(body, name) {
  const scope = sectionOf(body, '작업 범위와 변경 파일').replace(/<!--[\s\S]*?-->/g, '')
  const lines = scope.split('\n')
  const i = lines.findIndex((l) => new RegExp(`^-\\s*${name}\\s*:`).test(l))
  if (i < 0) return null
  const out = [lines[i].replace(new RegExp(`^-\\s*${name}\\s*:\\s*`), '')]
  for (let k = i + 1; k < lines.length; k++) {
    if (/^-\s*(?:범위|변경 파일|지운 것\/합친 것|사진 처리|예외 근거|방법 변경)[^:\n]*:/.test(lines[k])) break
    out.push(lines[k])
  }
  return out.join('\n').trim()
}
/** 본문 `변경 파일:` 칸에서 파일 경로(또는 폴더/ 접두·* 무늬)를 읽는다. */
export function declaredFiles(body) {
  // 방법 변경(Codex 지적 3건 — 점 파일·와일드카드 앞머리·확장자 길이): 글자 모양으로 '이게 파일 경로인가'를 추측해 거르지 않는다.
  // 낱말을 그대로 후보로 두고(앞뒤 괄호·따옴표·쉼표만 벗김, 점·* 는 보존) 실제 변경 파일이 후보에 덮이는지만 본다.
  const v = fieldOf(body, '변경 파일')
  if (!v) return []
  const out = new Set()
  for (const raw of v.split(/[\s,;、]+/)) {
    const t = raw.replace(/\(.*$/, '').replace(/^[`'"(\[]+|[`'")\],;:]+$/g, '')
    if (!t || /^https?:/.test(t)) continue
    out.add(t)
    if (/\.$/.test(t)) out.add(t.slice(0, -1)) // 문장 끝 마침표
    if (/^-+$/.test(t)) out.delete(t)
  }
  return [...out]
}
const covers = (decl, f) => decl === f || (decl.endsWith('/') && f.startsWith(decl)) || (decl.includes('*') && new RegExp('^' + decl.split('*').map((x) => x.replace(/[.+?^${}()|[\]\\]/g, '\\$&')).join('.*') + '$').test(f))
/** changed: [{filename, previous_filename?, status, additions, deletions, patch?}] */
export function scopeProblems(body, changed, exists = () => false) {
  const decl = declaredFiles(body)
  if (!decl.length) return ['변경 범위: 본문 `변경 파일:`에서 파일 경로를 읽지 못함 — 실제 변경 파일을 줄이나 쉼표로 적어야 함']
  const real = changed.filter((c) => !RECORD_SKIP.test(c.filename))
  const names = (c) => [c.filename, c.previous_filename].filter(Boolean)
  const out = []
  const undeclared = real.filter((c) => !names(c).some((n) => decl.some((d) => covers(d, n)))).map((c) => c.filename)
  if (undeclared.length) out.push(`변경 범위: 본문에 없는 파일을 바꿈(${undeclared.length}개) — ${undeclared.slice(0, 6).join(', ')}${undeclared.length > 6 ? ' …' : ''}. 범위를 넓히려면 본문 범위·변경 파일을 먼저 고쳐 알린다`)
  const all = changed.flatMap(names)
  // 본문에 적은 낱말이 저장소에 실제 있는 파일인데 이 PR이 바꾸지 않았다면 거짓 범위(없는 낱말·새 파일은 변경 목록 쪽에서 이미 대조)
  const phantom = decl.filter((d) => !d.endsWith('/') && !d.includes('*') && !all.includes(d) && !RECORD_SKIP.test(d) && exists(d))
  if (phantom.length) out.push(`변경 범위: 본문에 적었지만 실제로 바뀌지 않은 파일 — ${phantom.slice(0, 6).join(', ')}`)
  return out
}
const NEW_CHECKER = (c) => c.status === 'added' && (/^\.github\/workflows\/.+\.ya?ml$/.test(c.filename) || (/^scripts\/(?:[^/]+\/)*[^/]*(?:check|audit|verify|guard|gate|inspect)[^/]*\.m?[jt]s$/.test(c.filename) && !/\.test\.m?[jt]s$/.test(c.filename)))
const isTestOrData = (f) => /(?:^|\/)test_[^/]*\.py$|_test\.py$/.test(f) || /(?:\.test\.|\.fixtures?\.|\.fixture\.|\/tests?\/|\/fixtures?\/)/.test(f) || /\.(?:md|json|sql|ya?ml|txt|csv)$/.test(f)
/** 지운 것/합친 것 칸을 실제 변경과 대조한다. */
export function mergeLineProblems(body, changed) {
  const v = fieldOf(body, '지운 것\\/합친 것')
  if (v === null || !v.trim()) return ['지운 것/합친 것: 칸 없음(없으면 "없음 — 이유")']
  const real = changed.filter((c) => !RECORD_SKIP.test(c.filename))
  const deleted = real.reduce((n, c) => n + (c.status === 'removed' ? Math.max(c.deletions, 1) : c.deletions || 0), 0)
  const none = /^없음(?:$|[\s—(,.:-])/.test(v.trim())
  const out = []
  const newCheckers = real.filter(NEW_CHECKER).map((c) => c.filename)
  if (none) {
    const reason = v.trim().replace(/^없음[\s—\-:(,.]*/, '').replace(/\s+/g, '')
    if (reason.length < 6) out.push('지운 것/합친 것: "없음"에 이유가 없음(없음 — 이유)')
    // 새 검사기·워크플로를 더하는데 기존 어떤 것과 비교했는지(파일 경로나 #번호)가 없으면 '없음'을 인정하지 않는다
    if (newCheckers.length && !(/[\w.-]+\/[\w./-]+/.test(v) || /#\d+/.test(v))) out.push(`지운 것/합친 것: 새 검사기·워크플로(${newCheckers.slice(0, 3).join(', ')})를 더하는데 기존 어떤 검사와 비교했는지(파일 경로나 #번호) 없이 "없음"`)
  } else if (deleted < 1) out.push('지운 것/합친 것: 지우거나 합쳤다고 적었지만 실제 변경에 삭제된 줄·파일이 없음(추가만 있음)')
  return out
}
/** 공고 번호·id 비교 같은 개별 예외를 코드에 더하는 줄(CLAUDE.md 우선 원칙 8: 공고 번호 예외 금지). 시험·자료·문서는 제외. */
export const JOB_EXCEPTION = [/\b(?:job_?id|jobId|job\.id|\bid)\s*(?:===?|!==?)\s*['"]?(?:sb-)?\d{3,}\b/, /['"]sb-\d{3,}['"]/, /\b(?:case)\s+['"]?(?:sb-)?\d{4,}['"]?\s*:/]
export function exceptionProblems(body, changed, resolveRef = () => false) {
  const hits = []
  for (const c of changed) {
    if (isTestOrData(c.filename) || !/\.(?:[mc]?[jt]sx?|py)$/.test(c.filename) || !c.patch) continue
    for (const line of c.patch.split('\n')) {
      if (!line.startsWith('+') || line.startsWith('+++')) continue
      const t = line.slice(1).trim()
      if (/^(?:\/\/|\*|\/\*|#)/.test(t)) continue
      if (JOB_EXCEPTION.some((re) => re.test(t))) { hits.push(`${c.filename}: ${t.slice(0, 80)}`); break }
    }
  }
  if (!hits.length) return []
  const why = fieldOf(body, '예외 근거')
  const refs = [...String(why ?? '').matchAll(/#(\d+)|결정\s*(\d{4})/g)]
  if (refs.length && refs.some((m) => resolveRef(m[1] ? { issue: Number(m[1]) } : { decision: m[2] }))) return []
  return [`공고 번호·id 예외를 코드에 더함(CLAUDE.md 우선 원칙 8) — 근거 없이는 차단: ${hits.slice(0, 3).join(' | ')}. 틀(공통 함수·이름 규칙)로 고치거나 본문에 \`- 예외 근거: #이슈 또는 결정 NNNN\`(실제 있는 기록)을 적는다`]
}
/** 같은 파일을 최근 14일 안에 '고침' 제목 PR이 3번 이상 바꿨으면 구조 변경 검토 대상으로 표시한다(차단 아님). */
export function repeatedFiles(fixCounts, files) {
  return files.filter((f) => !isTestOrData(f) && (fixCounts[f] ?? 0) >= 3).map((f) => ({ file: f, count: fixCounts[f] }))
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
    const changed = execFileSync('gh', ['api', `repos/${process.env.GITHUB_REPOSITORY}/pulls/${pr.number}/files?per_page=100`, '--paginate', '--jq', '.[] | {filename, previous_filename, status, additions, deletions, patch} | @json'], { encoding: 'utf8', maxBuffer: 256 * 1024 * 1024 }).split('\n').filter(Boolean).map((l) => JSON.parse(l))
    const files = changed.map((c) => c.filename)
    const stats = { fixCounts: {} }
    const required = recentPrsFor({ files, self: pr.number, api, stats })
    // R3: 변경 범위·지운 것/합친 것·공고 번호 예외 대조, 반복 수정 표시
    const resolveRef = (r) => { try { if (r.issue) { api(`issues/${r.issue}`); return true } return readdirSync('docs/decisions/ko').some((f) => f.startsWith(r.decision + '-')) } catch { return false } }
    errors.push(...scopeProblems(body, changed, (p) => { try { return statSync(p).isFile() } catch { return false } }), ...mergeLineProblems(body, changed), ...exceptionProblems(body, changed, resolveRef))
    const repeated = repeatedFiles(stats.fixCounts, files)
    for (const r of repeated) console.log(`::warning::구조 변경 검토 필요: ${r.file}을(를) 최근 14일 '고침' PR ${r.count}건이 바꿨다 — 예외를 더하기 전에 방법을 바꾸는 안(무엇을 지우고 바꿀지·잃는 것)을 PR 댓글로 남긴다(CLAUDE.md 우선 원칙 8)`)
    if (repeated.length && process.env.GITHUB_STEP_SUMMARY) appendFileSync(process.env.GITHUB_STEP_SUMMARY, `### 구조 변경 검토 필요\n${repeated.map((r) => `- ${r.file}: 최근 14일 고침 PR ${r.count}건`).join('\n')}\n`)
    if (required.length) console.log('확인한 기록 대상: ' + required.map((r) => `#${r.num}(${r.why})`).join(', '))
    errors.push(...recordProblems(body, required))
  } catch (e) { errors.push(`${RECORD_HEADING}: 최근·진행 중 PR 목록을 못 읽음 — ${String(e.message).split('\n')[0]}`) }
  for (const error of errors) console.error('::error::' + error)
  if (errors.length) process.exit(1)
  console.log('READY 근거 형식 확인; 실제 테스트 성공 여부는 필수 CI에서 별도 판정')
}
