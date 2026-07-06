import L from 'leaflet'
import 'leaflet/dist/leaflet.css'
import { useEffect, useRef } from 'react'

interface JobLocationMapProps {
  lat: number
  lng: number
  title: string
}

export default function JobLocationMap({ lat, lng, title }: JobLocationMapProps) {
  const mapRef = useRef<HTMLDivElement>(null)
  const mapInst = useRef<L.Map | null>(null)

  useEffect(() => {
    if (!mapRef.current) return
    const map = L.map(mapRef.current, { scrollWheelZoom: false }).setView([lat, lng], 15)
    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
      attribution: '© OpenStreetMap',
    }).addTo(map)
    L.marker([lat, lng]).addTo(map).bindPopup(title)
    mapInst.current = map
    return () => {
      map.remove()
      mapInst.current = null
    }
  }, [lat, lng, title])

  return <div ref={mapRef} className="job-location-map" />
}
