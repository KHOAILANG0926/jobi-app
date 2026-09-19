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
  /** false for any approximate/administrative-fallback point (unverified ward,
   *  region-text geocode, province/district center, recruitment-region center)
   *  — rendered as a translucent circle instead of the default precise-location
   *  pin, so an approximate position never looks like a confirmed exact one
   *  (2026-09-05 정책: "정확한 핀처럼 오해되지 않도록 다른 마커 스타일 또는
   *  범위 원 사용"). Omitted/true renders the normal pin. */
  precise?: boolean
  /** 2026-09-20 "Gần tôi" 지도 결과("카카오맵 스타일" — 검색하면 지도+핀
   *  자동 표시) 추가 — 핀 클릭 시 해당 공고 상세로 이동하는 링크. 있으면
   *  팝업을 DOM으로 직접 조립해(textContent만 사용, innerHTML 없음) 라벨을
   *  링크 텍스트로 안전하게 넣는다 — label/title이 공고 제목처럼 사용자
   *  입력값이라 문자열을 그대로 HTML에 꽂으면 XSS 위험이 있어 피한다. */
  href?: string
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

    // href가 있으면(예: "Gần tôi" 결과 지도의 공고 핀) 팝업을 DOM으로 직접
    // 조립한다 — label(공고 제목 등 사용자 입력일 수 있음)을 textContent로만
    // 넣어 HTML 문자열 삽입으로 인한 XSS를 피한다.
    const buildPopupContent = (label: string | undefined, href: string | undefined): string | HTMLElement => {
      const text = label || title
      if (!href) return text
      const link = document.createElement('a')
      link.href = href
      link.textContent = text
      return link
    }

    const markers: JobLocationMapMarker[] =
      extraMarkers && extraMarkers.length > 0 ? extraMarkers : [{ lat, lng }]
    const bounds: [number, number][] = []
    markers.forEach((m) => {
      const popupContent = buildPopupContent(m.label, m.href)
      if (m.precise === false) {
        // Approximate/fallback point — a translucent circle, not the default
        // precise-location pin, so it never reads as a confirmed exact marker.
        L.circleMarker([m.lat, m.lng], {
          radius: 12,
          color: '#f59e0b',
          weight: 2,
          fillColor: '#f59e0b',
          fillOpacity: 0.25,
        }).addTo(map).bindPopup(popupContent)
      } else {
        L.marker([m.lat, m.lng]).addTo(map).bindPopup(popupContent)
      }
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
