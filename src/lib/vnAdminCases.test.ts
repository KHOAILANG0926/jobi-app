// 행정구역 공통 시험(Lee 2026-11-03 "수집기도 같은 시험"): 수집기(crawler/test_vn_admin_cases.py)와 같은 문항
// (test-fixtures/vn-admin-cases.json)으로 앱 판정을 검사한다. 옛 주소 그대로 넣어 성은 정답(나뉜 옛 성은 그중 하나),
// 동은 정답이 후보에 들어 있고 틀린 동 하나로 확정하지 않아야 한다.
import { resolveJobArea, setOldWardData } from './jobAreaWards.ts'
import { VN_OLD_WARDS_BY_PROVINCE } from '../data/vnOldWards.ts'

function assert(cond: boolean, msg: string) { if (!cond) throw new Error(`FAIL: ${msg}`) }
const fsName = 'node:' + 'fs'
const { readFileSync } = (await import(/* @vite-ignore */ fsName)) as { readFileSync: (path: URL, enc: string) => string }
const { cases } = JSON.parse(readFileSync(new URL('../../test-fixtures/vn-admin-cases.json', import.meta.url), 'utf8')) as {
  cases: { old: [string, string, string]; prov: string; provOptions: string[]; wards: string[] }[]
}
setOldWardData(VN_OLD_WARDS_BY_PROVINCE)
const bad: string[] = []
for (const c of cases) {
  const r = resolveJobArea({ location: c.old.join(', '), workLocations: [] })
  if (!r.provinces.some((p) => c.provOptions.includes(p))) bad.push(`성 ${c.old.join(', ')} → ${r.provinces}`)
  if (!c.wards.every((w) => r.wards.includes(w))) bad.push(`동 누락 ${c.old.join(', ')} → ${r.wards}`)
  if (r.wards.length === 1 && !c.wards.includes(r.wards[0])) bad.push(`틀린 동 확정 ${c.old.join(', ')} → ${r.wards[0]}`)
}
assert(bad.length === 0, bad.slice(0, 5).join(' / '))
console.log(`vnAdminCases.test.ts: ${cases.length} cases passed`)
