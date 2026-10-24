// A PR is not ready for merge merely because a commit or PR exists.
// Run only for non-draft pull requests. The existing required check still
// validates code/tests/build; this validates the accompanying completion record.
import { readFileSync } from 'node:fs'

export function checkCompletion(body) {
  const fields = [
    ['작업 범위', /(?:^|\n)##\s*작업 범위\s*\n([^]*?)(?=\n##\s|$)/i],
    ['완료 조건', /(?:^|\n)##\s*완료 조건\s*\n([^]*?)(?=\n##\s|$)/i],
    ['검증 근거', /(?:^|\n)##\s*검증 근거\s*\n([^]*?)(?=\n##\s|$)/i],
    ['남은 문제', /(?:^|\n)##\s*남은 문제\s*\n([^]*?)(?=\n##\s|$)/i],
  ]
  const errors = []
  for (const [label, pattern] of fields) {
    const value = body.match(pattern)?.[1]?.trim()
    if (!value || /^(?:없음|n\/a|todo|tbd|추후|미작성|-)$/i.test(value) && label !== '남은 문제') {
      errors.push(label + ': 구체적 내용 필요')
    }
    if (label === '검증 근거' && value &&
        !/https:\/\/github\.com\/[^\s)]+\/actions\/runs\/\d+/.test(value)) {
      errors.push('검증 근거: GitHub Actions 실행 링크 필요')
    }
  }
  if (/##\s*남은 문제\s*\n\s*(?:검증 대기|테스트 실패|미완료|원인 조사 중)/i.test(body)) {
    errors.push('미완료 또는 검증 대기 PR은 Draft로 유지')
  }
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
