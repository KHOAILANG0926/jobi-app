// skip-images 판정 시험(네트워크·브라우저 없음). 실행: node scripts/ops/skip-images.test.mjs
import assert from 'node:assert/strict'
import { isSkippableImage } from './skip-images.mjs'

const site = 'https://viecganban.vn'
const store = 'https://edhuesdnuxlbcfephutq.supabase.co/storage/v1'
assert.equal(isSkippableImage(`${store}/object/public/job-images/kda/a.png`, site), true, '공고 사진 원본')
assert.equal(isSkippableImage(`${store}/render/image/public/job-images/kda/a.png?width=192`, site), true, '공고 사진 작은 사본')
assert.equal(isSkippableImage(`${site}/logo.png`, site), true, '로고')
assert.equal(isSkippableImage(`${site}/images/industry/khac.jpg`, site), true, '업종 사진')
assert.equal(isSkippableImage(`${site}/assets/main-abc.js`, site), false, '스크립트는 받는다')
assert.equal(isSkippableImage(`${site}/api/map-locations?ids=1`, site), false, 'API는 받는다')
assert.equal(isSkippableImage('https://edhuesdnuxlbcfephutq.supabase.co/rest/v1/local_jobs?select=id', site), false, 'DB 조회는 받는다')
assert.equal(isSkippableImage('https://tiles.vietmap.vn/tm/1/2/3.pbf', site), false, '지도 타일은 받는다')
assert.equal(isSkippableImage('https://other.example/images/x.jpg', site), false, '다른 사이트는 건드리지 않는다')
console.log('skip-images: 그림만 건너뛰고 지도·API·DB·스크립트는 받는 판정 통과')
