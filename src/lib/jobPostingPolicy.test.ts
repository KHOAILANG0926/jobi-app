import cases from '../../policy/job-posting-fixtures.mjs'
import { evaluateJobPostingPolicy, assertJobPublishable, assertPublicJobWrite, hasExcludedMoneyRole } from './jobPostingPolicy.mjs'
import { hasExcludedMoneyTerms } from './jobQualityFilter.ts'
const assert = {
  equal(actual: unknown, expected: unknown, label = '') {
    if (actual !== expected) throw new Error(label + ': expected ' + String(expected) + ', got ' + String(actual))
  },
  deepEqual(actual: unknown, expected: unknown, label = '') {
    this.equal(JSON.stringify(actual), JSON.stringify(expected), label)
  },
  throws(fn: () => unknown) {
    let rejected = false
    try { fn() } catch { rejected = true }
    this.equal(rejected, true, 'expected rejection')
  },
  doesNotThrow(fn: () => unknown) { fn() },
  async rejects(fn: () => Promise<unknown>) {
    let rejected = false
    try { await fn() } catch { rejected = true }
    this.equal(rejected, true, 'expected async rejection')
  },
}
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
assert.equal(evaluateJobPostingPolicy(cases.find((r: { id: string }) => r.id === 'high-incentive')!.input).reason, 'professional_incentive_sales')
console.log('posting policy: ' + cases.length + ' shared cases, edit/reactivation/hide regression passed')

for (const fixture of cases) {
  const cachedInput = { ...fixture.input, policy_decision: 'allow', policy_version: 'old' }
  assert.deepEqual(evaluateJobPostingPolicy(cachedInput),
    evaluateJobPostingPolicy(fixture.input), 'cached approval must not bypass current policy')
}

assert.equal(evaluateJobPostingPolicy(cases.find(r => r.id === 'synthetic-v2-singular-professional')!.input).reason,
  'professional_incentive_sales', 'singular sale executive is professional')
assert.equal(evaluateJobPostingPolicy(cases.find(r => r.id === 'synthetic-v2-b2b-showroom-contract')!.input).reason,
  'b2b_business_contract_sales', 'explicit B2B contract must outrank showroom wording')
assert.equal(evaluateJobPostingPolicy(cases.find(r => r.id === 'synthetic-v2-market-no-evidence')!.input).decision,
  'review', 'market wording alone does not prove consumer outlet distribution')
console.log('v2: singular professional and B2B contract precedence verified; operational originals NOT supplied')
