// node --experimental-strip-types scripts/app/sync-map-css.mjs — 웹 지도 스타일을 앱 map.css로 다시 복사한다(손으로 고치지 않는다).
import { readFileSync, writeFileSync } from 'node:fs'
import { buildMapCss } from '../../src/app/mapCss.ts'

const root = new URL('../../', import.meta.url)
const sources = ['src/index.css', 'src/components/home/homeDiscovery.css'].map((name) => ({ name, css: readFileSync(new URL(name, root), 'utf8') }))
writeFileSync(new URL('src/app/map.css', root), buildMapCss(sources))
console.log('src/app/map.css 갱신')
