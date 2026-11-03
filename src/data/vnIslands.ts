/**
 * 지역 지도에 그리는 섬(Lee 2026-11-03 "섬까지 다 표현, 중국 거라고 우기는 것까지 다 베트남
 * 영토로"). 성 경계 자료(originalProvinceBoundaries.ts)가 거친 축척이라 섬 대부분이 빠져
 * 있어 따로 둔다. 소속 성은 공식 행정구역 자료의 특구(Đặc khu, vnWards.ts) 그대로다 —
 * Hoàng Sa는 Đà Nẵng, Trường Sa는 Khánh Hòa.
 * 위치·크기는 지도 표시용 근사값이다(정확한 해안선 아님).
 */
export interface VnIsland {
  name: string
  province: string
  lat: number
  lng: number
  /** 대략 반지름(km). */
  km: number
  /** 같은 군도(群島) 묶음 이름 — 지도에 묶음 이름을 한 번 표시. */
  group?: 'hoang-sa' | 'truong-sa'
}

/** Phú Quốc은 큰 섬이라 대략 윤곽(경도, 위도). */
export const PHU_QUOC_OUTLINE: [number, number][] = [
  [104.03, 10.45], [103.92, 10.38], [103.84, 10.27], [103.86, 10.14], [103.95, 10.02],
  [104.0, 10.01], [104.06, 10.12], [104.08, 10.27], [104.06, 10.4],
]

export const VN_ISLANDS: VnIsland[] = [
  { name: 'Phú Quốc', province: 'Tỉnh An Giang', lat: 10.22, lng: 103.96, km: 0 },
  { name: 'Thổ Châu', province: 'Tỉnh An Giang', lat: 9.3, lng: 103.48, km: 3 },
  { name: 'Kiên Hải', province: 'Tỉnh An Giang', lat: 9.68, lng: 104.35, km: 4 },
  { name: 'Côn Đảo', province: 'Thành phố Hồ Chí Minh', lat: 8.68, lng: 106.6, km: 6 },
  { name: 'Phú Quý', province: 'Tỉnh Lâm Đồng', lat: 10.52, lng: 108.94, km: 4 },
  { name: 'Lý Sơn', province: 'Tỉnh Quảng Ngãi', lat: 15.38, lng: 109.12, km: 3 },
  { name: 'Cồn Cỏ', province: 'Tỉnh Quảng Trị', lat: 17.16, lng: 107.34, km: 1.5 },
  { name: 'Bạch Long Vĩ', province: 'Thành phố Hải Phòng', lat: 20.13, lng: 107.73, km: 2 },
  { name: 'Cát Hải', province: 'Thành phố Hải Phòng', lat: 20.79, lng: 107.04, km: 7 },
  { name: 'Vân Đồn', province: 'Thành phố Quảng Ninh', lat: 21.07, lng: 107.45, km: 7 },
  { name: 'Cô Tô', province: 'Thành phố Quảng Ninh', lat: 20.98, lng: 107.77, km: 3 },
  // Quần đảo Hoàng Sa — Đặc khu Hoàng Sa, Thành phố Đà Nẵng
  { name: 'Phú Lâm', province: 'Thành phố Đà Nẵng', lat: 16.83, lng: 112.34, km: 1.5, group: 'hoang-sa' },
  { name: 'Cây', province: 'Thành phố Đà Nẵng', lat: 16.98, lng: 112.26, km: 1, group: 'hoang-sa' },
  { name: 'Linh Côn', province: 'Thành phố Đà Nẵng', lat: 16.67, lng: 112.73, km: 1, group: 'hoang-sa' },
  { name: 'Hoàng Sa', province: 'Thành phố Đà Nẵng', lat: 16.53, lng: 111.61, km: 1, group: 'hoang-sa' },
  { name: 'Quang Hòa', province: 'Thành phố Đà Nẵng', lat: 16.45, lng: 111.71, km: 1, group: 'hoang-sa' },
  { name: 'Duy Mộng', province: 'Thành phố Đà Nẵng', lat: 16.55, lng: 111.77, km: 1, group: 'hoang-sa' },
  { name: 'Tri Tôn', province: 'Thành phố Đà Nẵng', lat: 15.78, lng: 111.2, km: 1, group: 'hoang-sa' },
  // Quần đảo Trường Sa — Đặc khu Trường Sa, Tỉnh Khánh Hòa
  { name: 'Trường Sa', province: 'Tỉnh Khánh Hòa', lat: 8.64, lng: 111.92, km: 1.5, group: 'truong-sa' },
  { name: 'Song Tử Tây', province: 'Tỉnh Khánh Hòa', lat: 11.43, lng: 114.33, km: 1, group: 'truong-sa' },
  { name: 'Song Tử Đông', province: 'Tỉnh Khánh Hòa', lat: 11.45, lng: 114.36, km: 1, group: 'truong-sa' },
  { name: 'Thị Tứ', province: 'Tỉnh Khánh Hòa', lat: 11.05, lng: 114.28, km: 1, group: 'truong-sa' },
  { name: 'Loại Ta', province: 'Tỉnh Khánh Hòa', lat: 10.68, lng: 114.42, km: 1, group: 'truong-sa' },
  { name: 'Ba Bình', province: 'Tỉnh Khánh Hòa', lat: 10.38, lng: 114.36, km: 1, group: 'truong-sa' },
  { name: 'Sơn Ca', province: 'Tỉnh Khánh Hòa', lat: 10.37, lng: 114.48, km: 1, group: 'truong-sa' },
  { name: 'Nam Yết', province: 'Tỉnh Khánh Hòa', lat: 10.18, lng: 114.36, km: 1, group: 'truong-sa' },
  { name: 'Sinh Tồn', province: 'Tỉnh Khánh Hòa', lat: 9.88, lng: 114.33, km: 1, group: 'truong-sa' },
  { name: 'An Bang', province: 'Tỉnh Khánh Hòa', lat: 7.89, lng: 113.92, km: 1, group: 'truong-sa' },
]

export const ISLAND_GROUP_LABELS: Record<NonNullable<VnIsland['group']>, { label: string; lat: number; lng: number }> = {
  'hoang-sa': { label: 'Quần đảo Hoàng Sa (Đà Nẵng)', lat: 17.35, lng: 112.0 },
  'truong-sa': { label: 'Quần đảo Trường Sa (Khánh Hòa)', lat: 12.0, lng: 113.9 },
}
