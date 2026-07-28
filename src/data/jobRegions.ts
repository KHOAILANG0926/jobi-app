import { normalizeViText } from '../lib/jobCoords'

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
] as const

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
    ],
  },
  {
    id: 'central',
    label: 'Miền Trung',
    provinces: [],
  },
  {
    id: 'south',
    label: 'Miền Nam',
    provinces: [],
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

export function jobMatchesRegion(location: string, regionId: JobRegionId): boolean {
  const region = JOB_REGIONS.find((r) => r.id === regionId)
  if (!region) return true
  const hay = normalizeViText(location)
  if (!hay) return false
  return region.match.some((m) => hay.includes(normalizeViText(m)))
}
