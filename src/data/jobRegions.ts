import { jobProvinces } from '../lib/jobArea'

export const JOB_REGIONS = [
  /* ── Miền Bắc ─────────────────────────────────────────── */
  {
    id: 'hanoi',
    label: 'Hà Nội',
  },
  {
    id: 'haiphong',
    label: 'Hải Phòng',
  },
  {
    id: 'quangninh',
    label: 'Quảng Ninh',
  },
  {
    id: 'bacninh',
    label: 'Bắc Ninh',
  },
  {
    id: 'bacgiang',
    label: 'Bắc Giang',
  },
  {
    id: 'hunguyen',
    label: 'Hưng Yên',
  },
  {
    id: 'thainguyen',
    label: 'Thái Nguyên',
  },
  {
    id: 'phutho',
    label: 'Phú Thọ',
  },
  {
    id: 'ninhbinh',
    label: 'Ninh Bình',
  },

  /* ── Miền Trung ────────────────────────────────────────── */
  {
    id: 'thanhhoa',
    label: 'Thanh Hóa',
  },
  {
    id: 'nghean',
    label: 'Nghệ An',
  },
  {
    id: 'hatinh',
    label: 'Hà Tĩnh',
  },
  {
    id: 'quangtri',
    label: 'Quảng Trị',
  },
  {
    id: 'hue',
    label: 'Huế',
  },
  {
    id: 'danang',
    label: 'Đà Nẵng',
  },
  {
    id: 'quangngai',
    label: 'Quảng Ngãi',
  },
  {
    id: 'gialai',
    label: 'Gia Lai',
  },
  {
    id: 'daklak',
    label: 'Đắk Lắk',
  },
  {
    id: 'khanhhoa',
    label: 'Khánh Hòa',
  },
  {
    id: 'lamdong',
    label: 'Lâm Đồng',
  },

  /* ── Miền Nam ──────────────────────────────────────────── */
  {
    id: 'hcm',
    label: 'TP. Hồ Chí Minh',
  },
  {
    id: 'dongnai',
    label: 'Đồng Nai',
  },
  {
    id: 'tayninh',
    label: 'Tây Ninh',
  },
  {
    id: 'longan',
    label: 'Long An',
  },
  {
    id: 'dongthap',
    label: 'Đồng Tháp',
  },
  {
    id: 'angiang',
    label: 'An Giang',
  },
  {
    id: 'vinhlong',
    label: 'Vĩnh Long',
  },
  {
    id: 'cantho',
    label: 'Cần Thơ',
  },
  {
    id: 'camau',
    label: 'Cà Mau',
  },
  /* ── 2026-11-03 Lee "지역명 서로 맞춰야" — 공식 34개 성 중 빠져 있던 7곳. */
  { id: 'caobang', label: 'Cao Bằng' },
  { id: 'dienbien', label: 'Điện Biên' },
  { id: 'laichau', label: 'Lai Châu' },
  { id: 'langson', label: 'Lạng Sơn' },
  { id: 'laocai', label: 'Lào Cai' },
  { id: 'sonla', label: 'Sơn La' },
  { id: 'tuyenquang', label: 'Tuyên Quang' },
] as const

/** 지역 id → 공식 성/시(vnProvinces.ts). Bắc Giang·Long An은 2025 개편으로 합쳐진
 * 옛 성이라 예전 링크·저장값 호환용으로만 남기고 합쳐진 성으로 판정한다. */
export const REGION_PROVINCE: Record<JobRegionId, string> = {
  hanoi: 'Thành phố Hà Nội', haiphong: 'Thành phố Hải Phòng', quangninh: 'Thành phố Quảng Ninh',
  bacninh: 'Thành phố Bắc Ninh', bacgiang: 'Thành phố Bắc Ninh', hunguyen: 'Tỉnh Hưng Yên',
  thainguyen: 'Tỉnh Thái Nguyên', phutho: 'Tỉnh Phú Thọ', ninhbinh: 'Tỉnh Ninh Bình',
  thanhhoa: 'Tỉnh Thanh Hóa', nghean: 'Tỉnh Nghệ An', hatinh: 'Tỉnh Hà Tĩnh', quangtri: 'Tỉnh Quảng Trị',
  hue: 'Thành phố Huế', danang: 'Thành phố Đà Nẵng', quangngai: 'Tỉnh Quảng Ngãi', gialai: 'Tỉnh Gia Lai',
  daklak: 'Tỉnh Đắk Lắk', khanhhoa: 'Tỉnh Khánh Hòa', lamdong: 'Tỉnh Lâm Đồng',
  hcm: 'Thành phố Hồ Chí Minh', dongnai: 'Thành phố Đồng Nai', tayninh: 'Tỉnh Tây Ninh', longan: 'Tỉnh Tây Ninh',
  dongthap: 'Tỉnh Đồng Tháp', angiang: 'Tỉnh An Giang', vinhlong: 'Tỉnh Vĩnh Long', cantho: 'Thành phố Cần Thơ',
  camau: 'Tỉnh Cà Mau', caobang: 'Tỉnh Cao Bằng', dienbien: 'Tỉnh Điện Biên', laichau: 'Tỉnh Lai Châu',
  langson: 'Tỉnh Lạng Sơn', laocai: 'Tỉnh Lào Cai', sonla: 'Tỉnh Sơn La', tuyenquang: 'Tỉnh Tuyên Quang',
}

export type MacroGroupId = 'north' | 'central' | 'south'

export type JobRegionId = (typeof JOB_REGIONS)[number]['id']
export type RegionFilter = 'all' | JobRegionId

export const REGION_MACRO_TABS: {
  id: MacroGroupId
  label: string
  provinces: { id: JobRegionId; label: string }[]
}[] = [
  {
    id: 'north',
    label: 'Miền Bắc',
    provinces: [
      { id: 'hanoi', label: 'Hà Nội' },
      { id: 'haiphong', label: 'Hải Phòng' },
      { id: 'quangninh', label: 'Quảng Ninh' },
      { id: 'bacninh', label: 'Bắc Ninh' },
      { id: 'hunguyen', label: 'Hưng Yên' },
      { id: 'thainguyen', label: 'Thái Nguyên' },
      { id: 'phutho', label: 'Phú Thọ' },
      { id: 'ninhbinh', label: 'Ninh Bình' },
      { id: 'caobang', label: 'Cao Bằng' },
      { id: 'dienbien', label: 'Điện Biên' },
      { id: 'laichau', label: 'Lai Châu' },
      { id: 'langson', label: 'Lạng Sơn' },
      { id: 'laocai', label: 'Lào Cai' },
      { id: 'sonla', label: 'Sơn La' },
      { id: 'tuyenquang', label: 'Tuyên Quang' },
    ],
  },
  {
    id: 'central',
    label: 'Miền Trung',
    provinces: [
      { id: 'thanhhoa', label: 'Thanh Hóa' },
      { id: 'nghean', label: 'Nghệ An' },
      { id: 'hatinh', label: 'Hà Tĩnh' },
      { id: 'quangtri', label: 'Quảng Trị' },
      { id: 'hue', label: 'Huế' },
      { id: 'danang', label: 'Đà Nẵng' },
      { id: 'quangngai', label: 'Quảng Ngãi' },
      { id: 'gialai', label: 'Gia Lai' },
      { id: 'daklak', label: 'Đắk Lắk' },
      { id: 'khanhhoa', label: 'Khánh Hòa' },
      { id: 'lamdong', label: 'Lâm Đồng' },
    ],
  },
  {
    id: 'south',
    label: 'Miền Nam',
    provinces: [
      { id: 'hcm', label: 'TP. Hồ Chí Minh' },
      { id: 'dongnai', label: 'Đồng Nai' },
      { id: 'tayninh', label: 'Tây Ninh' },
      { id: 'dongthap', label: 'Đồng Tháp' },
      { id: 'angiang', label: 'An Giang' },
      { id: 'vinhlong', label: 'Vĩnh Long' },
      { id: 'cantho', label: 'Cần Thơ' },
      { id: 'camau', label: 'Cà Mau' },
    ],
  },
]

const PROVINCE_TO_MACRO: Partial<Record<JobRegionId, MacroGroupId>> = {}
for (const tab of REGION_MACRO_TABS) {
  for (const p of tab.provinces) {
    PROVINCE_TO_MACRO[p.id] = tab.id
  }
}

export function macroGroupForRegionId(id: JobRegionId): MacroGroupId | undefined {
  return PROVINCE_TO_MACRO[id]
}

/**
 * 2026-11-03 Lee "지역명이 서로 안 맞으면 공고 올려도 안 들어갈 거 아니야" —
 * 예전 손 목록(match 글자) 대신 공식 34개 성 판정(lib/jobArea.ts) 하나로 본다.
 * 메인·검색·추천·급구가 같은 판정을 쓰므로 새 공고는 주소만 있으면 자동으로 걸린다.
 */
export function jobMatchesRegion(
  location: string,
  regionId: JobRegionId,
  workLocations?: { rawAddress: string }[],
): boolean {
  const province = REGION_PROVINCE[regionId]
  if (!province) return true
  return jobProvinces({ location, workLocations }).includes(province)
}

/** 예전 링크·저장값의 옛 성 id(bacgiang·longan)를 지금 성 id로. */
export function currentRegionId(id: JobRegionId): JobRegionId {
  return id === 'bacgiang' ? 'bacninh' : id === 'longan' ? 'tayninh' : id
}
