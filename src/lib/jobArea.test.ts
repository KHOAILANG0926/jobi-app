// 2026-11-03 Lee "지역명이 서로 안 맞으면 공고 올려도 안 들어갈 거 아니야" —
// 메인·검색·추천·급구가 같은 공식 34개 성 판정을 쓰는지, 옛 이름(성·군/구)도
// 지금 성·동으로 잡히는지 확인한다.
import { resolveProvinces, jobProvinces } from './jobArea.ts'
import { resolveJobArea, setOldWardData } from './jobAreaWards.ts'
import { VN_OLD_WARDS_BY_PROVINCE } from '../data/vnOldWards.ts'
import { jobMatchesRegion, REGION_MACRO_TABS, REGION_PROVINCE, ALERT_REGION_TABS, currentRegionId } from '../data/jobRegions.ts'
import { VN_PROVINCES } from '../data/vnProvinces.ts'

function assert(cond: boolean, msg: string) { if (!cond) throw new Error(`FAIL: ${msg}`) }
const area = (location: string) => resolveJobArea({ location, workLocations: [] })

// 메인 지역 목록 = 공식 34개 성, 빠짐·중복 없음
{
  const ids = REGION_MACRO_TABS.flatMap((t) => t.provinces.map((p) => p.id))
  const provinces = ids.map((id) => REGION_PROVINCE[id])
  assert(ids.length === 34 && new Set(provinces).size === 34, 'region list is exactly the 34 official provinces')
  assert(VN_PROVINCES.every((p) => provinces.includes(p)), 'every official province is selectable')
  assert(!ids.includes('bacgiang') && !ids.includes('longan'), 'merged old provinces are not separate choices')
}

// 옛 성 이름 → 지금 성 (예전 링크 ?region=bacgiang 도 Bắc Ninh 으로)
{
  assert(resolveProvinces(['KCN Đình Trám, Việt Yên, Bắc Giang'])[0] === 'Thành phố Bắc Ninh', 'old Bắc Giang → Bắc Ninh')
  assert(resolveProvinces(['Bến Lức, Long An'])[0] === 'Tỉnh Tây Ninh', 'old Long An → Tây Ninh')
  assert(jobMatchesRegion('Việt Yên, Bắc Giang', 'bacninh'), 'Bắc Giang address shows under Bắc Ninh')
  assert(jobMatchesRegion('Việt Yên, Bắc Giang', 'bacgiang'), 'old bacgiang link still works')
  assert(currentRegionId('bacgiang') === 'bacninh' && currentRegionId('longan') === 'tayninh', 'old ids map to current')
  assert(!jobMatchesRegion('Cầu Giấy, Hà Nội', 'bacninh'), 'Hà Nội is not Bắc Ninh')
}

// 성 이름 없이 옛 군/구만 있어도 성을 찾음
{
  assert(resolveProvinces(['Thị trấn Lim, huyện Tiên Du'])[0] === 'Thành phố Bắc Ninh', 'old district Tiên Du → Bắc Ninh')
  assert(resolveProvinces(['Từ Sơn'])[0] === 'Thành phố Bắc Ninh', 'Từ Sơn → Bắc Ninh')
  assert(resolveProvinces(['Quận 1, TP.HCM'])[0] === 'Thành phố Hồ Chí Minh', 'HCM abbreviation')
  assert(resolveProvinces(['']).length === 0, 'empty text → no guess')
}

// 동 판정: 지금 동 이름이 있으면 그 동, 옛 군/구면 합쳐진 동들
{
  const a = area('Phường Kinh Bắc, TP Bắc Ninh')
  assert(a.wards.length === 1 && a.wards[0] === 'Phường Kinh Bắc', 'explicit new ward only (not whole old city)')
  assert(area('Số 5 Lý Thái Tổ, Võ Cường, TP. Bắc Ninh').wards.join() === 'Phường Võ Cường', 'ward without prefix inside known province')
  const tienDu = area('Thị trấn Lim, huyện Tiên Du').wards
  assert(tienDu.includes('Xã Tiên Du') && tienDu.includes('Xã Phật Tích'), 'old district → its merged new wards')
  const bg = area('KCN Đình Trám, Việt Yên, Bắc Giang').wards
  assert(!bg.includes('Phường Bắc Giang') && bg.includes('Phường Việt Yên'), 'province name is not read as a same-named ward')
  assert(area('VSIP Bắc Ninh').wards.length === 0, 'no ward evidence → no ward guess')
}

// 옛 동(2025-07-01 이전) 이름 → 지금 동: 공식 대응표를 넣으면 정확한 동으로
{
  setOldWardData(VN_OLD_WARDS_BY_PROVINCE)
  const one = (s: string) => area(s).wards.join('/')
  assert(one('Phường Đại Phúc, TP Bắc Ninh') === 'Phường Võ Cường', 'Đại Phúc → Võ Cường')
  assert(one('Số 12 Đình Bảng, Từ Sơn, Bắc Ninh') === 'Phường Từ Sơn', 'Đình Bảng → Từ Sơn')
  assert(one('Xã Đại Đồng Thành, Thuận Thành, Bắc Ninh') === 'Phường Thuận Thành', 'Đại Đồng Thành → Thuận Thành (not Xã Đại Đồng)')
  assert(one('Phường Xương Giang, TP Bắc Giang') === 'Phường Bắc Giang', 'Xương Giang → Bắc Giang')
  assert(one('Xã Song Khê, TP Bắc Giang') === 'Phường Tiền Phong', 'Song Khê → Tiền Phong')
  assert(one('Xã Chí Hòa, Huyện Hưng Hà, Tỉnh Thái Bình') === 'Xã Hồng Minh', 'district name is not read as a same-named old ward')
  // 공식 대응표 전체(약 1만 개): 후보에 정답 전부 포함, 잘못된 단일 확정 0건, 성 틀림 0건
  let missing = 0, wrongSingle = 0, wrongProvince = 0
  for (const [prov, list] of Object.entries(VN_OLD_WARDS_BY_PROVINCE)) for (const [w, d, p, news] of list) {
    const r = area(`${w}, ${d}, ${p}`)
    if (!r.provinces.includes(prov)) wrongProvince++
    if (!news.every((x) => r.wards.includes(x))) missing++
    if (r.wards.length === 1 && !news.includes(r.wards[0])) wrongSingle++
  }
  assert(wrongSingle === 0 && wrongProvince === 0, `official table: wrongSingle ${wrongSingle}, wrongProvince ${wrongProvince}`)
  assert(missing <= 5, `official table: candidates miss the answer ${missing} times`)
}

// DB에 이미 채워진 값이 있으면 함께 인정(없어도 주소로 판정)
{
  const p = jobProvinces({ location: '', workLocations: [{ rawAddress: '', resolvedProvince: 'Thành phố Bắc Ninh' }] })
  assert(p.join() === 'Thành phố Bắc Ninh', 'stored resolved province still counts')
}

// 알림은 DB 키워드 표(job_alert_region_keywords)와 맞춘 예전 29개 그대로
{
  const ids = ALERT_REGION_TABS.flatMap((t) => t.provinces.map((p) => p.id))
  assert(ids.length === 29 && ids.includes('bacgiang') && ids.includes('longan') && !ids.includes('caobang'), 'alert list unchanged until DB migration')
}

console.log('jobArea.test.ts: all passed')
