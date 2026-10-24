// Enforce repository rules against the changed files, not just a PR description.
// Fail closed for protected records and require corresponding regression coverage.
import { execFileSync } from 'node:child_process'
import { readFileSync } from 'node:fs'

export function evaluateFiles(paths, body = '') {
  const errors = []
  const protectedFiles = [
    /^STATUS\.md$/, /^scripts\/status\//, /^\.github\/workflows\/status-.*\.yml$/,
  ]
  const dangerous = [
    /^supabase\/migrations\//, /^supabase\/functions\//,
    /^src\/.*(?:auth|Auth|rls|RLS)/, /^\.github\/workflows\/deploy/,
  ]
  for (const path of paths) {
    if (protectedFiles.some(re => re.test(path)))
      errors.push(path + ': STATUS 보호 규정 위반 (해당 파일 직접 변경 지시 필요)')
    if (dangerous.some(re => re.test(path)))
      errors.push(path + ': 운영·보안·DB 변경은 별도 승인과 STRICT 검증 필요')
  }
  if (paths.includes('src/lib/jobDetailSections.ts') &&
      !paths.includes('src/lib/jobDetailSections.test.ts'))
    errors.push('상세 분류 변경 시 기존 정답표 회귀 테스트 동시 수정/검증 필수')
  if (paths.includes('src/lib/directionsPlan.ts') &&
      !paths.some(p => /directionsPlan\.test\./.test(p)))
    errors.push('길찾기 로직 변경 시 기존 위치 정책 회귀 테스트 필수')
  if (paths.some(p => /^src\/pages\/JobDetail\.tsx$/.test(p)) &&
      !paths.some(p => /(?:jobDetailSections|jobCoords)\.test\.|scripts\/layout\//.test(p)))
    errors.push('상세 페이지 수정 시 기존 기준 공고/위치 회귀 증거 필요')
  // Source links may never be exposed in the browser, regardless of PR description.
  if (body.includes('[정책 위반 허용]')) errors.push('PR 설명만으로 규정 우회 불가')
  return errors
}

if (process.argv[1]?.endsWith('/check-repository-policy.mjs')) {
  const event = JSON.parse(readFileSync(process.env.GITHUB_EVENT_PATH, 'utf8'))
  const base = event.pull_request?.base?.sha
  if (!base) process.exit(0)
  const output = execFileSync('git', ['diff', '--name-only', base, 'HEAD'], {encoding:'utf8'})
  const files = output.split('\n').map(x => x.trim()).filter(Boolean)
  const errors = evaluateFiles(files, event.pull_request?.body || '')
  for (const error of errors) console.error('::error::' + error)
  if (errors.length) process.exit(1)
  console.log('Repository policy gate: ' + files.length + ' modified files checked')
}
