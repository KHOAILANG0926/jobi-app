// A PR is not ready for merge merely because a commit or PR exists.
// Run only for non-draft pull requests. The existing required check still
// validates code/tests/build; this validates the accompanying completion record.
import { readFileSync } from 'node:fs'

export function checkCompletion(body) {
  // The existing PR template is the source of truth; do not invent a second form.
  const headings = [
    '사용자 요청 및 확정된 완료 조건',
    '작업 범위와 변경 파일',
    '필수 테스트 결과 및 검증 SHA',
    '미충족 조건 또는 실제 병합 차단 사유',
  ]
  const errors = []
  for (const name of headings) {
    const section = body.split('## ' + name + '\n')[1]?.split('\n## ')[0]?.trim()
    if (!section) errors.push(name + ': 내용 없음')
  }
  if (!/^- 요청:\s*\S/m.test(body) || !/^- 완료 조건:\s*\S/m.test(body))
    errors.push('사용자 요청과 완료 조건을 기입')
  if (!/^- 변경 파일:\s*\S/m.test(body)) errors.push('변경 파일을 기입')
  if (!/\b[0-9a-f]{40}\b/i.test(body)) errors.push('검증 SHA(40자리) 필요')
  if (!/https:\/\/github\.com\/[^\s)]+\/actions\/runs\/\d+/.test(body))
    errors.push('GitHub Actions 실제 실행 링크 필요')
  if (!/^- \[x\] READY FOR APPROVAL\s*$/mi.test(body) ||
      /^- \[x\] (?:BLOCKED|MERGED)\s*$/mi.test(body))
    errors.push('READY FOR APPROVAL 상태만 체크해야 함')

  return errors
}

if (process.argv[1]?.endsWith('check-pr-ready.mjs')) {
  const event = JSON.parse(readFileSync(process.env.GITHUB_EVENT_PATH, 'utf8'))
  const pr = event.pull_request
  if (!pr || pr.draft) {
    console.log('Draft 또는 master: 준비 완료 주장 검사 생략 (필수 코드 검사는 유지)')
    process.exit(0)
  }
  const errors = checkCompletion(pr.body || '')
  if (errors.length) {
    for (const error of errors) console.error('::error::' + error)
    console.error('검증 불충분: Draft로 전환하거나 증거와 잔여 문제를 기록하세요.')
    process.exit(1)
  }
  console.log('PR 준비 완료 보고 형식 확인; 실제 테스트 통과는 별도 CI가 판정')
}
