/**
 * 알림(DB job_alert_detect_regions) 지역 키워드 — 화면 지역 판정(jobArea.ts)과 같은 공식 자료에서 만든다
 * (Lee 2026-11-03 "알림 34개로 맞추기"). 예전에는 jobRegions.ts의 손 목록(match)을 DB에 복사했다.
 *
 * 지역 id마다: 지금 성 이름 + 그 성에만 합쳐진 옛 성 이름 + 그 성에만 있는 옛 군/구 이름.
 * DB 함수는 긴 키워드부터 맞추고 맞춘 글자를 지우므로, 두 성에 같은 이름이 있는 옛 군/구(예: Châu Thành)는
 * 한 성으로 잘못 붙지 않게 넣지 않는다. 숫자 이름(Quận 1)이나 성 이름과 같은 옛 군/구(TP Bắc Giang)는
 * 앞말 붙은 꼴(quan 1, tp bac giang)만 넣는다.
 * SQL 시드는 scripts/data/gen-alert-region-keywords.mjs가 이 함수로 만들고, jobAlerts.test.ts가 일치를 검사한다.
 */
import { REGION_MACRO_TABS, REGION_PROVINCE, type JobRegionId } from '../data/jobRegions'
import { VN_OLD_PROVINCE_TO_NEW } from '../data/vnOldProvinces'
import { districtAliases, provinceShortName } from './jobArea'
import { normalizeViText } from './jobCoords'

const EXTRA: Partial<Record<JobRegionId, string[]>> = { hcm: ['hcm', 'tp hcm', 'tphcm', 'sai gon', 'saigon'] }

/** 성 이름 키워드(지금 성 이름·그 성에만 합쳐진 옛 성 이름·EXTRA) — 알림 판정은 화면처럼 이것을 먼저 보고,
 *  하나도 없을 때만 군·구 이름을 쓴다(Codex #625: "Phường Thanh Bình, Hải Châu, Đà Nẵng"이 Đồng Tháp의 Thanh Bình으로도 잡히던 문제). */
export function provinceKeywords(): string[] {
  return provinceKeywordPairs().map((p) => p.keyword)
}
function provinceKeywordPairs(): { regionId: JobRegionId; keyword: string }[] {
  const ids = REGION_MACRO_TABS.flatMap((t) => t.provinces.map((p) => p.id))
  const byProvince = new Map(ids.map((id) => [REGION_PROVINCE[id], id]))
  const out: { regionId: JobRegionId; keyword: string }[] = []
  for (const id of ids) {
    out.push({ regionId: id, keyword: normalizeViText(provinceShortName(REGION_PROVINCE[id])) })
    for (const e of EXTRA[id] ?? []) out.push({ regionId: id, keyword: normalizeViText(e) })
  }
  for (const [oldName, news] of Object.entries(VN_OLD_PROVINCE_TO_NEW)) {
    if (news.length !== 1) continue
    const id = byProvince.get(news[0])
    if (id) out.push({ regionId: id, keyword: normalizeViText(provinceShortName(oldName)) })
  }
  return out.filter((p) => p.keyword)
}

export function regionKeywords(): { regionId: JobRegionId; keyword: string }[] {
  const ids = REGION_MACRO_TABS.flatMap((t) => t.provinces.map((p) => p.id))
  const byProvince = new Map(ids.map((id) => [REGION_PROVINCE[id], id]))
  const pairs = new Map<string, Set<JobRegionId>>()
  const add = (k: string, id: JobRegionId) => {
    const n = normalizeViText(k)
    if (!n) return
    if (!pairs.has(n)) pairs.set(n, new Set())
    pairs.get(n)!.add(id)
  }
  // 성 이름 키워드는 provinceKeywordPairs() 한 곳(성 우선 판정 목록과 같은 규칙, Codex #625)
  for (const p of provinceKeywordPairs()) add(p.keyword, p.regionId)
  for (const d of districtAliases()) {
    const id = byProvince.get(d.province)
    if (id) for (const f of d.forms) add(f, id)
  }
  const out: { regionId: JobRegionId; keyword: string }[] = []
  for (const [keyword, set] of pairs) if (set.size === 1) out.push({ regionId: [...set][0], keyword })
  return out.sort((a, b) => a.regionId.localeCompare(b.regionId) || a.keyword.localeCompare(b.keyword))
}
