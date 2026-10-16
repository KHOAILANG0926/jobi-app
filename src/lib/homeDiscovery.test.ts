const assert = {
  equal(a: unknown, b: unknown, note = '') { if (a !== b) throw new Error(note || `${a} !== ${b}`) },
  deepEqual(a: unknown, b: unknown, note = '') { this.equal(JSON.stringify(a), JSON.stringify(b), note) },
  ok(value: unknown) { if (!value) throw new Error('expected truthy value') },
}
import { groupDiscoveryJobs } from './homeDiscovery.ts'
const jobs = Array.from({ length: 7 }, (_, i) => ({ id: `sb-${i}` }))
assert.deepEqual(groupDiscoveryJobs([]), [])
for (const count of [1, 2, 3, 4, 7]) {
  const input = jobs.slice(0, count)
  const pages = groupDiscoveryJobs(input)
  assert.equal(pages.length, Math.ceil(count / 3))
  assert.ok(pages.every(page => page.length > 0 && page.length <= 3))
  assert.deepEqual(pages.flat(), input, 'every actual job appears once, in order')
  assert.equal(input.length, count, 'input is not mutated')
}
assert.deepEqual(groupDiscoveryJobs([jobs[0], jobs[0], ...jobs.slice(1)]).flat(), jobs)
console.log('homeDiscovery: real-job page grouping passed')
