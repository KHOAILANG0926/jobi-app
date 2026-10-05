// 생활지도 스타일 변환 (2026-10-05). VietMap 공식 style JSON을 받아 "도로 중심"을
// "건물·근무지·생활시설 중심"으로 바꾼다. 공식 source/filter는 그대로 두고 zoom 범위,
// paint, layer 순서만 조정한다 — 데이터를 만들거나 지우지 않는다.
//
// VietMap 벡터 데이터 조사 결과(2026-10-05, Bắc Ninh·Hoàn Kiếm):
// - building: 폴리곤만 있고 class/height 속성 없음 → 높이 extrusion 불가, 대비·윤곽선으로 강조.
// - 원본 building layer는 z17부터라 동네 단위(z14~16)에서 건물이 안 보였다.
// - poi: name/class만 있음. company·industrial·생활시설 대부분이 원본에서 z18부터 표시.
// - landuse에 industrial class 없음 → 공단 면 색칠은 하지 않는다.

export type LifeMapMode = 'street' | 'satellite'

export interface StyleLayerLike {
  id: string
  type: string
  source?: string
  'source-layer'?: string
  minzoom?: number
  maxzoom?: number
  paint?: Record<string, unknown>
  layout?: Record<string, unknown>
  [key: string]: unknown
}

export interface StyleLike {
  sources: Record<string, unknown>
  layers: StyleLayerLike[]
  [key: string]: unknown
}

/** 우리 앱이 추가하는 source/layer id 접두어. 스타일 교체(일반↔위성) 때 그대로 옮긴다. */
export const APP_LAYER_PREFIX = 'home-'

/** 위성 모드에서 건물 클릭 판정용 투명 layer. */
export const SATELLITE_BUILDING_HIT_LAYER = `${APP_LAYER_PREFIX}sat-building-hit`
/** 클릭 시 건물로 판정하는 layer들. */
export const BUILDING_CLICK_LAYERS = ['building', SATELLITE_BUILDING_HIT_LAYER] as const

/** 근무지 POI — 가장 먼저(낮은 zoom) 보이고, 라벨 충돌 시 가장 우선. */
const WORKPLACE_POI_LAYERS: Readonly<Record<string, number>> = {
  poiz18_company: 13,
  poiz16_industrial: 13,
  poiz18_building: 15,
}

/** 생활시설 POI — 동네 단위(z15)부터. 이미 더 이른 zoom이면 그대로 둔다. */
const LIFE_POI_LAYERS: Readonly<Record<string, number>> = {
  poiz18_restaurant: 15,
  poiz18_fastfood: 15,
  poiz18_vietnamfood: 15,
  poiz18_cafe: 15,
  poiz18_pharmacy: 15,
  poiz18_clinic: 15,
  poiz12_hospital: 12,
  poiz14_bus: 14,
  poiz16_hotel: 15,
  poiz15_resort: 15,
  poiz16_supermarket: 15,
  poiz18_atm: 15,
  poiz13_bank: 13,
  poiz18_store: 16,
}

const WORKPLACE_TEXT_COLOR = '#1e293b'
const LIFE_LABEL_LAYOUT = {
  'text-variable-anchor': ['top', 'bottom', 'left', 'right'],
  'text-radial-offset': 0.6,
  'text-optional': true,
  'text-padding': 2,
} as const

const ROAD_DOWNPLAY_WIDTH = 0.8
const ROAD_DOWNPLAY_IDS = /^(road|bridge|tunnel)_(minor|tertiary|secondary|path)(?!.*casing)/

/** 이 layer의 생활지도 표시 시작 zoom. 대상이 아니면 null. 원래보다 늦추지는 않는다. */
export function lifePoiMinZoom(layer: Pick<StyleLayerLike, 'id' | 'type' | 'source-layer' | 'minzoom'>): number | null {
  if (layer.type !== 'symbol' || layer['source-layer'] !== 'poi') return null
  const target = WORKPLACE_POI_LAYERS[layer.id] ?? LIFE_POI_LAYERS[layer.id]
  return target === undefined ? null : Math.min(layer.minzoom ?? 0, target)
}

export function isWorkplacePoiLayer(id: string): boolean {
  return id in WORKPLACE_POI_LAYERS
}

function scaleStops(value: unknown, factor: number): unknown {
  if (value && typeof value === 'object' && Array.isArray((value as { stops?: unknown }).stops)) {
    const v = value as { stops: Array<[number, number]>; base?: number }
    return { ...v, stops: v.stops.map(([z, w]) => [z, Math.round(w * factor * 100) / 100]) }
  }
  return typeof value === 'number' ? Math.round(value * factor * 100) / 100 : value
}

function buildingLayers(base: StyleLayerLike): StyleLayerLike[] {
  return [
    {
      ...base,
      minzoom: 14,
      paint: {
        'fill-color': { stops: [[14, '#d9d0c1'], [16, '#d2c6b3'], [18, '#cbbda8']] },
        'fill-opacity': { stops: [[14, 0.75], [15.5, 1]] },
        'fill-antialias': true,
      },
    },
    {
      id: `${APP_LAYER_PREFIX}life-building-outline`,
      type: 'line',
      source: base.source,
      'source-layer': 'building',
      minzoom: 14,
      paint: {
        'line-color': '#8f7c66',
        'line-width': { stops: [[14, 0.4], [16, 0.9], [18, 1.4]] },
        'line-opacity': { stops: [[14, 0.5], [16, 0.9]] },
      },
    },
  ]
}

function tunePoiLayer(layer: StyleLayerLike): StyleLayerLike {
  const minzoom = lifePoiMinZoom(layer)
  if (minzoom === null) return layer
  const workplace = isWorkplacePoiLayer(layer.id)
  return {
    ...layer,
    minzoom,
    layout: { ...layer.layout, ...LIFE_LABEL_LAYOUT, ...(workplace ? { 'text-size': { stops: [[13, 11], [16, 13], [19, 16]] } } : {}) },
    paint: workplace ? { ...layer.paint, 'text-color': WORKPLACE_TEXT_COLOR, 'text-halo-width': 1.6 } : layer.paint,
  }
}

function tuneRoadLayer(layer: StyleLayerLike): StyleLayerLike {
  if (layer.type !== 'line' || layer['source-layer'] !== 'road') return layer
  const paint = { ...layer.paint }
  if (ROAD_DOWNPLAY_IDS.test(layer.id)) paint['line-width'] = scaleStops(paint['line-width'], ROAD_DOWNPLAY_WIDTH)
  if (/casing/.test(layer.id) && paint['line-color'] === '#ACACA9') paint['line-color'] = '#cfccc4'
  return { ...layer, paint }
}

/**
 * 공식 style을 생활지도용으로 변환한다. previous가 있으면 거기서 앱 layer/source를 옮겨
 * 일반↔위성 전환 후에도 반경 원·주변시설 표시가 유지되게 한다.
 */
export function applyLifeMapStyle(next: StyleLike, mode: LifeMapMode, previous?: StyleLike | null): StyleLike {
  let layers: StyleLayerLike[] = []
  for (const layer of next.layers) {
    if (mode === 'street' && layer.id === 'building' && layer.type === 'fill') {
      layers.push(...buildingLayers(layer))
      continue
    }
    layers.push(mode === 'street' ? tuneRoadLayer(tunePoiLayer(layer)) : tunePoiLayer(layer))
  }

  // 위성: 건물은 사진으로 보이지만 클릭 판정을 위해 투명 건물 layer를 둔다(공식 데이터 그대로).
  if (mode === 'satellite' && !layers.some((l) => l['source-layer'] === 'building')) {
    const vector = Object.entries(next.sources).find(([, s]) => (s as { type?: string }).type === 'vector')?.[0]
    if (vector) {
      const at = layers.findIndex((l) => l.type === 'symbol')
      const hit: StyleLayerLike = { id: SATELLITE_BUILDING_HIT_LAYER, type: 'fill', source: vector, 'source-layer': 'building', minzoom: 15, paint: { 'fill-color': '#000000', 'fill-opacity': 0 } }
      layers.splice(at === -1 ? layers.length : at, 0, hit)
    }
  }

  // 심볼은 위쪽 layer가 먼저 자리를 잡는다. 근무지 → 생활시설 순으로 도로 라벨 위에 올린다.
  const isLife = (l: StyleLayerLike) => lifePoiMinZoom(l) !== null
  const lifeLayers = layers.filter((l) => isLife(l) && !isWorkplacePoiLayer(l.id))
  const workLayers = layers.filter((l) => isLife(l) && isWorkplacePoiLayer(l.id))
  const rest = layers.filter((l) => !isLife(l))
  const placeIndex = rest.findIndex((l) => l.type === 'symbol' && (l['source-layer'] === 'place' || l['source-layer'] === 'admin_point') && l.id.startsWith('place_'))
  const insertAt = placeIndex === -1 ? rest.length : placeIndex
  layers = [...rest.slice(0, insertAt), ...lifeLayers, ...workLayers, ...rest.slice(insertAt)]

  const sources: Record<string, unknown> = { ...next.sources }
  if (previous) {
    for (const [id, source] of Object.entries(previous.sources)) if (id.startsWith(APP_LAYER_PREFIX)) sources[id] = source
    const carried = previous.layers.filter((l) => l.id.startsWith(APP_LAYER_PREFIX) && l.source?.startsWith(APP_LAYER_PREFIX))
    const below = carried.filter((l) => l.type === 'fill' || l.type === 'line' || l.type === 'circle')
    const above = carried.filter((l) => !(l.type === 'fill' || l.type === 'line' || l.type === 'circle'))
    const firstSymbol = layers.findIndex((l) => l.type === 'symbol')
    const at = firstSymbol === -1 ? layers.length : firstSymbol
    layers = [...layers.slice(0, at), ...below, ...layers.slice(at), ...above]
  }
  return { ...next, sources, layers }
}
