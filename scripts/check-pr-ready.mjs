import { readFileSync } from 'node:fs'

export function checkCompletion(body, headSha) {
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

  const proof = body.split('## 필수 테스트 결과 및 검증 SHA\n')[1]?.split('\n## ')[0] || ''
  if (!headSha || !/^[0-9a-f]{40}$/i.test(headSha)) errors.push('현재 PR HEAD SHA 확인 불가')
  for (const name of ['checks', 'app-screen']) {
    const row = proof.split('\n').find(line => line.startsWith('|') && line.split('|')[1]?.trim() === name)
    const cells = row?.split('|').map(cell => cell.trim()) || []
    if (!row || cells[2] !== 'success' || cells[3] !== headSha)
      errors.push(name + ': 현재 HEAD SHA에서 success 검증 기록 필요')
  }
  if (!/https:\/\/github\.com\/[^\s)]+\/actions\/runs\/\d+/.test(proof))
    errors.push('검증 결과 섹션에 GitHub Actions 실행 링크 필요')
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
  const errors = checkCompletion(pr.body || '', pr.head?.sha)
  for (const error of errors) console.error('::error::' + error)
  if (errors.length) process.exit(1)
  console.log('READY 근거 형식 확인; 실제 테스트 성공 여부는 필수 CI에서 별도 판정')
}
