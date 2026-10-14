// 공단(KCN/KCX) 중심 좌표 — 출처 있는 것만 (2026-10-07).
// 모든 좌표는 OpenStreetMap의 landuse=industrial 면(way)의 중심(Overpass API `out center`, 2026-10-07 조회,
// 같은 id를 별도 호출로 한 번 더 대조)이다. 출처(`source.ref`)가 없는 공단은 이 표에 넣지 않는다 — 좌표를 추정하거나
// 행정구역 중심으로 대신하지 않는다. 표에 없으면 화면은 지도 없이 글자 안내만 보여준다.
// 라이선스: ODbL — 화면에 "© OpenStreetMap contributors"를 함께 표시한다.
// 이 좌표(lat/lng = OSM 면의 bbox 중심)는 공단 "일대"를 보여주는 용도일 뿐 — 길찾기 목적지로 쓰지 않는다
// (2026-10-07: 도형 중심이 빈 부지·들판이라 길찾기가 엉뚱한 곳으로 안내됨). 길찾기는 `destination`(공단 정문 또는
// KCN 관리사무소, 실제 도로에 접한 지점)이 출처와 함께 있는 공단에만 열고, 없으면 길찾기 버튼을 숨긴다.
// 재검증: https://www.openstreetmap.org/<source.ref> (예: https://www.openstreetmap.org/way/642274405)

export interface IndustrialPark {
  id: string
  name: string
  /** 성조 제거·소문자·공백 정규화한 이름. 뒤에 숫자/로마숫자가 붙으면(예: "quế võ 2") 다른 공단이라 매칭하지 않는다. */
  aliases: string[]
  /** 같은 이름이 여러 지역에 있을 때 주소 텍스트(정규화 후)가 이 패턴을 포함해야 매칭 */
  requires?: RegExp
  lat: number
  lng: number
  source: { provider: 'OpenStreetMap'; ref: string; osmName: string }
  /** 길찾기 목적지(영역 중심과 별개). 우선순위 ① OSM 공단 정문(barrier=gate·entrance, 공단 way에 붙은 node) ② OSM/VietMap의
   *  KCN 관리사무소(Ban quản lý) POI. 출처 id를 반드시 적고 실제 도로에 접한 지점인지 위성으로 확인한 뒤에만 넣는다. 없으면 길찾기 없음. */
  destination?: IndustrialParkDestination
  note?: string
}

export interface IndustrialParkDestination {
  kind: 'gate' | 'office'
  lat: number
  lng: number
  /** 출처 — 예: { provider: 'OpenStreetMap', ref: 'node/123', name: 'Cổng chính KCN …' } */
  source: { provider: 'OpenStreetMap' | 'VietMap'; ref: string; name?: string }
  /** 위성(VietMap Hybrid)으로 도로에 접한 지점임을 확인한 날짜(YYYY-MM-DD) */
  satelliteChecked: string
}

export const INDUSTRIAL_PARKS: readonly IndustrialPark[] = [
  {
    id: 'vsip-bac-ninh', name: 'KCN VSIP Bắc Ninh',
    // "KCN VSIP"·"KCN VISIP"(오타)만 쓴 공고도 주소에 Bắc Ninh/Từ Sơn이 있을 때만 이 공단(다른 VSIP는 vsip 1·vsip 2로 따로 있음)
    aliases: ['vsip bac ninh', 'vsip', 'visip'],
    requires: /bac ninh|tu son|phu chan|tien du/,
    lat: 21.0800324, lng: 105.9835287,
    source: { provider: 'OpenStreetMap', ref: 'way/642274405', osmName: 'Khu công nghiệp VSIP Bắc Ninh' },
  },
  {
    id: 'que-vo-1', name: 'KCN Quế Võ (1)',
    aliases: ['que vo 1', 'que vo'],
    lat: 21.1542444, lng: 106.1148912,
    source: { provider: 'OpenStreetMap', ref: 'way/597872887', osmName: 'Khu công nghiệp Quế Võ' },
  },
  {
    id: 'yen-phong-mo-rong', name: 'KCN Yên Phong mở rộng',
    aliases: ['yen phong mo rong', 'yen phong khu mo rong'],
    lat: 21.2291794, lng: 106.0047924,
    source: { provider: 'OpenStreetMap', ref: 'way/805410975', osmName: 'Khu công nghiệp Yên Phong mở rộng' },
  },
  {
    id: 'que-vo-3', name: 'KCN Quế Võ III',
    aliases: ['que vo 3', 'que vo iii'],
    lat: 21.14788, lng: 106.181135,
    source: { provider: 'OpenStreetMap', ref: 'way/1184113104', osmName: 'Khu công nghiệp Quế Võ III' },
  },
  {
    id: 'nam-son-hap-linh', name: 'KCN Nam Sơn – Hạp Lĩnh',
    aliases: ['nam son hap linh'],
    lat: 21.1302, lng: 106.094475,
    source: { provider: 'OpenStreetMap', ref: 'way/1265422032', osmName: 'Khu công nghiệp Nam Sơn - Hạp Lĩnh' },
  },
  {
    id: 'thuan-thanh-3', name: 'KCN Thuận Thành 3',
    aliases: ['thuan thanh 3', 'thuan thanh iii'],
    lat: 21.042315, lng: 106.05691,
    source: { provider: 'OpenStreetMap', ref: 'way/1119170923', osmName: 'Khu công nghiệp Thuận Thành 3' },
    note: 'OSM에 같은 이름의 면이 하나 더 있다(way/1467190501 "Thuận Thành III") — 둘 중 way/1119170923만 쓴다. "KCN Thuận Thành"만 쓴 공고는 2·3을 구분할 수 없어 매칭하지 않는다.',
  },
  {
    id: 'dai-dong-hoan-son', name: 'KCN Đại Đồng – Hoàn Sơn',
    aliases: ['dai dong', 'dai dong hoan son'],
    requires: /bac ninh|tu son|tien du/,
    lat: 21.10059, lng: 105.994585,
    source: { provider: 'OpenStreetMap', ref: 'way/642268651', osmName: 'Khu công nghiệp Đại Đồng - Hoàn Sơn' },
  },
  {
    id: 'thang-long-2-hung-yen', name: 'KCN Thăng Long II (Hưng Yên)',
    aliases: ['thang long 2', 'thang long ii'],
    lat: 20.913516, lng: 106.0752586,
    source: { provider: 'OpenStreetMap', ref: 'way/633668122', osmName: 'Khu công nghiệp Thăng Long II' },
  },
  {
    id: 'hiep-phuoc', name: 'KCN Hiệp Phước',
    aliases: ['hiep phuoc'],
    lat: 10.6295079, lng: 106.7556181,
    source: { provider: 'OpenStreetMap', ref: 'way/1357939694', osmName: 'Khu công nghiệp Hiệp Phước' },
  },
  {
    id: 'long-hau', name: 'KCN Long Hậu',
    aliases: ['long hau 1', 'long hau'],
    lat: 10.638725, lng: 106.7198576,
    source: { provider: 'OpenStreetMap', ref: 'way/368243702', osmName: 'Khu công nghiệp Long Hậu 1' },
    note: 'OSM tách Long Hậu 1·2·3 thành 3 khu liền kề (cách nhau ~1,5 km); dùng khu 1 làm đại diện.',
  },
  {
    id: 'giao-long', name: 'KCN Giao Long',
    aliases: ['giao long'],
    lat: 10.2986525, lng: 106.400919,
    source: { provider: 'OpenStreetMap', ref: 'way/1041311776', osmName: 'Khu công nghiệp Giao Long' },
  },
  {
    id: 'dinh-vu', name: 'KCN Đình Vũ',
    aliases: ['dinh vu'],
    lat: 20.827569, lng: 106.7785798,
    source: { provider: 'OpenStreetMap', ref: 'way/627990023', osmName: 'Khu Công Nghiệp Đình Vũ' },
  },
  {
    id: 'hoa-phu-dak-lak', name: 'KCN Hòa Phú (Đắk Lắk)',
    aliases: ['hoa phu'],
    requires: /dak ?lak|buon ma thuot/,
    lat: 12.5991861, lng: 107.9409539,
    source: { provider: 'OpenStreetMap', ref: 'way/182822939', osmName: 'Khu công nghiệp Hòa Phú' },
  },
  {
    id: 'phu-tan-binh-duong', name: 'KCN Phú Tân (Bình Dương)',
    aliases: ['phu tan'],
    requires: /thu dau mot|binh duong/,
    lat: 11.0979903, lng: 106.6791094,
    source: { provider: 'OpenStreetMap', ref: 'way/1463022980', osmName: 'Khu công nghiệp Phú Tân' },
  },
  {
    id: 'quang-minh', name: 'KCN Quang Minh',
    aliases: ['quang minh'],
    requires: /ha noi|dong anh|me linh/,
    lat: 21.1936243, lng: 105.7626417,
    source: { provider: 'OpenStreetMap', ref: 'way/597870255', osmName: 'Khu công nghiệp Quang Minh' },
  },
  {
    id: 'tan-truong-hai-duong', name: 'KCN Tân Trường (Hải Dương)',
    aliases: ['tan truong'],
    requires: /hai duong|cam giang/,
    lat: 20.9277272, lng: 106.2278551,
    source: { provider: 'OpenStreetMap', ref: 'way/597911424', osmName: 'Khu công nghiệp Tân Trường' },
  },
  {
    id: 'tan-phu-trung', name: 'KCN Tân Phú Trung',
    aliases: ['tan phu trung'],
    lat: 10.923588, lng: 106.5393492,
    source: { provider: 'OpenStreetMap', ref: 'way/1548525579', osmName: 'Khu công nghiệp Tân Phú Trung' },
  },
  {
    id: 'xuyen-a', name: 'KCN Xuyên Á',
    aliases: ['xuyen a'],
    lat: 10.8857107, lng: 106.5227768,
    source: { provider: 'OpenStreetMap', ref: 'way/366287226', osmName: 'Khu công nghiệp Xuyên Á' },
  },
  {
    id: 'yen-my-hung-yen', name: 'KCN Yên Mỹ (Hưng Yên)',
    aliases: ['yen my'],
    requires: /hung yen|yen my/,
    lat: 20.8943968, lng: 106.0643173,
    source: { provider: 'OpenStreetMap', ref: 'way/1308939951', osmName: 'Khu công nghiệp Yên Mỹ' },
  },
  {
    id: 'linh-trung-3', name: 'KCX Linh Trung 3',
    aliases: ['linh trung 3'],
    lat: 11.0077287, lng: 106.3946086,
    source: { provider: 'OpenStreetMap', ref: 'way/1157345896', osmName: 'Khu chế xuất Linh Trung 3' },
  },
  {
    id: 'amata', name: 'KCN Amata (Biên Hòa)',
    aliases: ['amata'],
    lat: 10.9452202, lng: 106.8941093,
    source: { provider: 'OpenStreetMap', ref: 'way/583464295', osmName: 'Khu công nghiệp Amata' },
  },
  {
    id: 'long-duc-tra-vinh', name: 'KCN Long Đức (Trà Vinh)',
    aliases: ['long duc'],
    requires: /tra vinh/,
    lat: 9.9733651, lng: 106.345636,
    source: { provider: 'OpenStreetMap', ref: 'way/288582904', osmName: 'Khu công nghiệp Long Đức' },
  },
  {
    id: 'tan-tao', name: 'KCN Tân Tạo',
    aliases: ['tan tao'],
    lat: 10.7374823, lng: 106.5916836,
    source: { provider: 'OpenStreetMap', ref: 'way/493155221', osmName: 'Khu công nghiệp Tân Tạo' },
  },
  {
    id: 'long-thanh', name: 'KCN Long Thành',
    aliases: ['long thanh'],
    requires: /dong nai|long thanh/,
    lat: 10.8137682, lng: 106.9212118,
    source: { provider: 'OpenStreetMap', ref: 'way/718462141', osmName: 'Khu công nghiệp Long Thành' },
  },
  {
    id: 'vinh-loc', name: 'KCN Vĩnh Lộc',
    aliases: ['vinh loc'],
    lat: 10.824014, lng: 106.5907861,
    source: { provider: 'OpenStreetMap', ref: 'way/330871753', osmName: 'Khu công nghiệp Vĩnh Lộc' },
  },
  {
    id: 'dong-van-1-mo-rong', name: 'KCN Đồng Văn I mở rộng',
    aliases: ['dong van i mo rong', 'dong van 1 mo rong'],
    lat: 20.6727068, lng: 105.941884,
    source: { provider: 'OpenStreetMap', ref: 'way/1299444252', osmName: 'Khu công nghiệp Đồng Văn I mở rộng' },
  },
  {
    id: 'dai-an-mo-rong', name: 'KCN Đại An mở rộng',
    aliases: ['dai an mo rong'],
    lat: 20.9268604, lng: 106.2522721,
    source: { provider: 'OpenStreetMap', ref: 'way/1157356621', osmName: 'Khu công nghiệp Đại An mở rộng' },
  },
  {
    id: 'bien-hoa-2', name: 'KCN Biên Hòa II',
    aliases: ['bien hoa 2', 'bien hoa ii'],
    lat: 10.9220094, lng: 106.8666044,
    source: { provider: 'OpenStreetMap', ref: 'way/306132369', osmName: 'Khu công nghiệp Biên Hòa 2' },
  },
  {
    id: 'song-than', name: 'KCN Sóng Thần',
    aliases: ['song than'],
    lat: 10.8908599, lng: 106.7511944,
    source: { provider: 'OpenStreetMap', ref: 'way/306251856', osmName: 'Khu công nghiệp Sóng Thần' },
  },
  {
    id: 'nhut-chanh', name: 'KCN Nhựt Chánh',
    aliases: ['nhut chanh'],
    lat: 10.6212459, lng: 106.478464,
    source: { provider: 'OpenStreetMap', ref: 'way/1420332590', osmName: 'Khu công nghiệp Nhựt Chánh' },
  },
  {
    id: 'vsip-1', name: 'KCN VSIP 1 (Bình Dương)',
    aliases: ['vsip 1', 'vsip i'],
    lat: 10.9312292, lng: 106.7266241,
    source: { provider: 'OpenStreetMap', ref: 'way/291267149', osmName: 'Khu công nghiệp Việt Nam - Singapore (VSIP I)' },
  },
  {
    id: 'vsip-2', name: 'KCN VSIP 2 (Bình Dương)',
    aliases: ['vsip 2', 'vsip ii', 'vsip 2a'],
    lat: 11.0840413, lng: 106.6825665,
    source: { provider: 'OpenStreetMap', ref: 'way/366658228', osmName: 'VSIP II' },
  },
]
