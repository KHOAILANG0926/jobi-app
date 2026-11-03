// 로고 확인 검사 시험(Lee 2026-11-03). 실행: node scripts/ops/logo-check.test.mjs
import assert from 'node:assert/strict'
import { brandsWithLogo, logoCheckProblems, withoutLogoCheck } from './logo-check.mjs'

const brands = brandsWithLogo()
assert.ok(brands.has('highlands-coffee') && brands.has('wallace'), '실제 migration의 로고 브랜드를 읽음')
assert.ok(!brands.has('no-such-brand'))
const base = { source_text: 'x', images: [] }
assert.match(logoCheckProblems(base, brands)[0], /logo_check 없음/)
assert.deepEqual(logoCheckProblems({ ...base, logo_check: { result: 'brand', brand: 'wallace' } }, brands), [])
assert.match(logoCheckProblems({ ...base, logo_check: { result: 'brand', brand: 'joythai' } }, brands)[0], /등록돼 있지 않음/)
assert.match(logoCheckProblems({ ...base, logo_check: { result: 'poster' } }, brands)[0], /포스터/)
assert.deepEqual(logoCheckProblems({ ...base, images: ['a/b.png'], logo_check: { result: 'poster' } }, brands), [])
assert.match(logoCheckProblems({ ...base, logo_check: { result: 'not_found', searched: [] } }, brands)[0], /searched/)
assert.deepEqual(logoCheckProblems({ ...base, logo_check: { result: 'not_found', searched: ['Công ty ABC Bắc Ninh'] } }, brands), [])
assert.equal(logoCheckProblems({ ...base, logo_check: { result: 'found_unstored', official_url: 'http://x' } }, brands).length, 2)
assert.deepEqual(logoCheckProblems({ ...base, logo_check: { result: 'found_unstored', official_url: 'https://joythai.vn/', note: '브랜드 등록 대기' } }, brands), [])
assert.match(logoCheckProblems({ ...base, logo_check: { result: 'guess' } }, brands)[0], /중 하나/)
assert.deepEqual(Object.keys(withoutLogoCheck({ ...base, logo_check: { result: 'poster' } })), ['source_text', 'images'])
console.log('logo-check: all assertions passed')
