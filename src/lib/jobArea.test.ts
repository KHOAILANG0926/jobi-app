// 2026-11-03 Lee "지역명이 서로 안 맞으면 공고 올려도 안 들어갈 거 아니야" —
// 메인·검색·추천·급구가 같은 공식 34개 성 판정을 쓰는지, 옛 이름(성·군/구)도
// 지금 성·동으로 잡히는지 확인한다.
import { resolveProvinces, jobProvinces } from './jobArea.ts'
import { resolveJobArea } from './jobAreaWards.ts'
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
  assert(resolveProvinces(['KCN Đình Trám, Việt Yên, Bắc Giang'])[0] === 'Tỉnh Bắc Ninh', 'old Bắc Giang → Bắc Ninh')
  assert(resolveProvinces(['Bến Lức, Long An'])[0] === 'Tỉnh Tây Ninh', 'old Long An → Tây Ninh')
  assert(jobMatchesRegion('Việt Yên, Bắc Giang', 'bacninh'), 'Bắc Giang address shows under Bắc Ninh')
  assert(jobMatchesRegion('Việt Yên, Bắc Giang', 'bacgiang'), 'old bacgiang link still works')
  assert(currentRegionId('bacgiang') === 'bacninh' && currentRegionId('longan') === 'tayninh', 'old ids map to current')
  assert(!jobMatchesRegion('Cầu Giấy, Hà Nội', 'bacninh'), 'Hà Nội is not Bắc Ninh')
}

// 성 이름 없이 옛 군/구만 있어도 성을 찾음
{
  assert(resolveProvinces(['Thị trấn Lim, huyện Tiên Du'])[0] === 'Tỉnh Bắc Ninh', 'old district Tiên Du → Bắc Ninh')
  assert(resolveProvinces(['Từ Sơn'])[0] === 'Tỉnh Bắc Ninh', 'Từ Sơn → Bắc Ninh')
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

// DB에 이미 채워진 값이 있으면 함께 인정(없어도 주소로 판정)
{
  const p = jobProvinces({ location: '', workLocations: [{ rawAddress: '', resolvedProvince: 'Tỉnh Bắc Ninh' }] })
  assert(p.join() === 'Tỉnh Bắc Ninh', 'stored resolved province still counts')
}

// 알림은 DB 키워드 표(job_alert_region_keywords)와 맞춘 예전 29개 그대로
{
  const ids = ALERT_REGION_TABS.flatMap((t) => t.provinces.map((p) => p.id))
  assert(ids.length === 29 && ids.includes('bacgiang') && ids.includes('longan') && !ids.includes('caobang'), 'alert list unchanged until DB migration')
}

console.log('jobArea.test.ts: all passed')
