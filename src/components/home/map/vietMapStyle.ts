// VietMap 공식 style 주소. 일반지도는 Vector Street(tm), 위성은 공식 Hybrid(hm:
// 위성 raster `satellite-tile` + 도로·POI 벡터 라벨). 2026-10-05 Hybrid 지원 확인.
const VIETMAP_STYLE_BASE = 'https://maps.vietmap.vn/maps/styles'

export type VietMapStyleKind = 'street' | 'satellite'

const STYLE_PATH: Readonly<Record<VietMapStyleKind, string>> = {
  street: 'tm',
  satellite: 'hm',
}

export function createVietMapStyleUrl(apiKey: string, kind: VietMapStyleKind = 'street'): string {
  const key = apiKey.trim()
  if (!key) throw new Error('VIETMAP Tilemap key is required')
  return `${VIETMAP_STYLE_BASE}/${STYLE_PATH[kind]}/style.json?${new URLSearchParams({ apikey: key }).toString()}`
}
