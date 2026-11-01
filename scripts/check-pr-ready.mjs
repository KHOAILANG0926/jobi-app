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

  // 2026-11-01 Lee "기초 정리": 이 검사(checks)가 끝나기 전에 checks·app-screen 성공을 설명란에 미리 적으라는 요구는
  // 스스로를 증명하라는 순환이라 삭제. 실제 검사 결과는 봇 병합(bot-pr-automerge.yml)이 GitHub check-runs로 직접 확인한다.
  // 대신 설명란이 거짓·옛 근거를 담지 못하게 한다: 표에 적은 SHA는 현재 HEAD여야 하고, 실패라고 적었으면 READY 불가.
  const proof = body.split('## 필수 테스트 결과 및 검증 SHA\n')[1]?.split('\n## ')[0] || ''
  if (!headSha || !/^[0-9a-f]{40}$/i.test(headSha)) errors.push('현재 PR HEAD SHA 확인 불가')
  for (const line of proof.split('\n').filter(l => l.startsWith('|'))) {
    const cells = line.split('|').map(c => c.trim())
    const sha = cells.find(c => /^[0-9a-f]{40}$/i.test(c))
    if (sha && headSha && sha.toLowerCase() !== headSha.toLowerCase()) errors.push(cells[1] + ': 표의 SHA가 현재 HEAD가 아님(옛 근거)')
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
  const errors = checkCompletion(pr.body || '', pr.head?.sha)
  for (const error of errors) console.error('::error::' + error)
  if (errors.length) process.exit(1)
  console.log('READY 근거 형식 확인; 실제 테스트 성공 여부는 필수 CI에서 별도 판정')
}
