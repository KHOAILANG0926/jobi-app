import { normalizeViText } from '../lib/jobCoords'

/** Thứ tự: giống app Hàn — metro lớn trước, sau đó mở rộng. */
export const JOB_REGIONS = [
  {
    id: 'hanoi',
    label: 'Hà Nội',
    match: [
      'ha noi',
      'hanoi',
      'ha dong',
      'cau giay',
      'dong da',
      'hoan kiem',
      'long bien',
      'nam tu liem',
      'bac tu liem',
      'hai ba trung',
      'tay ho',
      'thanh xuan',
    ],
  },
  {
    id: 'hcm',
    label: 'TP. Hồ Chí Minh',
    match: [
      'ho chi minh',
      'tp ho chi minh',
      'tp hcm',
      'hcm',
      'sai gon',
      'quan 1',
      'quan 3',
      'quan 7',
      'binh thanh',
      'thu duc',
      'go vap',
      'tan binh',
      'phu nhuan',
    ],
  },
  {
    id: 'danang',
    label: 'Đà Nẵng',
    match: ['da nang', 'danang', 'hai chau', 'son tra', 'cam le', 'lien chieu'],
  },
  {
    id: 'binhduong',
    label: 'Bình Dương',
    match: ['binh duong', 'thu dau mot', 'di an', 'thuan an', 'tan uyen'],
  },
  {
    id: 'dongnai',
    label: 'Đồng Nai',
    match: ['dong nai', 'bien hoa', 'long thanh', 'trang bom'],
  },
  {
    id: 'cantho',
    label: 'Cần Thơ',
    match: ['can tho', 'ninh kieu', 'cai rang'],
  },
  {
    id: 'haiphong',
    label: 'Hải Phòng',
    match: ['hai phong', 'ngo quyen', 'le chan', 'kien an'],
  },
  {
    id: 'nhatrang',
    label: 'Nha Trang',
    match: ['nha trang', 'khanh hoa', 'cam ranh'],
  },
  {
    id: 'hue',
    label: 'Huế',
    match: ['hue', 'thua thien hue', 'phu hau', 'tp hue'],
  },
  {
    id: 'vungtau',
    label: 'Vũng Tàu',
    match: ['vung tau', 'ba ria', 'ba ria vung tau', 'br vt'],
  },
  {
    id: 'bacninh',
    label: 'Bắc Ninh',
    match: ['bac ninh', 'tu son', 'yen phong'],
  },
  {
    id: 'quangninh',
    label: 'Quảng Ninh',
    match: ['quang ninh', 'ha long', 'cam pha', 'mong cai', 'uong bi'],
  },
  {
    id: 'lamdong',
    label: 'Đà Lạt / Lâm Đồng',
    match: ['da lat', 'lam dong', 'bao loc', 'don duong'],
  },
  {
    id: 'binhdinh',
    label: 'Bình Định',
    match: ['binh dinh', 'quy nhon', 'quy nhơn'],
  },
  {
    id: 'angiang',
    label: 'An Giang',
    match: ['an giang', 'long xuyen', 'chau doc'],
  },
  {
    id: 'haiduong',
    label: 'Hải Dương',
    match: ['hai duong', 'chi linh', 'cam giang', 'tu ky', 'nam sach', 'kinh mon'],
  },
  {
    id: 'thainguyen',
    label: 'Thái Nguyên',
    match: ['thai nguyen', 'song cong', 'pho yen', 'dai tu'],
  },
  {
    id: 'phutho',
    label: 'Phú Thọ',
    match: ['phu tho', 'viet tri', 'lam thao'],
  },
  {
    id: 'namdinh',
    label: 'Nam Định',
    match: ['nam dinh', 'my loc', 'y yen'],
  },
  {
    id: 'ninhbinh',
    label: 'Ninh Bình',
    match: ['ninh binh', 'tam diep', 'hoa lu'],
  },
  {
    id: 'vinhphuc',
    label: 'Vĩnh Phúc',
    match: ['vinh phuc', 'vinh yen', 'phuc yen'],
  },
  {
    id: 'bacgiang',
    label: 'Bắc Giang',
    match: ['bac giang', 'viet yen', 'yen the'],
  },
  {
    id: 'quangnam',
    label: 'Quảng Nam',
    match: ['quang nam', 'hoi an', 'tam ky', 'dien ban'],
  },
  {
    id: 'quangngai',
    label: 'Quảng Ngãi',
    match: ['quang ngai', 'tu nghia', 'son ha'],
  },
  {
    id: 'phuyen',
    label: 'Phú Yên',
    match: ['phu yen', 'tuy hoa', 'song cau'],
  },
  {
    id: 'nghean',
    label: 'Nghệ An',
    match: ['nghe an', 'vinh', 'tp vinh', 'cua lo'],
  },
  {
    id: 'thanhhoa',
    label: 'Thanh Hóa',
    match: ['thanh hoa', 'sam son', 'bim son', 'thanh hóa'],
  },
  {
    id: 'hatinh',
    label: 'Hà Tĩnh',
    match: ['ha tinh', 'hong linh', 'ky anh'],
  },
  {
    id: 'longan',
    label: 'Long An',
    match: ['long an', 'tan an', 'ben luc', 'duc hoa'],
  },
  {
    id: 'tiengiang',
    label: 'Tiền Giang',
    match: ['tien giang', 'my tho', 'cai lay', 'go cong'],
  },
  {
    id: 'dongthap',
    label: 'Đồng Tháp',
    match: ['dong thap', 'cao lanh', 'sa dec', 'hong ngu'],
  },
] as const

export type MacroGroupId = 'north' | 'central' | 'south'

export type JobRegionId = (typeof JOB_REGIONS)[number]['id']
export type RegionFilter = 'all' | JobRegionId

/** Tabs + province pills for the home region filter UI. */
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
      { id: 'haiduong', label: 'Hải Dương' },
      { id: 'thainguyen', label: 'Thái Nguyên' },
      { id: 'phutho', label: 'Phú Thọ' },
      { id: 'vinhphuc', label: 'Vĩnh Phúc' },
      { id: 'bacgiang', label: 'Bắc Giang' },
      { id: 'namdinh', label: 'Nam Định' },
      { id: 'ninhbinh', label: 'Ninh Bình' },
    ],
  },
  {
    id: 'central',
    label: 'Miền Trung',
    provinces: [
      { id: 'danang', label: 'Đà Nẵng' },
      { id: 'hue', label: 'Huế' },
      { id: 'nhatrang', label: 'Khánh Hòa' },
      { id: 'lamdong', label: 'Đà Lạt' },
      { id: 'binhdinh', label: 'Bình Định' },
      { id: 'quangnam', label: 'Quảng Nam' },
      { id: 'quangngai', label: 'Quảng Ngãi' },
      { id: 'phuyen', label: 'Phú Yên' },
      { id: 'thanhhoa', label: 'Thanh Hóa' },
      { id: 'nghean', label: 'Nghệ An' },
      { id: 'hatinh', label: 'Hà Tĩnh' },
    ],
  },
  {
    id: 'south',
    label: 'Miền Nam',
    provinces: [
      { id: 'hcm', label: 'TP. Hồ Chí Minh' },
      { id: 'binhduong', label: 'Bình Dương' },
      { id: 'dongnai', label: 'Đồng Nai' },
      { id: 'cantho', label: 'Cần Thơ' },
      { id: 'vungtau', label: 'Vũng Tàu' },
      { id: 'angiang', label: 'An Giang' },
      { id: 'longan', label: 'Long An' },
      { id: 'tiengiang', label: 'Tiền Giang' },
      { id: 'dongthap', label: 'Đồng Tháp' },
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

export function jobMatchesRegion(location: string, regionId: JobRegionId): boolean {
  const region = JOB_REGIONS.find((r) => r.id === regionId)
  if (!region) return true
  const hay = normalizeViText(location)
  if (!hay) return false
  return region.match.some((m) => hay.includes(normalizeViText(m)))
}
