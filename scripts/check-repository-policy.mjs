// Deterministic, evidence-backed CI subset of AGENTS.md / CLAUDE.md.
// Semantic UI review, approval intent and live DB correctness require separate gates.
import { execFileSync } from 'node:child_process'
import { readFileSync } from 'node:fs'

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
    if (/^supabase\/migrations\//.test(path) && DESTRUCTIVE_SQL.test(patches[path] ?? ''))
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
  const errors = evaluateFiles(files, event.pull_request?.body || '', patches)
  errors.forEach(error => console.error('::error::' + error))
  if (errors.length) process.exit(1)
  console.log('Repository policy gate: ' + files.length + ' modified files checked')
}
