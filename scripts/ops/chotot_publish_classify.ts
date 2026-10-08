// chotot 공개 dry-run 분류 (읽기 전용·저장 없음): dry-run SQL의 rows(JSON)를 stdin으로 받아
// 앱과 같은 규칙(승인 핀 → KCN 영역 지도/정문 → Gọi hỏi đường)으로 공개 대상을 분류해 건수만 출력한다.
// 사용: node --experimental-strip-types --import ./scripts/ts-extensionless-register.mjs scripts/ops/chotot_publish_classify.ts < rows.json
import { findIndustrialPark, industrialParkDirectionsUrl } from '../../src/lib/industrialPark.ts'

export interface DryRunRow {
  id: number
  company: string
  phone_ok: boolean
  eligible: boolean
  agency: boolean
  approved_pin: boolean
  location: string | null
  wl: { raw_address: string | null; industrial_park: string | null }[]
}

export function classifyRows(rows: DryRunRow[]) {
  const out = { total: rows.length, targets: 0, approvedPin: 0, kcnMap: 0, kcnMapWithGate: 0, kcnMapCallOnly: 0, callOnly: 0, agencyTargets: 0, ids: { approvedPin: [] as number[], kcnMap: [] as number[], callOnly: [] as number[], agency: [] as number[] } }
  for (const r of rows) {
    if (!r.eligible) continue
    out.targets++
    if (r.agency) { out.agencyTargets++; out.ids.agency.push(r.id) }
    if (r.approved_pin) { out.approvedPin++; out.ids.approvedPin.push(r.id); continue }
    const park = findIndustrialPark(r.location, ...(r.wl ?? []).flatMap((l) => [l.industrial_park, l.raw_address]))
    if (park) {
      out.kcnMap++; out.ids.kcnMap.push(r.id)
      if (industrialParkDirectionsUrl(park)) out.kcnMapWithGate++
      else out.kcnMapCallOnly++
    } else { out.callOnly++; out.ids.callOnly.push(r.id) }
  }
  return out
}

if (process.argv[1]?.endsWith('chotot_publish_classify.ts')) {
  let input = ''
  for await (const chunk of process.stdin) input += chunk
  const rows = JSON.parse(input) as DryRunRow[]
  const r = classifyRows(rows)
  console.log(JSON.stringify({ ...r, ids: { approvedPin: r.ids.approvedPin.slice(0, 3), kcnMap: r.ids.kcnMap.slice(0, 3), callOnly: r.ids.callOnly.slice(0, 3), agency: r.ids.agency.slice(0, 3) } }, null, 1))
}
