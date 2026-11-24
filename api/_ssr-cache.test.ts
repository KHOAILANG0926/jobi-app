/** 공고 상세 SSR 캐시 머리글(api/_lib/ssr-cache.mjs, 2026-11-24 운영 검증 실패 #1016 sb-6337).
 * 없는 공고(404)는 캐시하지 않고, 있는 화면은 기존 공유 캐시 그대로다. api/ssr.js가 이 함수를 쓰는지도 본다(빌드 결과 없이 도는 시험). */
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { ssrCacheControl } from './_lib/ssr-cache.mjs'

assert.equal(ssrCacheControl(true), 'no-store', '없는 공고(비공개 포함)의 404는 공유 캐시에 남기지 않는다')
assert.equal(ssrCacheControl(false), 'public, max-age=0, s-maxage=120, stale-while-revalidate=600', '있는 화면은 기존 공유 캐시 그대로')
const ssr = readFileSync(new URL('./ssr.js', import.meta.url), 'utf8')
assert.match(ssr, /res\.setHeader\('Cache-Control', ssrCacheControl\(notFound\)\)/, 'SSR 응답이 같은 함수로 캐시 머리글을 정한다')
console.log('ssr cache: 404 no-store, 200 shared cache passed')
