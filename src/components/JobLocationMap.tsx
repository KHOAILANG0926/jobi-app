import L from 'leaflet'
import 'leaflet/dist/leaflet.css'
import markerIcon2x from 'leaflet/dist/images/marker-icon-2x.png'
import markerIcon from 'leaflet/dist/images/marker-icon.png'
import markerShadow from 'leaflet/dist/images/marker-shadow.png'
import { useEffect, useRef, useState } from 'react'

// Vite/Webpack don't resolve Leaflet's default marker image paths, which leaves the
// default marker as a broken image icon — point it at the bundled asset URLs instead.
delete (L.Icon.Default.prototype as unknown as { _getIconUrl?: unknown })._getIconUrl
L.Icon.Default.mergeOptions({
  iconRetinaUrl: markerIcon2x,
  iconUrl: markerIcon,
  shadowUrl: markerShadow,
})

interface JobLocationMapMarker {
  lat: number
  lng: number
  /** Popup label for this marker; falls back to `title` when omitted. */
  label?: string
}

interface JobLocationMapProps {
  lat: number
  lng: number
  title: string
  /** Map zoom level — pass a lower value for a region- or country-level view. */
  zoom?: number
  /** Extra markers to draw in addition to lat/lng (e.g. multiple real work
   *  locations for one job posting). Optional and additive — omitting it keeps
   *  the original single-marker behavior exactly as before. */
  extraMarkers?: JobLocationMapMarker[]
}

export default function JobLocationMap({ lat, lng, title, zoom = 15, extraMarkers }: JobLocationMapProps) {
  const mapRef = useRef<HTMLDivElement>(null)
  const mapInst = useRef<L.Map | null>(null)
  const [tileError, setTileError] = useState(false)

  useEffect(() => {
    if (!mapRef.current) return
    setTileError(false)
    const map = L.map(mapRef.current, { scrollWheelZoom: false }).setView([lat, lng], zoom)
    const geoapifyKey = import.meta.env.VITE_GEOAPIFY_API_KEY as string | undefined
    const tiles = L.tileLayer(
      `https://maps.geoapify.com/v1/tile/osm-carto/{z}/{x}/{y}.png?apiKey=${geoapifyKey ?? ''}`,
      {
        attribution:
          '© <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors | © <a href="https://www.geoapify.com/">Geoapify</a>',
      },
    ).addTo(map)
    // A single failed tile out of the many needed to cover the viewport is normal (one
    // blank patch, rest of the map still useful) — it used to blank the whole map
    // instead. Only fall back to the error message once the whole batch has settled
    // (Leaflet's `load` event fires after every tile has either loaded or errored) and
    // not one tile came through, meaning the map is genuinely unusable.
    let loadedCount = 0
    tiles.on('tileload', () => { loadedCount += 1 })
    tiles.on('load', () => {
      if (loadedCount === 0) setTileError(true)
    })

    const markers: JobLocationMapMarker[] =
      extraMarkers && extraMarkers.length > 0 ? extraMarkers : [{ lat, lng }]
    const bounds: [number, number][] = []
    markers.forEach((m) => {
      L.marker([m.lat, m.lng]).addTo(map).bindPopup(m.label || title)
      bounds.push([m.lat, m.lng])
    })
    if (bounds.length > 1) {
      map.fitBounds(bounds, { padding: [24, 24] })
    }

    mapInst.current = map
    // The container can be freshly inserted (e.g. right after other page content above
    // it finishes laying out), so Leaflet's size calculation at construction time isn't
    // always trustworthy — nudge it once layout has settled.
    const raf = requestAnimationFrame(() => map.invalidateSize())
    return () => {
      cancelAnimationFrame(raf)
      map.remove()
      mapInst.current = null
    }
  }, [lat, lng, title, zoom, extraMarkers])

  if (tileError) {
    return <p className="job-location-map__error">Không thể tải bản đồ.</p>
  }

  return <div ref={mapRef} className="job-location-map" />
}
