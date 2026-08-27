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

interface JobLocationMapProps {
  lat: number
  lng: number
  title: string
}

export default function JobLocationMap({ lat, lng, title }: JobLocationMapProps) {
  const mapRef = useRef<HTMLDivElement>(null)
  const mapInst = useRef<L.Map | null>(null)
  const [tileError, setTileError] = useState(false)

  useEffect(() => {
    if (!mapRef.current) return
    setTileError(false)
    const map = L.map(mapRef.current, { scrollWheelZoom: false }).setView([lat, lng], 15)
    const tiles = L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
      attribution: '© OpenStreetMap',
    }).addTo(map)
    tiles.on('tileerror', () => setTileError(true))
    L.marker([lat, lng]).addTo(map).bindPopup(title)
    mapInst.current = map
    return () => {
      map.remove()
      mapInst.current = null
    }
  }, [lat, lng, title])

  if (tileError) {
    return <p className="job-location-map__error">Không thể tải bản đồ.</p>
  }

  return <div ref={mapRef} className="job-location-map" />
}
