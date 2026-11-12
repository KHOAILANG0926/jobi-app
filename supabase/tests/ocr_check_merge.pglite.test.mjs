// OCR 대조 쓰기가 다른 단계의 ocr_check 기록을 지우지 않는지 시험 (PGlite, 운영 DB 접속 없음) — #728 S7.
// 실행: npm i --no-save @electric-sql/pglite@0.5.8 && node supabase/tests/ocr_check_merge.pglite.test.mjs
import { PGlite } from '@electric-sql/pglite'
import assert from 'node:assert/strict'
import { ocrCheckUpdateSql } from '../../scripts/ocr/ocr-check-write.mjs'

const db = new PGlite()
await db.exec(`create table public.local_jobs (id bigint primary key, images jsonb default '[]', ocr_text text, ocr_check jsonb, active boolean default true,
  employer_phone text, contact_zalo text, salary text, contact_name text, company text, age_min int, age_max int);`)
// 다른 단계가 이미 쌓아 둔 기록(해시로 "이미 했음"을 판단하는 것들)
const others = { inspect: { hash: 'h1', ok: true }, screen_audit: { content_hash: 'c1', findings: [] }, business_type: { src_hash: 's1', code: '5' },
  benefits_ai: { hash: 'b1', found: [] }, detail_fill: { hash: 'd1' }, repair: { at: 'x' }, publish: 'published' }
const seed = async (id) => db.query(`insert into public.local_jobs(id, images, ocr_check, salary, company) values ($1, '["a.png"]', $2::jsonb, '7 triệu', 'ACME')`, [id, JSON.stringify({ status: 'mismatch', stale_note: 'old', ...others })])
const ocr = { status: 'ok', reader: 'r', compare_version: 'source-aware-v3', checked_at: 't', images_hash: 'IGNORED', mismatches: [] }
const row = async (id) => (await db.query('select ocr_check, ocr_text, active from public.local_jobs where id = $1', [id])).rows[0]

// 수정 전(교체) 동작 재현: 같은 입력에서 다른 단계 기록이 모두 사라진다 — 이 시험이 실제 오류를 잡는다는 증거.
const OLD = (hold) => `update public.local_jobs set ocr_text = $2, ocr_check = jsonb_set(jsonb_set($3::jsonb, '{images_hash}', to_jsonb(md5(images::text))),
  '{compared_hash}', to_jsonb(md5(to_jsonb(array[employer_phone, contact_zalo, salary, contact_name, company, age_min::text, age_max::text])::text))) ${hold ? ', active = false' : ''} where id = $1`
await seed(1)
await db.query(OLD(false), [1, 'poster text', JSON.stringify(ocr)])
const before = (await row(1)).ocr_check
assert.equal(Object.keys(others).filter((k) => k in before).length, 0, '수정 전 SQL은 다른 단계 기록을 지운다(재현)')

// 수정 후: OCR 키는 새 값, 다른 단계 기록은 그대로
await seed(2)
await db.query(ocrCheckUpdateSql(false), [2, 'poster text', JSON.stringify(ocr)])
const r2 = await row(2)
for (const [k, v] of Object.entries(others)) assert.deepEqual(r2.ocr_check[k], v, `다른 단계 기록 유지: ${k}`)
assert.equal(r2.ocr_check.status, 'ok', 'OCR 결과는 새 값으로 바뀜')
assert.equal(r2.ocr_check.images_hash.length, 32, 'images_hash는 DB에서 계산한 md5')
assert.equal(r2.ocr_check.compared_hash.length, 32, 'compared_hash는 DB에서 계산한 md5')
assert.equal(r2.ocr_text, 'poster text')
assert.equal(r2.active, true, '보류가 아니면 공개 상태를 건드리지 않음')

// 보류(R7 불일치): 같은 문장에서 비공개로, 다른 단계 기록은 그대로
await seed(3)
await db.query(ocrCheckUpdateSql(true), [3, 't', JSON.stringify({ ...ocr, status: 'mismatch' })])
const r3 = await row(3)
assert.equal(r3.active, false, 'R7 불일치는 비공개로 보류')
assert.deepEqual(r3.ocr_check.inspect, others.inspect, '보류해도 다른 단계 기록 유지')

// ocr_check가 비어 있던 공고도 정상 기록
await db.query(`insert into public.local_jobs(id, images) values (4, '[]')`)
await db.query(ocrCheckUpdateSql(false), [4, '', JSON.stringify(ocr)])
assert.equal((await row(4)).ocr_check.status, 'ok', 'ocr_check가 null이어도 기록')
console.log('ocr_check_merge.pglite.test.mjs: 수정 전 덮어쓰기 재현 + 수정 후 병합·보류·빈 값 통과')
