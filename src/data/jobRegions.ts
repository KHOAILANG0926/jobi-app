import { jobProvinces } from '../lib/jobArea'

export const JOB_REGIONS = [
  /* ── Miền Bắc ─────────────────────────────────────────── */
  {
    id: 'hanoi',
    label: 'Hà Nội',
    match: [
      'ha noi', 'hanoi', 'ha dong', 'cau giay', 'dong da', 'hoan kiem',
      'long bien', 'nam tu liem', 'bac tu liem', 'hai ba trung', 'tay ho',
      'thanh xuan', 'hoa binh', 'luong son', 'ky son',
    ],
  },
  {
    id: 'haiphong',
    label: 'Hải Phòng',
    match: [
      'hai phong', 'ngo quyen', 'le chan', 'kien an',
      'hai duong', 'chi linh', 'cam giang', 'tu ky', 'nam sach', 'kinh mon',
    ],
  },
  {
    id: 'quangninh',
    label: 'Quảng Ninh',
    match: ['quang ninh', 'ha long', 'cam pha', 'mong cai', 'uong bi', 'lang son', 'dong dang'],
  },
  {
    id: 'bacninh',
    label: 'Bắc Ninh',
    match: ['bac ninh', 'tu son', 'yen phong', 'tien du', 'que vo'],
  },
  {
    id: 'bacgiang',
    label: 'Bắc Giang',
    match: ['bac giang', 'viet yen', 'yen the', 'hiep hoa', 'lang giang'],
  },
  {
    id: 'hunguyen',
    label: 'Hưng Yên',
    match: [
      'hung yen', 'my hao', 'pho noi', 'yen my', 'kim dong', 'khoai chau',
      'thai binh', 'dong hung', 'quynh phu', 'vu thu',
    ],
  },
  {
    id: 'thainguyen',
    label: 'Thái Nguyên',
    match: ['thai nguyen', 'song cong', 'pho yen', 'dai tu', 'bac kan', 'bac kan'],
  },
  {
    id: 'phutho',
    label: 'Phú Thọ',
    match: [
      'phu tho', 'viet tri', 'lam thao',
      'vinh phuc', 'vinh yen', 'phuc yen', 'lap thach',
    ],
  },
  {
    id: 'ninhbinh',
    label: 'Ninh Bình',
    match: [
      'ninh binh', 'tam diep', 'hoa lu',
      'nam dinh', 'my loc', 'y yen',
      'ha nam', 'phu ly', 'duy tien',
    ],
  },

  /* ── Miền Trung ────────────────────────────────────────── */
  {
    id: 'thanhhoa',
    label: 'Thanh Hóa',
    match: ['thanh hoa', 'sam son', 'bim son'],
  },
  {
    id: 'nghean',
    label: 'Nghệ An',
    match: ['nghe an', 'vinh', 'tp vinh', 'cua lo'],
  },
  {
    id: 'hatinh',
    label: 'Hà Tĩnh',
    match: ['ha tinh', 'hong linh', 'ky anh'],
  },
  {
    id: 'quangtri',
    label: 'Quảng Trị',
    match: ['quang tri', 'dong ha', 'quang binh', 'dong hoi', 'ba don'],
  },
  {
    id: 'hue',
    label: 'Huế',
    match: ['hue', 'thua thien hue', 'phu hau', 'tp hue'],
  },
  {
    id: 'danang',
    label: 'Đà Nẵng',
    match: [
      'da nang', 'danang', 'hai chau', 'son tra', 'cam le', 'lien chieu',
      'quang nam', 'hoi an', 'tam ky', 'dien ban',
    ],
  },
  {
    id: 'quangngai',
    label: 'Quảng Ngãi',
    match: ['quang ngai', 'tu nghia', 'son ha'],
  },
  {
    id: 'gialai',
    label: 'Gia Lai',
    match: [
      'gia lai', 'pleiku', 'an khe',
      'binh dinh', 'quy nhon', 'quy nhơn',
    ],
  },
  {
    id: 'daklak',
    label: 'Đắk Lắk',
    match: ['dak lak', 'buon ma thuot', 'buon ho'],
  },
  {
    id: 'khanhhoa',
    label: 'Khánh Hòa',
    match: [
      'khanh hoa', 'nha trang', 'cam ranh',
      'phu yen', 'tuy hoa', 'song cau',
      'ninh thuan', 'phan rang',
    ],
  },
  {
    id: 'lamdong',
    label: 'Lâm Đồng',
    match: [
      'lam dong', 'da lat', 'bao loc',
      'dak nong', 'gia nghia',
      'binh thuan', 'phan thiet', 'la gi',
    ],
  },

  /* ── Miền Nam ──────────────────────────────────────────── */
  {
    id: 'hcm',
    label: 'TP. Hồ Chí Minh',
    match: [
      'ho chi minh', 'tp ho chi minh', 'tp hcm', 'hcm', 'sai gon',
      'quan 1', 'quan 3', 'quan 7', 'binh thanh', 'thu duc', 'go vap', 'tan binh', 'phu nhuan',
      'binh duong', 'thu dau mot', 'di an', 'thuan an', 'tan uyen',
      'ba ria', 'vung tau', 'ba ria vung tau', 'br vt',
    ],
  },
  {
    id: 'dongnai',
    label: 'Đồng Nai',
    match: ['dong nai', 'bien hoa', 'long thanh', 'trang bom'],
  },
  {
    id: 'tayninh',
    label: 'Tây Ninh',
    match: ['tay ninh', 'tay ninh city', 'go dau', 'trang bang'],
  },
  {
    id: 'longan',
    label: 'Long An',
    match: [
      'long an', 'tan an', 'ben luc', 'duc hoa',
      'tien giang', 'my tho', 'cai lay', 'go cong',
    ],
  },
  {
    id: 'dongthap',
    label: 'Đồng Tháp',
    match: ['dong thap', 'cao lanh', 'sa dec', 'hong ngu'],
  },
  {
    id: 'angiang',
    label: 'An Giang',
    match: [
      'an giang', 'long xuyen', 'chau doc',
      'kien giang', 'rach gia', 'ha tien', 'phu quoc',
    ],
  },
  {
    id: 'vinhlong',
    label: 'Vĩnh Long',
    match: [
      'vinh long', 'vinh long city',
      'ben tre', 'tra vinh',
    ],
  },
  {
    id: 'cantho',
    label: 'Cần Thơ',
    match: [
      'can tho', 'ninh kieu', 'cai rang',
      'soc trang', 'hau giang', 'vi thanh',
    ],
  },
  {
    id: 'camau',
    label: 'Cà Mau',
    match: ['ca mau', 'bac lieu', 'soc trang'],
  },
  /* ── 2026-11-03 Lee "지역명 서로 맞춰야" — 공식 34개 성 중 빠져 있던 7곳.
   * match는 비워 둔다: match는 job_alert_region_keywords(DB 알림 판정) 시드와
   * 1:1로 맞춰야 하는 목록이라(jobAlerts.test.ts), 알림 쪽은 DB migration 전까지
   * 바꾸지 않는다. 화면 필터는 match가 아니라 jobArea.ts 판정을 쓴다. */
  { id: 'caobang', label: 'Cao Bằng', match: [] },
  { id: 'dienbien', label: 'Điện Biên', match: [] },
  { id: 'laichau', label: 'Lai Châu', match: [] },
  { id: 'langson', label: 'Lạng Sơn', match: [] },
  { id: 'laocai', label: 'Lào Cai', match: [] },
  { id: 'sonla', label: 'Sơn La', match: [] },
  { id: 'tuyenquang', label: 'Tuyên Quang', match: [] },
] as const

/** 지역 id → 공식 성/시(vnProvinces.ts). Bắc Giang·Long An은 2025 개편으로 합쳐진
 * 옛 성이라 예전 링크·저장값 호환용으로만 남기고 합쳐진 성으로 판정한다. */
export const REGION_PROVINCE: Record<JobRegionId, string> = {
  hanoi: 'Thành phố Hà Nội', haiphong: 'Thành phố Hải Phòng', quangninh: 'Tỉnh Quảng Ninh',
  bacninh: 'Tỉnh Bắc Ninh', bacgiang: 'Tỉnh Bắc Ninh', hunguyen: 'Tỉnh Hưng Yên',
  thainguyen: 'Tỉnh Thái Nguyên', phutho: 'Tỉnh Phú Thọ', ninhbinh: 'Tỉnh Ninh Bình',
  thanhhoa: 'Tỉnh Thanh Hóa', nghean: 'Tỉnh Nghệ An', hatinh: 'Tỉnh Hà Tĩnh', quangtri: 'Tỉnh Quảng Trị',
  hue: 'Thành phố Huế', danang: 'Thành phố Đà Nẵng', quangngai: 'Tỉnh Quảng Ngãi', gialai: 'Tỉnh Gia Lai',
  daklak: 'Tỉnh Đắk Lắk', khanhhoa: 'Tỉnh Khánh Hòa', lamdong: 'Tỉnh Lâm Đồng',
  hcm: 'Thành phố Hồ Chí Minh', dongnai: 'Tỉnh Đồng Nai', tayninh: 'Tỉnh Tây Ninh', longan: 'Tỉnh Tây Ninh',
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

/** 알림(JobAlertsPanel) 전용 — DB job_alert_region_keywords에 있는 예전 29개 그대로.
 * 알림 판정은 DB 함수라, 공식 34개로 맞추려면 별도 migration(STRICT)이 필요하다. */
const ALERT_EXTRA: Partial<Record<JobRegionId, { id: JobRegionId; label: string }>> = {
  bacninh: { id: 'bacgiang', label: 'Bắc Giang' },
  tayninh: { id: 'longan', label: 'Long An' },
}
const ALERT_EXCLUDED = new Set<JobRegionId>(['caobang', 'dienbien', 'laichau', 'langson', 'laocai', 'sonla', 'tuyenquang'])
export const ALERT_REGION_TABS: typeof REGION_MACRO_TABS = REGION_MACRO_TABS.map((tab) => ({
  ...tab,
  provinces: tab.provinces.filter((p) => !ALERT_EXCLUDED.has(p.id)).flatMap((p) => (ALERT_EXTRA[p.id] ? [p, ALERT_EXTRA[p.id]!] : [p])),
}))

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
  workLocations?: { rawAddress: string; resolvedProvince?: string | null }[],
): boolean {
  const province = REGION_PROVINCE[regionId]
  if (!province) return true
  return jobProvinces({ location, workLocations }).includes(province)
}

/** 예전 링크·저장값의 옛 성 id(bacgiang·longan)를 지금 성 id로. */
export function currentRegionId(id: JobRegionId): JobRegionId {
  return id === 'bacgiang' ? 'bacninh' : id === 'longan' ? 'tayninh' : id
}
