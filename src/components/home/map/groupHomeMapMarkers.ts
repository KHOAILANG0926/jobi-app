import type { HomeMapMarker } from './HomeMapTypes'

/** One physical pin per exact workplace point, retaining every job id. */
export function groupHomeMapMarkers(markers: HomeMapMarker[]): HomeMapMarker[][] {
  const groups = new Map<string, HomeMapMarker[]>()
  for (const marker of markers) {
    const key = `${marker.lat},${marker.lng}`
    const group = groups.get(key)
    if (group) group.push(marker)
    else groups.set(key, [marker])
  }
  return [...groups.values()]
}
