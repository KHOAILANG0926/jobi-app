// Deterministic, evidence-backed CI subset of AGENTS.md / CLAUDE.md.
// Semantic UI review, approval intent and live DB correctness require separate gates.
import { execFileSync } from 'node:child_process'
import { readFileSync } from 'node:fs'
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
// #728 S2 정답 보호: 정답 파일(사례 원문·기대값)의 기존 줄을 생산 코드와 같은 PR에서 바꾸거나 지울 수 없다.
// 정답을 고치는 쪽이 코드도 같이 고치면 시험이 '맞는 값'이 아니라 '지금 코드가 내는 값'을 굳힌다. 줄 추가는 자유.
// 기대값을 정말 바꿔야 하면 생산 파일 없이 그 파일만 바꾸는 별도 PR + 설명에 `기대값 변경 근거:`(원문 인용 또는 결정 번호).
const ANSWER_FILES = [/^src\/lib\/realJobs\.fixtures\.ts$/, /^src\/lib\/(?:company|address|salary)Reader\.test\.ts$/, /^scripts\/repro\/.+\.repro\.ts$/]
const isProductionFile = (p) => /^(?:api|crawler|scripts\/ocr)\//.test(p)
  || (/^src\/(?:lib|pages|components)\//.test(p) && !/\.test\.[a-z]+$/.test(p) && !ANSWER_FILES.some((re) => re.test(p)))
const removedLines = (patch = '') => patch.split('\n').filter((l) => l.startsWith('-') && !l.startsWith('---') && !/^-\s*(?:\/\/|\*|\/\*)?\s*$/.test(l))
// #728 S5 검사 독립: 검사 파일이 새로 생산 코드(상대 경로 import)를 끌어오면 막는다 — 검사가 만드는 쪽과 같은 함수·단어표를 쓰면
// 생산이 틀릴 때 검사도 같이 틀린다(결정 0004 독립 판독자). 이미 있는 import는 그대로 두고(줄기만 하는 목록), `import type`은 허용.
// 같은 import를 옮긴 것(지운 줄에 같은 경로가 있음)도 허용. 새 import가 꼭 필요하면 정답 쪽(독립 코드)으로 만들거나 별도 결정.
const INSPECT_FILES = [/^src\/lib\/(?:jobInspect|screenAudit)\.ts$/, /^scripts\/ops\/(?:detail-read|location-ladder-compare)\.mjs$/, /^scripts\/ops\/[^/]*check[^/]*\.mjs$/]
const importPaths = (patch, sign) => patch.split('\n').filter((l) => l.startsWith(sign) && !l.startsWith(sign.repeat(3)))
  .filter((l) => !/^.\s*import\s+type\b/.test(l))
  .map((l) => /\bfrom\s+['"](\.{1,2}\/[^'"]+)['"]|^.\s*import\s+['"](\.{1,2}\/[^'"]+)['"]/.exec(l)).filter(Boolean).map((m) => m[1] ?? m[2])
const SOURCE_EXPOSURE = /\b(?:source_url|sourceUrl|originalJobUrl|externalPostingUrl)\b/
const SRC_EXPOSURE_PATH = /^src\/(?:pages|components|context|lib)\//

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
  const answerEdits = paths.filter((p) => ANSWER_FILES.some((re) => re.test(p)) && removedLines(patches[p]).length)
  if (answerEdits.length) {
    const prod = paths.filter(isProductionFile)
    if (prod.length)
      errors.push(`${answerEdits.join(', ')}: 정답 파일의 기존 줄 수정·삭제는 생산 코드(${prod[0]} 등)와 같은 PR에서 할 수 없음 — 정답 변경만 별도 PR로`)
    else if (!/기대값 변경 근거:[ \t]*\S[^\n]{9,}/.test(body))
      errors.push(`${answerEdits.join(', ')}: 정답 파일 기존 줄 변경은 PR 설명에 '기대값 변경 근거:'(원문 인용 또는 결정 번호) 필요`)
  }
  for (const path of paths.filter((p) => INSPECT_FILES.some((re) => re.test(p)))) {
    const removed = new Set(importPaths(patches[path] ?? '', '-'))
    const added = importPaths(patches[path] ?? '', '+').filter((m) => !removed.has(m))
    if (added.length)
      errors.push(`${path}: 검사 파일이 새로 생산 코드(${added[0]})를 import함 — 검사는 만드는 쪽과 같은 함수·기준을 쓰면 안 됨(독립 판독, #728 S5)`)
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
  const errors = evaluateFiles(files, event.pull_request?.body || '', patches, { approvedMigrations })
  errors.forEach(error => console.error('::error::' + error))
  if (errors.length) process.exit(1)
  console.log('Repository policy gate: ' + files.length + ' modified files checked')
}
