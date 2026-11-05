import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { photoProcessPrProblems } from './photo-process-pr.mjs'
const pending=[{path:'new-job.json',payload:{company:'Example',logo_check:{result:'found_unstored'}}}]
assert.ok(photoProcessPrProblems('- 사진 처리: 완료',pending).length,'found_unstored cannot claim completion in PR')
assert.deepEqual(photoProcessPrProblems('- 사진 처리: 미완료',pending),[],'incomplete photo never blocks registration when disclosed')
assert.ok(photoProcessPrProblems('검사 통과, 모두 완료',pending).length,'generic completion cannot bypass explicit photo status')
assert.deepEqual(photoProcessPrProblems('ordinary code change',[]),[],'unrelated PR unchanged')
const events=readFileSync('.github/workflows/app-screen-check.yml','utf8').split('pull_request:')[1]?.split('permissions:')[0]??''
assert.match(events,/types:\s*\[[^\]]*\bedited\b/,'editing completion claim must rerun actual photo verification')
console.log('photo-process-pr: explicit pending registration and false completion rejection passed')
