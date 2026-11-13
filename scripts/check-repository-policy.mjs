// Deterministic, evidence-backed CI subset of AGENTS.md / CLAUDE.md.
// Semantic UI review, approval intent and live DB correctness require separate gates.
import { execFileSync } from 'node:child_process'
import { readFileSync, readdirSync } from 'node:fs'
import { isApprovedMigration, MANIFEST_PATH } from './approved-migrations.mjs'

const PROTECTED = [/^STATUS\.md$/, /^scripts\/status\//, /^\.github\/workflows\/status-.*\.ya?ml$/]
// 결정 0002(Lee 2026-10-18): 검사 통과한 migration은 자동 적용. 단 데이터 삭제·되돌리기 어려운 변경은 Lee 판단 →
// migration은 아래 DESTRUCTIVE_SQL이 들어 있을 때만 막는다(새 표·함수·트리거 추가는 통과).
const DESTRUCTIVE_SQL = /^\+(?!\s*--).*\b(?:drop\s+(?:table|column|schema|policy)|truncate\b|delete\s+from\b|alter\s+table\b[^;]*\bdrop\b)/im
const STRICT = [
  /^supabase\/functions\//,
  /^src\/.*(?:auth|Auth|rls|RLS)/, /^\.github\/workflows\/deploy/,
  /^src\/lib\/(?:account|storage|payment)/i,
]
const SECRETS = [
  /(^|\/)\.env(?:\..+)?$/i, /\.(?:pem|p12|pfx|key)$/i,
  /(^|\/)(?:credentials|secrets)\.json$/i,
]
// Codex 검사 없이 병합하면 안 되는 파일(Lee 2026-11-09, codex-review-gate.mjs): 위 보호·STRICT·비밀 목록 + DB migration·자동화·운영 SQL.
export const needsSecondReview = (path) => [...PROTECTED, ...STRICT, ...SECRETS,
  /^supabase\/migrations\//, /^\.github\/workflows\//, /^scripts\/ops\/jobs\/.*\.sql$/,
  /^scripts\/(?:codex-review-gate|check-repository-policy|decision-approval-gate|approved-migrations)\.mjs$/].some((re) => re.test(path))
// #728 S2 정답 보호: 정답 파일(사례 원문·기대값)의 기존 줄을 바꾸거나 지우려면 PR 설명에 `기대값 변경 근거:`(결정 번호·Lee 결정 날짜·원문 인용)가 있어야 한다.
// 출처 없이 정답을 고치면 시험이 '맞는 값'이 아니라 '지금 코드가 내는 값'을 굳힌다. 줄 추가는 자유.
// 보호 대상 = 원문→값·칸·업종·위치·사진을 판정하는 '의미 정답' 시험과 사례 자료(src/lib 시험 85개 중 이름 목록, 화면·저장소·지도 조작 같은 인프라 시험은 제외).
// 새 판정 모듈의 시험을 만들면 여기 이름을 더한다(목록은 줄이지 않는다).
// 방법 변경(Lee 2026-11-12 승인 ②, GPT 재현: 새 의미 시험이 이름 목록에 없으면 보호 안 됨 — 실제로 r2Oracle·r2Industry·r2Inspect·industrialPark가 빠져 있었다):
// 이름 목록(보호할 것)을 지우고 반대로 한다 — src/lib 시험과 사례 자료는 기본이 보호 대상이고, 판정과 무관한 화면·저장소·지도 조작 시험만 아래 INFRA_TESTS에서 뺀다.
// 새 시험을 만들면 목록을 건드리지 않아도 자동으로 보호된다(빠뜨릴 수 없음).
export const INFRA_TESTS = ['accountRoles', 'applyAction', 'adminJobDraft', 'fetchJobsData', 'fitPins', 'googleQuotaCache', 'homeDiscovery', 'homeMapFilters',
  'homeMapSalary', 'homeMapSearch', 'imageResize', 'inViewOnce', 'jobAlerts', 'jobDetailView', 'jobSearchMenu', 'mapPlace', 'mapPushPin', 'mapR1', 'mapSummary',
  'nearbyFacilities', 'postJobForm', 'recommendStorage', 'vnAdminVersion', 'sourceTag', 'recruitColumns']
// 같은 종류의 정답이 있는 다른 곳도 포함: DB 규칙 시험(supabase/tests/*.test.mjs, PGlite), OCR 시험(scripts/ocr/*.test.mjs), 크롤러 시험(crawler/test_*.py).
const ANSWER_FILES = [new RegExp(`^src\\/lib\\/(?!(?:${INFRA_TESTS.join('|')})\\.test\\.ts$)[A-Za-z0-9]+\\.test\\.ts$`), /^src\/lib\/[A-Za-z0-9]+\.fixtures?\.ts$/, /^scripts\/repro\/.+\.repro\.ts$/,
  /^supabase\/tests\/[^/]+\.test\.mjs$/, /^scripts\/ocr\/[^/]+\.test\.mjs$/, /^crawler\/test_[^/]+\.py$/]
const isAnswerFile = (p) => ANSWER_FILES.some((re) => re.test(p))
// import 줄은 기대값이 아니다(이름을 더하려고 줄이 바뀌는 것은 정상) — 지운 줄 세기에서 제외.
const removedLines = (patch = '') => patch.split('\n').filter((l) => l.startsWith('-') && !l.startsWith('---') && !/^-\s*(?:\/\/|\*|\/\*|#)?\s*$/.test(l) && !/^-\s*(?:\/\/|#)/.test(l) && !/^-\s*(?:import|from)\b/.test(l))
const SOURCE_EXPOSURE = /\b(?:source_url|sourceUrl|originalJobUrl|externalPostingUrl)\b/
const SRC_EXPOSURE_PATH = /^src\/(?:pages|components|context|lib)\//

// 기대값 변경 근거 확인(Lee 2026-11-12 승인 ①, GPT 재현: `#999999`·`Lee 2026-11-11`·`"abcdefgh"`가 모두 통과): 적힌 근거가 실제 기록으로 이어지는지 본다.
//  - 원문 인용("…"): 이번에 바뀐 정답 파일의 변경 내용(patch) 안에 그 글이 그대로 있어야 한다.
//  - Lee 결정 날짜: 저장소 결정 문서(CLAUDE.md·RULES_CORE·AGENTS·docs/decisions)에 `Lee 그 날짜` 기록이 있어야 한다.
//  - #번호: 실제 있는 이슈·PR이고(이 PR 자신 제외) 그 글(제목·본문·댓글)이 바뀐 줄·파일 이름과 낱말 2개 이상 겹쳐야 한다.
//  - 결정 NNNN: docs/decisions에 그 결정 파일이 있고 같은 겹침 조건.
// 확인할 수 없으면(조회 실패) 통과시키지 않는다. 한계: 낱말 겹침은 '이어져 있음'의 최소 확인이지 뜻의 일치를 읽는 것이 아니다 — 의미는 Codex 검토 몫.
const STOP = new Set(['const', 'export', 'import', 'from', 'true', 'false', 'null', 'undefined', 'return', 'function', 'assert', 'string', 'number', 'expected', 'result', 'test', 'tests', 'case', 'with', 'this', 'that', 'when', 'then', 'else', 'type', 'name', 'value', 'values', 'line', 'lines', 'file', 'files'])
export const tokensOf = (text) => new Set((String(text).replace(/([a-z])([A-Z])/g, '$1 $2').toLowerCase().match(/[\p{L}\p{N}]{4,}/gu) ?? []).filter((t) => !STOP.has(t)))
const squash = (t) => String(t).replace(/\s+/g, ' ').trim()
export function sourceProblems(body, answerEdits, patches, resolve = {}) {
  const marks = body.split('\n').filter((l) => /기대값 변경 근거:/.test(l)).map((l) => l.slice(l.indexOf('기대값 변경 근거:') + '기대값 변경 근거:'.length))
  const text = marks.join('\n')
  const where = answerEdits.join(', ')
  const patchText = answerEdits.map((p) => patches[p] ?? '').join('\n')
  const changedLines = patchText.split('\n').filter((l) => /^[+-]/.test(l) && !/^(?:\+\+\+|---)/.test(l)).join('\n')
  const mine = tokensOf(changedLines + ' ' + answerEdits.join(' '))
  const overlap = (record) => { const t = tokensOf(record); return [...mine].filter((x) => t.has(x)).length }
  const ok = [], bad = []
  for (const m of text.matchAll(/"([^"\n]{8,})"|「([^」\n]{8,})」/g)) {
    const q = squash(m[1] ?? m[2])
    ;(squash(patchText).includes(q) ? ok : bad).push(`원문 인용 "${q.slice(0, 30)}"이 이번에 바뀐 정답 파일 변경 안에 없음`)
  }
  for (const m of text.matchAll(/Lee\s*(\d{4}-\d{2}-\d{2})/g)) {
    const rec = resolve.leeDate?.(m[1])
    ;(rec ? ok : bad).push(`Lee ${m[1]} 결정 기록을 결정 문서에서 못 찾음`)
  }
  for (const m of text.matchAll(/#(\d+)/g)) {
    const n = Number(m[1])
    if (resolve.self && n === resolve.self) { bad.push(`#${n}은 이 PR 자신`); continue }
    const rec = resolve.issue?.(n)
    if (!rec) bad.push(`#${n}을 읽지 못함(없는 번호이거나 조회 실패)`)
    else if (overlap(rec) < 2) bad.push(`#${n} 글이 바뀐 줄·파일과 이어지지 않음(겹치는 낱말 2개 미만)`)
    else ok.push(`#${n}`)
  }
  for (const m of text.matchAll(/결정\s*(\d{4})/g)) {
    const rec = resolve.decision?.(m[1])
    if (!rec) bad.push(`결정 ${m[1]} 문서를 못 찾음`)
    else if (overlap(rec) < 2) bad.push(`결정 ${m[1]} 문서가 바뀐 줄·파일과 이어지지 않음(겹치는 낱말 2개 미만)`)
    else ok.push(`결정 ${m[1]}`)
  }
  if (ok.length) return []
  return [`${where}: 정답 파일의 기존 줄 수정·삭제는 PR 설명 '기대값 변경 근거:'에 실제 기록으로 이어지는 근거가 하나 이상 있어야 함 — ${bad.length ? bad.join(' / ') : '근거 줄이 없거나 읽을 수 있는 근거(#번호·결정 0000·Lee 날짜·원문 인용)가 없음'}`]
}

export function evaluateFiles(paths, body = '', patches = {}, options = {}) {
  const errors = []
  const changed = new Set(paths)
  const hasTest = (re) => paths.some(p => re.test(p))
  for (const path of paths) {
    if (PROTECTED.some(re => re.test(path)))
      errors.push(path + ': STATUS 보호 규정 위반')
    if (STRICT.some(re => re.test(path)))
      errors.push(path + ': 운영·보안·DB 변경은 별도 승인과 STRICT 검증 필요')
    if (/^supabase\/migrations\//.test(path) && DESTRUCTIVE_SQL.test(patches[path] ?? '') && !options.approvedMigrations?.has(path))
      errors.push(path + ': 데이터 삭제·되돌리기 어려운 DB 변경은 Lee 판단 필요(결정 0002 예외)')
    if (SECRETS.some(re => re.test(path)))
      errors.push(path + ': 로컬 환경파일·비밀키 저장 금지')
    if (path.startsWith('src/pages/KoreaJob') && path.includes('JobDetail') &&
        !hasTest(/(?:korea|Korea).*test\./))
      errors.push(path + ': 한국 전용 화면 변경은 분리 회귀 테스트 필수')
  }
  if (changed.has('src/lib/jobDetailSections.ts') &&
      !changed.has('src/lib/jobDetailSections.test.ts'))
    errors.push('상세 분류 변경 시 기존 정답표 회귀 테스트 필수')
  if (changed.has('src/lib/directionsPlan.ts') &&
      !hasTest(/directionsPlan\.test\./))
    errors.push('길찾기 변경 시 위치 정책 회귀 테스트 필수')
  if (changed.has('src/lib/jobCoords.ts') &&
      !hasTest(/jobCoords\.test\.|test-job-location-detail\.mjs/))
    errors.push('좌표 변경 시 근무지 회귀 테스트 필수')
  if (changed.has('src/pages/JobDetail.tsx') &&
      !hasTest(/(?:jobDetailSections|jobCoords)\.test\.|scripts\/layout\/|scripts\/test-job-location-detail\.mjs/))
    errors.push('상세 화면 변경 시 기준 공고 및 위치 회귀 테스트 필수')
  if (hasTest(/^src\/(?:components\/JobCard|pages\/Home)\.tsx$/) &&
      !hasTest(/test-job-card-layout\.mjs|test-jobcard-integrity\.mjs|scripts\/ops\/app-smoke\.mjs/))
    errors.push('공고 카드·메인 변경 시 레이아웃 회귀 테스트 필수')
  if (changed.has('src/components/JobVietMap.tsx') &&
      !hasTest(/jobCoords\.test\.|test-job-location-detail\.mjs|map.*\.test\./i))
    errors.push('지도 컴포넌트 변경 시 위치 회귀 테스트 필수')
  // 11-07 Lee "읽기는 한 곳에서, 틀린 공고는 사례를 시험에 추가 → 함수 수정"(회사·주소·급여): 함수를 고치면 그 시험 파일에
  // 새 사례(eq 줄)가 더해져야 한다. 사례 없이 규칙만 덧대는 수정을 막는다(#666, #661 사례). 결정 자체의 변경 여부는 기계가 판단 못 함.
  for (const name of ['companyReader', 'addressReader', 'salaryReader']) {
    const src = `src/lib/${name}.ts`
    // 주석 줄(// … eq(…))은 사례로 치지 않는다: 추가된 줄 중 주석이 아닌 줄에 eq(가 있어야 함
    const addedTest = (patches[`src/lib/${name}.test.ts`] ?? '').split('\n').filter((l) => l.startsWith('+') && !l.startsWith('+++') && !/^\+\s*(?:\/\/|\*|\/\*)/.test(l))
    if (changed.has(src) && !addedTest.some((l) => /\beq\(/.test(l)))
      errors.push(`${src}: 11-07 결정 — 고칠 때는 그 공고 사례를 ${name}.test.ts에 eq(…)로 추가해야 함`)
  }
  const answerEdits = paths.filter((p) => isAnswerFile(p) && removedLines(patches[p]).length)
  if (answerEdits.length) {
    // 정답(기대값)의 기존 줄을 바꾸려면 PR 본문에 출처가 있어야 한다: 결정 번호(#번호·결정 0000)·Lee 결정 날짜·원문 인용("…"/「…」).
    // 출처 없이 코드와 정답을 같이 바꾸면 시험이 '맞는 값'이 아니라 '지금 코드가 내는 값'을 굳힌다. 출처가 있으면 Codex가 그 근거와 대조한다.
    // (정답만 바꾸는 별도 PR은 코드가 아직 안 바뀌어 npm test가 빨개져 병합할 수 없으므로 같은 PR 변경을 근거 조건부로 허용한다.)
    errors.push(...sourceProblems(body, answerEdits, patches, options.resolve))
  }
  for (const [path, patch] of Object.entries(patches)) {
    if (!SRC_EXPOSURE_PATH.test(path)) continue
    const added = patch.split('\n').filter(line => line.startsWith('+') && !line.startsWith('+++')).join('\n')
    // Only block newly added executable uses, not existing code or plain comments.
    const executable = added.split('\n').filter(line => !/^\+\s*(?:\/\/|\*|\/\*)/.test(line)).join('\n')
    if (SOURCE_EXPOSURE.test(executable) && /\b(?:href|window\.open|location\.assign|source_url|sourceUrl)\b/.test(executable))
      errors.push(path + ': 경쟁 채용사이트 원문 URL을 브라우저로 노출할 위험 — 별도 보안 점검 필요')
  }
  if (body.includes('[정책 위반 허용]')) errors.push('PR 설명만으로 규정 우회 불가')
  return errors
}

export function parseGitDiff(raw) {
  const files = []
  const patches = {}
  let current = null
  for (const line of raw.split('\n')) {
    if (line.startsWith('diff --git a/')) {
      const match = line.match(/^diff --git a\/(.+) b\/(.+)$/)
      if (match) { current = match[2]; files.push(current); patches[current] = '' }
    } else if (current) {
      patches[current] += line + '\n'
    }
  }
  return { files: [...new Set(files)], patches }
}

if (process.argv[1]?.endsWith('/check-repository-policy.mjs')) {
  const event = JSON.parse(readFileSync(process.env.GITHUB_EVENT_PATH, 'utf8'))
  const base = event.pull_request?.base?.sha
  if (!base) process.exit(0)
  const diff = execFileSync('git', ['diff', '--no-ext-diff', '--no-color', '--find-renames', base, 'HEAD', '--'], { encoding:'utf8', maxBuffer: 10 * 1024 * 1024 })
  const { files, patches } = parseGitDiff(diff)
  // Approvals must already exist on the PR base: a candidate cannot approve itself.
  let manifest = { approvals: [] }
  try { manifest = JSON.parse(execFileSync('git', ['show', `${base}:${MANIFEST_PATH}`], { encoding: 'utf8', stdio: ['ignore', 'pipe', 'ignore'] })) } catch { /* missing approval fails closed */ }
  const approvedMigrations = new Set()
  for (const path of files) {
    if (!manifest.approvals?.some(item => item.path === path)) continue
    // Only newly added migrations may use this narrowly scoped approval.
    try { execFileSync('git', ['cat-file', '-e', `${base}:${path}`], { stdio: 'ignore' }); continue } catch { /* absent on base */ }
    try {
      const source = execFileSync('git', ['show', `HEAD:${path}`], { maxBuffer: 10 * 1024 * 1024 })
      if (isApprovedMigration(path, source, manifest)) approvedMigrations.add(path)
    } catch { /* deleted or unreadable source fails closed */ }
  }
  const repo = process.env.GITHUB_REPOSITORY
  const gh = (path, all = false) => { try { return JSON.parse(execFileSync('gh', ['api', ...(all ? ['--paginate', '--slurp'] : []), `repos/${repo}/${path}`], { encoding: 'utf8', maxBuffer: 64 * 1024 * 1024 })) } catch { return null } }
  const resolve = {
    self: event.pull_request?.number,
    issue: (n) => { const i = gh(`issues/${n}`); if (!i) return null; const c = (gh(`issues/${n}/comments?per_page=100`, true) ?? []).flat(); return [i.title, i.body, ...c.map((x) => x.body)].join('\n') },
    decision: (nnnn) => { try { const f = readdirSync('docs/decisions/ko').find((x) => x.startsWith(nnnn + '-')); return f ? readFileSync(`docs/decisions/ko/${f}`, 'utf8') : null } catch { return null } },
    leeDate: (d) => { const docs = ['CLAUDE.md', '.claude/RULES_CORE.md', 'AGENTS.md']; try { for (const f of readdirSync('docs/decisions/ko')) docs.push(`docs/decisions/ko/${f}`) } catch { /* 없음 */ }
      for (const f of docs) { try { if (new RegExp(`Lee\\s*${d}`).test(readFileSync(f, 'utf8'))) return f } catch { /* 없음 */ } } return null },
  }
  const errors = evaluateFiles(files, event.pull_request?.body || '', patches, { approvedMigrations, resolve })
  errors.forEach(error => console.error('::error::' + error))
  if (errors.length) process.exit(1)
  console.log('Repository policy gate: ' + files.length + ' modified files checked')
}
