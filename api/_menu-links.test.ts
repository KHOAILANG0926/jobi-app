// 메뉴 'Theo ngành' 링크가 실제 공고 업종 값과 같은지(2026-10-20: '?cat=factory'라서 공고가 하나도 안 나오던 문제 재발 방지).
import { readFileSync } from 'node:fs'
import { CATEGORY_VISUALS } from '../src/lib/categoryVisuals.ts'
function assert(c: boolean, m: string) { if (!c) throw new Error(`FAIL: ${m}`) }
const valid = new Set(Object.keys(CATEGORY_VISUALS))
for (const f of ['src/components/LayoutDesktop.tsx', 'src/components/LayoutMobile.tsx']) {
  const cats = [...readFileSync(f, 'utf8').matchAll(/\?cat=([a-z_]+)/g)].map((m) => m[1])
  assert(cats.length > 0, `${f}: 업종 링크 없음`)
  for (const c of cats) assert(valid.has(c), `${f}: 메뉴 업종 '${c}'는 실제 공고 업종 값이 아님`)
}
console.log('menuLinks tests: all assertions passed')
