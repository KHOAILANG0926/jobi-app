import assert from 'node:assert/strict'
import { checkCompletion, recordProblems, recentPrsFor } from './check-pr-ready.mjs'
import { evaluateFiles, parseGitDiff } from './check-repository-policy.mjs'

const valid = `## 사용자 요청 및 확정된 완료 조건
- 요청: 중복 작업 방지
- 완료 조건: 최종 CI 통과

## 작업 범위와 변경 파일
- 범위(하지 않는 것 포함): UI/DB 제외
- 변경 파일: scripts/check-pr-ready.mjs

## 필수 테스트 결과 및 검증 SHA
| 테스트/CI | 결과 | 검증 SHA |
|---|---|---|
| checks | success | 1234567890123456789012345678901234567890 |
| app-screen | success | 1234567890123456789012345678901234567890 |
https://github.com/KHOAILANG0926/jobi-app/actions/runs/12345

## 미충족 조건 또는 실제 병합 차단 사유
없음

## 후속 개선 과제 (현재 작업 완료 조건과 분리)
- 없음

## 최종 상태
- [ ] BLOCKED
- [x] READY FOR APPROVAL
- [ ] MERGED`

assert.deepEqual(checkCompletion(valid, '1234567890123456789012345678901234567890'), [])
assert.ok(checkCompletion(valid, 'aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa').length > 0, 'old HEAD evidence rejected')
{
  const sha = '1234567890123456789012345678901234567890'
  const later = (text) => valid.replace('- 없음\n\n## 최종 상태', text + '\n\n## 최종 상태')
  assert.ok(checkCompletion(valid.replace(/## 후속 개선 과제[^\n]*\n- 없음\n\n/, ''), sha).some(e => e.includes('후속')), 'missing follow-up section rejected')
  assert.ok(checkCompletion(later('- VPS 브라우저 옛 버전 지우기'), sha).some(e => e.includes('할 일 번호')), 'follow-up without issue rejected')
  assert.deepEqual(checkCompletion(later('- VPS 브라우저 옛 버전 지우기 (#640)'), sha), [], 'follow-up with issue accepted')
  assert.deepEqual(checkCompletion(later('없음 — 이번 범위 안에서 끝남'), sha), [], 'none with reason accepted')
}
assert.ok(checkCompletion(valid.replace('| app-screen | success |', '| app-screen | failure |'), '1234567890123456789012345678901234567890').length > 0, 'failed screen check rejected')
assert.ok(checkCompletion('').length > 0)
// 2026-11-01: 링크·성공 미리 적기는 요구하지 않는다(실제 결과는 봇 병합이 check-runs로 확인)
assert.deepEqual(checkCompletion(valid.replace('https://github.com/KHOAILANG0926/jobi-app/actions/runs/12345', 'pending'), '1234567890123456789012345678901234567890'), [], 'no link needed')
assert.ok(checkCompletion(valid.replace('- [x] READY FOR APPROVAL', '- [ ] READY FOR APPROVAL')).length > 0)
assert.deepEqual(checkCompletion(valid.replaceAll('| success | 1234567890123456789012345678901234567890 |', '| pending | (검사 후 자동 확인) |'), '1234567890123456789012345678901234567890'), [], 'pending before checks allowed')
console.log('PR completion guard: 7/7 passed')

assert.ok(evaluateFiles(['scripts/status/generate-status.mjs']).length > 0, 'STATUS edits denied')
// 결정 0002: 추가형 migration은 통과, 데이터 삭제·되돌리기 어려운 변경은 막음
assert.equal(evaluateFiles(['supabase/migrations/20261024.sql'], '', { 'supabase/migrations/20261024.sql': '+create table x(id int);\n' }).length, 0, 'additive DB migration allowed (decision 0002)')
assert.ok(evaluateFiles(['supabase/migrations/20261024.sql'], '', { 'supabase/migrations/20261024.sql': '+delete from public.local_jobs;\n' }).length > 0, 'destructive DB migration denied')
assert.ok(evaluateFiles(['supabase/migrations/20261024.sql'], '', { 'supabase/migrations/20261024.sql': '+alter table public.local_jobs drop column title;\n' }).length > 0, 'dropping a column denied')
assert.ok(evaluateFiles(['src/lib/jobDetailSections.ts']).length > 0, 'unverified detail categorization denied')
assert.deepEqual(evaluateFiles(['src/lib/jobDetailSections.ts', 'src/lib/jobDetailSections.test.ts']), [], 'covered detail classification allowed')
assert.ok(evaluateFiles(['src/pages/JobDetail.tsx']).length > 0, 'detail UI requires regression proof')
console.log('Repository policy negative tests: 5/5 passed')

assert.ok(evaluateFiles(['.env.production']).length > 0, 'environment secrets blocked')
assert.ok(evaluateFiles(['src/lib/directionsPlan.ts']).length > 0, 'directions changes require regression')
assert.ok(evaluateFiles(['src/lib/jobCoords.ts']).length > 0, 'coordinates changes require regression')
assert.ok(evaluateFiles(['src/components/JobVietMap.tsx']).length > 0, 'map rendering requires regression')
assert.ok(evaluateFiles(['src/components/JobCard.tsx']).length > 0, 'job card changes require layout test')
assert.ok(evaluateFiles(['src/pages/KoreaJobDetail.tsx']).length > 0, 'Korea module needs scoped test')
assert.ok(evaluateFiles(['src/pages/JobDetail.tsx', 'scripts/test-job-location-detail.mjs']).length === 0, 'tested detail updates pass')
assert.ok(evaluateFiles(['src/lib/jobCoords.ts', 'src/lib/jobCoords.test.ts']).length === 0, 'tested coordinate changes pass')
const samplePatch = 'diff --git a/src/pages/JobDetail.tsx b/src/pages/JobDetail.tsx\n@@ -1,0 +1 @@\n+window.open(job.source_url)\n'
const parsed = parseGitDiff(samplePatch)
assert.deepEqual(parsed.files, ['src/pages/JobDetail.tsx'])
assert.ok(evaluateFiles(parsed.files, '', parsed.patches).some(x => x.includes('원문 URL')), 'source URL leak blocked')
assert.ok(evaluateFiles(['src/pages/JobDetail.tsx', 'scripts/test-job-location-detail.mjs'], '', {'src/pages/JobDetail.tsx': '+// source_url is forbidden\n'}).length === 0, 'comment is not exposure')
console.log('Expanded policy negative/positive cases: 10/10 passed')

// #648: 봇(claude[bot])이 고친 커밋을 올린 뒤 — 작업자 줄은 옛 SHA 그대로, 봇이 새 HEAD에서 돌린 검증 줄이 있으면 통과
{
  const { BOT_PROOF_LABEL } = await import('./check-pr-ready.mjs')
  const head = 'a'.repeat(40)
  const withBot = valid.replace('| app-screen | success | 1234567890123456789012345678901234567890 |',
    `| app-screen | success | 1234567890123456789012345678901234567890 |\n| ${BOT_PROOF_LABEL} | [직접 확인] 통과 | ${head} |`)
  assert.deepEqual(checkCompletion(withBot, head, () => true), [], 'bot-only commits after old SHA + bot proof at HEAD → ok')
  assert.ok(checkCompletion(withBot, head, () => false).some(e => e.includes('옛 근거')), 'a human commit after old SHA → still stale')
  assert.ok(checkCompletion(valid, head, () => true).some(e => e.includes('옛 근거')), 'no bot proof row at HEAD → still stale')
  assert.ok(checkCompletion(withBot.replace(`[직접 확인] 통과 | ${head}`, `실패 | ${head}`), head, () => true).length > 0, 'failed bot proof → not ok')
}
// #648: 봇 검증 줄 넣기 → 같은 줄 두 번째는 바꾸기, 다른 줄은 그대로
{
  const { withBotProof } = await import('./ops/pr-bot-proof.mjs')
  const head = 'b'.repeat(40)
  const once = withBotProof(valid, head, '[직접 확인] 통과')
  assert.deepEqual(checkCompletion(once, head, () => true), [], 'inserted bot proof passes')
  const twice = withBotProof(once, 'c'.repeat(40), '[직접 확인] 통과')
  assert.equal(twice.split('\n').filter(l => l.includes('봇 수정 뒤')).length, 1, 'one bot proof row')
  assert.ok(twice.includes('| checks | success | 1234567890123456789012345678901234567890 |'), 'worker rows untouched')
  console.log('PR bot proof (#648): passed')
}

// 확인한 기록(#666): #661 사례 — companyReader.ts를 바꾸면서 최근 병합 PR #616과 같은 파일을 고치던 열린 PR #663을 안 봄
{
  const now = Date.parse('2026-11-10T16:00:00Z')
  const api = (path) => {
    if (path.startsWith('commits?') && path.includes(encodeURIComponent('src/lib/companyReader.ts'))) return [
      { commit: { message: '회사·주소 읽기: 공통 고침 (#616)\n\n본문' } },
      { commit: { message: '회사 이름 규정 (#540)' } },
      { commit: { message: '직접 올린 커밋(번호 없음)' } }]
    if (path.startsWith('commits?')) return []
    if (path.startsWith('pulls?')) return [
      { number: 663, updated_at: '2026-11-10T15:00:00Z' },
      { number: 661, updated_at: '2026-11-10T15:00:00Z' }, // 자기 자신
      { number: 300, updated_at: '2026-10-30T00:00:00Z' }] // 오래된 열린 PR은 제외
    if (path === 'pulls/663/files?per_page=100') return [{ filename: 'src/lib/companyReader.ts' }]
    throw new Error('예상 밖 호출 ' + path)
  }
  const required = recentPrsFor({ files: ['src/lib/companyReader.ts', 'WORK_LOG.md'], self: 661, now, api })
  assert.deepEqual(required.map((r) => r.num), [616, 540, 663])
  assert.match(required[2].why, /열린 PR/)
  // 칸 없음 / 하나 빠짐 / 번호만 → 실패
  assert.match(recordProblems('## 작업 범위와 변경 파일\n- 변경 파일: x', required).join(), /칸 없음/)
  const partial = '## 확인한 기록\n- #616: 회사 이름·주소 공통 고침, 같은 단계 순서를 그대로 씀\n- #540: 11-07 회사 이름 규정(한 곳에서 읽기)\n\n## 다음'
  assert.match(recordProblems(partial, required).join(), /#663 없음/)
  const bare = partial.replace('\n\n## 다음', '\n- #663\n\n## 다음')
  assert.match(recordProblems(bare, required).join(), /#663 설명 없음/)
  const full = partial.replace('\n\n## 다음', '\n- #663: 밤 근무가 같은 함수에 HAIDILAO·JMT 사례 추가 중 — 충돌 없게 그 뒤에 합침\n\n## 다음')
  assert.deepEqual(recordProblems(full, required), [])
  // #6630처럼 앞 번호가 같은 다른 번호는 #663으로 치지 않음
  assert.match(recordProblems(full.replace('#663:', '#6630:'), required).join(), /#663 없음/)
  // 볼 기록이 없으면(작업 기록만 바꾼 PR 등) 칸이 없어도 통과
  assert.deepEqual(recordProblems('본문', []), [])
  assert.deepEqual(recentPrsFor({ files: ['WORK_LOG.md'], self: 1, now, api: (p) => (p.startsWith('pulls?') ? [] : assert.fail(p)) }), [])
}
console.log('check-pr-ready: 확인한 기록(#666) 통과')
