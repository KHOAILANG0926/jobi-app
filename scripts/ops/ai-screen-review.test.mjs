// 따로 읽는 검사관 답 읽기 시험(node --test)
import test from 'node:test'
import assert from 'node:assert/strict'
import { parseReview, REVIEW_ITEMS } from './ai-screen-review.mjs'

const all = (over = {}) => JSON.stringify(REVIEW_ITEMS.map(([key]) => ({ key, verdict: over[key] ?? 'ok', detail: over[key] ? '틀림 예' : '' })))

test('모두 맞음이면 오류 없음', () => assert.deepEqual(parseReview(all()), []))
test('틀림은 확정 오류, 모름은 불명확', () => {
  const r = parseReview('답:\n' + all({ nganh_nghe: 'wrong', image: 'unsure' }))
  assert.deepEqual(r.map((f) => [f.key, f.sure]), [['ai_nganh_nghe', true], ['ai_image', false]])
})
test('못 읽은 답·빠진 항목은 확정 오류(검사 안 된 채 공개 금지)', () => {
  assert.equal(parseReview('모르겠음')[0].sure, true)
  const r = parseReview(JSON.stringify([{ key: 'salary', verdict: 'ok' }]))
  assert.equal(r.at(-1).key, 'ai_review'); assert.equal(r.at(-1).sure, true)
})
