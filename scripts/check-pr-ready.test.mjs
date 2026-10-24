import assert from 'node:assert/strict'
import { checkCompletion } from './check-pr-ready.mjs'
import { evaluateFiles } from './check-repository-policy.mjs'

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

## 최종 상태
- [ ] BLOCKED
- [x] READY FOR APPROVAL
- [ ] MERGED`

assert.deepEqual(checkCompletion(valid, '1234567890123456789012345678901234567890'), [])
assert.ok(checkCompletion(valid, 'aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa').length > 0, 'old HEAD evidence rejected')
assert.ok(checkCompletion(valid.replace('| app-screen | success |', '| app-screen | failure |'), '1234567890123456789012345678901234567890').length > 0, 'failed screen check rejected')
assert.ok(checkCompletion('').length > 0)
assert.ok(checkCompletion(valid.replace('https://github.com/KHOAILANG0926/jobi-app/actions/runs/12345', '')).length > 0)
assert.ok(checkCompletion(valid.replace('- [x] READY FOR APPROVAL', '- [ ] READY FOR APPROVAL')).length > 0)
assert.ok(checkCompletion(valid.replace('1234567890123456789012345678901234567890', 'pending')).length > 0)
console.log('PR completion guard: 7/7 passed')

assert.ok(evaluateFiles(['scripts/status/generate-status.mjs']).length > 0, 'STATUS edits denied')
assert.ok(evaluateFiles(['supabase/migrations/20261024.sql']).length > 0, 'DB mutation denied')
assert.ok(evaluateFiles(['src/lib/jobDetailSections.ts']).length > 0, 'unverified detail categorization denied')
assert.deepEqual(evaluateFiles(['src/lib/jobDetailSections.ts', 'src/lib/jobDetailSections.test.ts']), [], 'covered detail classification allowed')
assert.ok(evaluateFiles(['src/pages/JobDetail.tsx']).length > 0, 'detail UI requires regression proof')
console.log('Repository policy negative tests: 5/5 passed')
