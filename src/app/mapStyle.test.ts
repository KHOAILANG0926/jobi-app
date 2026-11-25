// 앱 지도 스타일(src/app/map.css)이 웹 지도 스타일과 어긋나지 않았는지 본다. map.css는 손으로 고치지 않고
// scripts/app/sync-map-css.mjs가 웹 css(index.css·homeDiscovery.css)에서 지도 규칙만 뽑아 만든다 — 웹 지도 스타일을 바꾸면
// 이 시험이 실패하고, 그때 sync 스크립트를 다시 돌려 같은 PR에 map.css를 함께 넣는다.
import { buildMapCss, MAP_SELECTOR } from './mapCss.ts'

function assert(c: unknown, m: string): asserts c { if (!c) throw new Error('FAIL: ' + m) }

// 추출 규칙 자체 확인(가짜 css)
const sample = `
/* 주석 { 안의 중괄호 } */
.jd2-vmap { position: relative; }
.other { color: red; }
.a, .hme-map__canvas, .b { width: 1px; }
@media (max-width: 600px) { .jd2-vmap__zoom { top: 1px; } .web-only { top: 2px; } }
@media (max-width: 600px) { .web-only { top: 2px; } }
.hme-pin { animation: hme-pulse 1s; }
@keyframes hme-pulse { from { opacity: 0 } to { opacity: 1 } }
@keyframes other-anim { from { opacity: 0 } to { opacity: 1 } }
`
const out = buildMapCss([{ name: 'sample.css', css: sample }])
assert(out.includes('.jd2-vmap {') && out.includes('.hme-map__canvas {'), '지도 규칙을 못 뽑음')
assert(!out.includes('.other') && !out.includes('.web-only') && !/\.a\b/.test(out), '지도가 아닌 규칙이 섞임')
assert(out.includes('@media (max-width: 600px)') && out.includes('.jd2-vmap__zoom'), '미디어 쿼리 안의 지도 규칙을 못 뽑음')
assert(out.includes('@keyframes hme-pulse') && !out.includes('other-anim'), '지도 규칙이 쓰는 keyframes만 뽑아야 함')
assert(MAP_SELECTOR.test('.jd2-vmap-modal__bar') && MAP_SELECTOR.test('.x .hme-pin.is-selected') && !MAP_SELECTOR.test('.home-card'), '지도 선택자 판정')

// 실제 파일: map.css가 웹 css에서 뽑은 것과 같아야 한다
type Fs = { readFileSync: (u: URL, enc: 'utf8') => string }
const fsModule = 'node:fs'
const fs = (await import(/* @vite-ignore */ fsModule)) as Fs
const root = new URL('../../', import.meta.url)
const read = (p: string) => fs.readFileSync(new URL(p, root), 'utf8')
const expected = buildMapCss(['src/index.css', 'src/components/home/homeDiscovery.css'].map((name) => ({ name, css: read(name) })))
const actual = read('src/app/map.css')
assert(actual === expected, '웹 지도 스타일이 바뀌었는데 src/app/map.css가 그대로임 — node --experimental-strip-types scripts/app/sync-map-css.mjs 를 돌려 map.css를 함께 갱신하세요')
console.log('mapStyle: 웹 지도 스타일 추출 규칙과 map.css 일치 확인 통과')
