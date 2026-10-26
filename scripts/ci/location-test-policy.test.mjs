import { test } from 'node:test'
import assert from 'node:assert/strict'
import { fixedLocationSelectors as check } from './location-test-policy.mjs'

test('rejects fixed runtime selectors, permits generated fixtures and dynamic enumeration', () => {
  assert.equal(check("fetch('/api/map-locations?ids=sb-12345')").length, 1)
  assert.equal(check('jobs.filter(job => job.id === 12345)').length, 1)
  assert.equal(check('select * from jobs where id=12345').length, 1)
  assert.deepEqual(check('insert into jobs(title) values($1) returning id'), [])
  assert.deepEqual(check('for (const job of jobs) compare(job.id, points)'), [])
})
