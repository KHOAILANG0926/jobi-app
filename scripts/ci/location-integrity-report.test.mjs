import { test } from 'node:test'
import assert from 'node:assert/strict'
import { renderLocationIntegrityReport as render } from './location-integrity-report.mjs'

test('zero means a successful empty query, malformed or failed output never means zero', () => {
  assert.equal(render([]), '위치 원본·지도 불일치 0건')
  for (const bad of [null, {}, { error: 'database unavailable' }, [{ issue: 'bad', job_id: 'x' }]])
    assert.throws(() => render(bad))
})
test('groups mismatch kinds and links generated posting IDs without selecting particular postings', () => {
  const result = render([
    { issue: 'map_cache_differs_from_source', job_id: 13, work_location_id: null },
    { issue: 'confirmed_memory_differs_from_source', job_id: 9, work_location_id: 7 },
    { issue: 'confirmed_memory_differs_from_source', job_id: 9, work_location_id: 8 },
  ])
  assert.match(result, /불일치 3건/)
  assert.match(result, /확정 기억과 원본 다름: 1개 공고/)
  assert.match(result, /https:\/\/viecganban.vn\/viec-lam\/sb-13/)
})
