// Keep the official source, filters and collision detection. Known POI layers
// begin earlier and can place labels on a free side of their point.
const NEARBY_POI_MIN_ZOOM: Readonly<Record<string, number>> = {
  poiz18_company: 15,
  poiz16_industrial: 15,
  poiz18_building: 16,
  poiz18_store: 17,
  poiz18_cafe: 17,
  poiz18_restaurant: 17,
  poiz18_pharmacy: 17,
}

export const NEARBY_POI_LABEL_LAYOUT = {
  'text-variable-anchor': ['top', 'bottom', 'left', 'right'],
  'text-radial-offset': 0.5,
  'icon-optional': true,
} as const

export function nearbyPoiMinZoom(layer: { id: string; type: string; 'source-layer'?: string; minzoom?: number }): number | null {
  if (layer.type !== 'symbol' || layer['source-layer'] !== 'poi') return null
  const target = NEARBY_POI_MIN_ZOOM[layer.id]
  return target === undefined ? null : Math.min(layer.minzoom ?? 0, target)
}
