/**
 * 공고 동/사(2025 개편 후) 판정 — jobArea.ts의 성/시 판정 위에 동 단계까지.
 * 자료가 커서(전국 동 3,321개 + 옛 군/구→새 동 대응표) 동 단계 필터가 있는
 * 화면(급구)만 이 모듈을 가져온다.
 *
 * 순서: ① 주소에 지금 동 이름(Phường Kinh Bắc 등) → 그 동
 *       ② 없으면 옛 군/구 이름(Huyện Tiên Du 등) → 그 군/구가 합쳐진 새 동들
 * 성을 모르면 "phường/xã" 앞말이 붙은 동 이름만 인정한다(같은 이름의 동이 여러
 * 성에 있어 단정할 수 없기 때문). 옛 동(2025 이전) 이름 자체는 자료가 없어 보지
 * 않는다 — 주소에 옛 군/구나 성이 같이 있으면 ②로 잡힌다.
 */
import { VN_PROVINCES } from '../data/vnProvinces'
import { VN_WARDS_BY_PROVINCE } from '../data/vnWards'
import { VN_WARDS_BY_DISTRICT } from '../data/vnDistricts'
import { VN_OLD_PROVINCE_TO_NEW } from '../data/vnOldProvinces'
import { districtAliases, hasPhrase, jobProvinces, normalizedHay, provinceShortName, type JobAreaSource } from './jobArea'
import { normalizeViText } from './jobCoords'

const WARD_PREFIX = /^(Phường|Xã|Đặc khu) /
const WARD_PREFIX_FORMS: Record<string, string[]> = {
  'Phường': ['phuong', 'p'],
  'Xã': ['xa', 'x'],
  'Đặc khu': ['dac khu'],
}

type WardAlias = { bare: string; prefixed: string[]; province: string; ward: string }
let wardCache: WardAlias[] | null = null

function wardAliases(): WardAlias[] {
  if (wardCache) return wardCache
  // 지금 성 + 옛 성 이름(Bắc Giang·Long An 등) 모두 — 같은 이름의 동은 앞말이 있어야만.
  const provinceNames = new Set([...VN_PROVINCES, ...Object.keys(VN_OLD_PROVINCE_TO_NEW)].map((p) => normalizeViText(provinceShortName(p))))
  const out: WardAlias[] = []
  for (const [province, wards] of Object.entries(VN_WARDS_BY_PROVINCE)) {
    for (const ward of wards) {
      const m = WARD_PREFIX.exec(ward)
      const bare = normalizeViText(ward.replace(WARD_PREFIX, ''))
      if (!bare) continue
      const prefixed = (m ? WARD_PREFIX_FORMS[m[1]] ?? [] : []).map((f) => `${f} ${bare}`)
      // 성 이름과 같은 동(Phường Bắc Giang 등)은 앞말이 있어야만 — "Bắc Giang"만 보고 단정 금지.
      out.push({ bare: provinceNames.has(bare) || /^\d+$/.test(bare) ? '' : bare, prefixed, province, ward })
    }
  }
  return (wardCache = out)
}

export interface JobArea {
  provinces: string[]
  wards: string[]
}

export function resolveJobArea(job: JobAreaSource & { workLocations?: { resolvedWards?: string[] | null }[] }): JobArea {
  const locs = job.workLocations ?? []
  const hay = normalizedHay([job.location, ...locs.map((l) => l.rawAddress)])
  let provinces = jobProvinces(job)

  const wardHits = wardAliases().filter((w) =>
    provinces.length > 0
      ? provinces.includes(w.province) && ((w.bare && hasPhrase(hay, w.bare)) || w.prefixed.some((f) => hasPhrase(hay, f)))
      : w.prefixed.some((f) => hasPhrase(hay, f)),
  )
  // 성을 몰랐는데 앞말 붙은 동 이름이 한 성 안에서만 나오면 그 성으로 확정.
  if (provinces.length === 0) {
    const ps = new Set(wardHits.map((w) => w.province))
    if (ps.size === 1) provinces = [...ps]
  }
  const wards = new Set(wardHits.filter((w) => provinces.includes(w.province)).map((w) => w.ward))

  // ② 옛 군/구: 동 이름이 안 나왔을 때, 또는 나온 동 이름이 옛 군/구 이름과 같을 때
  // ("KCN Quế Võ"의 Quế Võ는 새 Phường Quế Võ이면서 옛 Thị xã Quế Võ 전체일 수 있음)
  // 그 군/구가 합쳐진 새 동들을 후보로 더한다.
  const hitBare = new Set(wardHits.filter((w) => provinces.includes(w.province)).map((w) => normalizeViText(w.ward.replace(WARD_PREFIX, ''))))
  const hadWardHits = wards.size > 0
  if (provinces.length > 0) {
    for (const d of districtAliases()) {
      if (!provinces.includes(d.province) || !d.forms.some((f) => hasPhrase(hay, f))) continue
      if (hadWardHits && !hitBare.has(normalizeViText(d.district.replace(/^(Quận|Huyện|Thị xã|Thành phố) /, '')))) continue
      for (const w of VN_WARDS_BY_DISTRICT[d.province]?.[d.district] ?? []) wards.add(w)
    }
  }
  for (const l of locs) for (const w of l.resolvedWards ?? []) wards.add(w)
  return { provinces, wards: [...wards] }
}
