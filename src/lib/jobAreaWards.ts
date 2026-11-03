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

/* ── ① 옛 동(2025-07-01 이전) 이름 → 지금 동: 공식 대응표(vnOldWards.ts, 약 1만 개).
 * 표가 커서(약 0.9MB) 동 판정이 필요한 화면이 따로 불러와 setOldWardData로 넣는다.
 * 넣기 전에는 이 단계 없이 ②③으로만 판정(성 판정은 영향 없음).
 * 정확도 규칙(Lee 2026-11-03 "명확한 기준"): 옛 동 이름이 옛 군/구 이름과 같이 나오면 확정.
 * 군/구 없이 "phường/xã/thị trấn" 앞말 붙은 이름만 나오면 그 성 안에서 같은 이름이 하나일 때만.
 * 옛 동이 지금 동 여럿으로 쪼개졌으면 후보 전부(하나로 단정하지 않음). */
type OldWardEntry = [string, string, string, string[]]
type OldWardAlias = { forms: string[]; bare: string; district: string[]; newWards: string[] }
// bare: 옛 동 이름(앞말 없이). 옛 군/구 이름과 같으면 ''("Huyện Hưng Hà"를 옛 "Thị trấn Hưng Hà"로 오인 방지).
let oldWardData: Record<string, OldWardEntry[]> | null = null
const oldWardCache = new Map<string, { list: OldWardAlias[]; count: Map<string, number> }>()
export function setOldWardData(data: Record<string, OldWardEntry[]>) {
  oldWardData = data
  oldWardCache.clear()
}

const OLD_WARD_PREFIX = /^(Phường|Xã|Thị trấn) /
const OLD_WARD_FORMS: Record<string, string[]> = { 'Phường': ['phuong', 'p'], 'Xã': ['xa', 'x'], 'Thị trấn': ['thi tran', 'tt'] }
const OLD_DISTRICT_PREFIX = /^(Quận|Huyện|Thị xã|Thành phố) /
const OLD_DISTRICT_FORMS: Record<string, string[]> = { 'Quận': ['quan', 'q'], 'Huyện': ['huyen', 'h'], 'Thị xã': ['thi xa', 'tx'], 'Thành phố': ['thanh pho', 'tp'] }

let provinceNameCache: Set<string> | null = null
const PROVINCE_NAMES = () => (provinceNameCache ??= new Set([...VN_PROVINCES, ...Object.keys(VN_OLD_PROVINCE_TO_NEW)].map((p) => normalizeViText(provinceShortName(p)))))

function oldWardsOf(province: string) {
  const hit = oldWardCache.get(province)
  if (hit || !oldWardData) return hit ?? null
  const list: OldWardAlias[] = []
  const count = new Map<string, number>()
  for (const [ward, district, , newWards] of oldWardData[province] ?? []) {
    const m = OLD_WARD_PREFIX.exec(ward)
    const bare = normalizeViText(ward.replace(OLD_WARD_PREFIX, ''))
    if (!bare) continue
    const dm = OLD_DISTRICT_PREFIX.exec(district)
    const dBare = normalizeViText(district.replace(OLD_DISTRICT_PREFIX, ''))
    // 숫자 이름(Quận 1)이나 성 이름과 같은 군/구(Thành phố Cao Bằng)는 앞말이 붙어야만 — "Tỉnh Cao Bằng"을
    // 옛 Cao Bằng 시로 읽으면 같은 이름의 다른 군/구 옛 동이 잘못 확정된다.
    const numeric = /^\d+$/.test(dBare) || PROVINCE_NAMES().has(dBare)
    const dForms = [...(numeric ? [] : [dBare]), ...(dm ? OLD_DISTRICT_FORMS[dm[1]] ?? [] : []).map((f) => `${f} ${dBare}`)]
    list.push({ forms: (m ? OLD_WARD_FORMS[m[1]] ?? [] : []).map((f) => `${f} ${bare}`), bare: /^\d+$/.test(bare) || bare === dBare ? '' : bare, district: dForms, newWards })
    for (const f of list[list.length - 1].forms) count.set(f, (count.get(f) ?? 0) + 1)
  }
  // 긴 이름 먼저 — "Tạ An Khương Nam"을 맞춘 뒤 지워야 "Tạ An Khương"이 또 잡히지 않는다.
  list.sort((x, y) => Math.max(y.bare.length, ...y.forms.map((f) => f.length)) - Math.max(x.bare.length, ...x.forms.map((f) => f.length)))
  const v = { list, count }
  oldWardCache.set(province, v)
  return v
}

/** 옛 동 판정. 맞춘 글자는 hay에서 지워 ② 지금 동 판정에서 다시 잡히지 않게 한다
 * ("Xã Đại Đồng Thành"이 지금 "Xã Đại Đồng"으로 잘못 붙던 문제). */
function matchOldWards(hay: string, provinces: string[]): { wards: Set<string>; hay: string } {
  const wards = new Set<string>()
  let masked = hay
  // 1차: 옛 군/구 이름이 같이 나온 옛 동(확정). 같은 글자에 맞는 항목은 모두 받고 나서 지운다.
  // 2차: 군/구 없이 앞말 붙은 이름만 — 그 성 안에서 같은 이름이 하나일 때만.
  for (const pass of [1, 2]) {
    const phrases = new Set<string>()
    for (const p of provinces) {
      const idx = oldWardsOf(p)
      if (!idx) continue
      for (const o of idx.list) {
        const prefixed = o.forms.find((f) => hasPhrase(masked, f))
        const withDistrict = o.district.some((f) => hasPhrase(hay, f))
        const ok = pass === 1
          ? withDistrict && (prefixed || (o.bare && hasPhrase(masked, o.bare)))
          : !withDistrict && prefixed && idx.count.get(prefixed) === 1
        if (!ok) continue
        o.newWards.forEach((w) => wards.add(w))
        phrases.add(prefixed ?? o.bare)
      }
    }
    for (const ph of phrases) masked = masked.split(` ${ph} `).join('   ')
  }
  return { wards, hay: masked }
}

export function resolveJobArea(job: JobAreaSource & { workLocations?: { resolvedWards?: string[] | null }[] }): JobArea {
  const locs = job.workLocations ?? []
  const fullHay = normalizedHay([job.location, ...locs.map((l) => l.rawAddress)])
  let provinces = jobProvinces(job)

  // ① 옛 동(성을 알 때만 — 같은 옛 동 이름이 전국에 많음)
  const old = matchOldWards(fullHay, provinces)
  const hay = old.hay

  // ② 지금 동
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
  // ①에서 옛 동을 찾았으면 ②는 "phường/xã" 앞말까지 적힌 지금 동만 더한다 — 앞말 없는 이름은
  // 대개 옛 군/구 이름(예: "Huyện Tiên Du"의 Tiên Du = 지금 Xã Tiên Du)이라 엉뚱한 동이 붙는다.
  const keptHits = wardHits.filter((w) => provinces.includes(w.province) && (old.wards.size === 0 || w.prefixed.some((f) => hasPhrase(hay, f))))
  const wards = new Set([...old.wards, ...keptHits.map((w) => w.ward)])

  // ③ 옛 군/구: 동 이름이 안 나왔을 때, 또는 나온 동 이름이 옛 군/구 이름과 같을 때
  // ("KCN Quế Võ"의 Quế Võ는 새 Phường Quế Võ이면서 옛 Thị xã Quế Võ 전체일 수 있음)
  // 그 군/구가 합쳐진 새 동들을 후보로 더한다. ①에서 옛 동을 찾았으면 더하지 않는다.
  const hitBare = new Set(keptHits.map((w) => normalizeViText(w.ward.replace(WARD_PREFIX, ''))))
  const hadWardHits = wards.size > 0
  if (provinces.length > 0 && old.wards.size === 0) {
    for (const d of districtAliases()) {
      if (!provinces.includes(d.province) || !d.forms.some((f) => hasPhrase(hay, f))) continue
      if (hadWardHits && !hitBare.has(normalizeViText(d.district.replace(/^(Quận|Huyện|Thị xã|Thành phố) /, '')))) continue
      for (const w of VN_WARDS_BY_DISTRICT[d.province]?.[d.district] ?? []) wards.add(w)
    }
  }
  for (const l of locs) for (const w of l.resolvedWards ?? []) wards.add(w)
  return { provinces, wards: [...wards] }
}
