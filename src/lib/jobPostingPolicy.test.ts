import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { evaluateJobPostingPolicy, assertJobPublishable, assertPublicJobWrite, hasExcludedMoneyRole } from './jobPostingPolicy.mjs'
import { hasExcludedMoneyTerms } from './jobQualityFilter.ts'
const cases = JSON.parse(readFileSync(new URL('../../policy/job-posting-fixtures.json', import.meta.url), 'utf8'))
for (const fixture of cases) {
  const result = evaluateJobPostingPolicy(fixture.input)
  assert.equal(result.decision, fixture.expected, fixture.id)
  assert.equal(hasExcludedMoneyTerms(fixture.input), hasExcludedMoneyRole(fixture.input), fixture.id)
  if (fixture.expected === 'allow') assert.doesNotThrow(() => assertJobPublishable(fixture.input))
  else assert.throws(() => assertJobPublishable(fixture.input))
  // Same text for a new job, existing public edit and reactivation.
  const publicRow = { ...fixture.input, active: true, admin_hidden: false }
  if (fixture.expected === 'allow') {
    assert.doesNotThrow(() => assertPublicJobWrite(publicRow, { urgent: true }))
    assert.doesNotThrow(() => assertPublicJobWrite({ ...publicRow, active: false }, { active: true }))
  } else {
    assert.throws(() => assertPublicJobWrite(publicRow, { urgent: true }))
    assert.throws(() => assertPublicJobWrite({ ...publicRow, active: false }, { active: true }))
    // Hiding/ending a job is always available; no automatic change to existing rows.
    assert.doesNotThrow(() => assertPublicJobWrite(publicRow, { active: false }))
    assert.doesNotThrow(() => assertPublicJobWrite(publicRow, { admin_hidden: true }))
  }
}
assert.equal(evaluateJobPostingPolicy({ title: 'Công nhân', description: '[source:legacy]' }).decision, 'review')
assert.equal(evaluateJobPostingPolicy(cases.find((r: { id: string }) => r.id === 'high-incentive').input).reason, 'professional_incentive_sales')
console.log('posting policy: ' + cases.length + ' shared cases, edit/reactivation/hide regression passed')

for (const fixture of cases) {
  assert.deepEqual(evaluateJobPostingPolicy({ ...fixture.input, policy_decision: 'allow', policy_version: 'old' }),
    evaluateJobPostingPolicy(fixture.input), 'cached approval must not bypass current policy')
}
