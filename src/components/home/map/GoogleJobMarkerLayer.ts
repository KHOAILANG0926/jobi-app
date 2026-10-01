import type { HomeMapMarker } from './HomeMapTypes'

export interface GoogleJobMarkerLayer {
  setMarkers(markers: HomeMapMarker[], selectedId: string | null, onSelect: (id: string) => void): void
  destroy(): void
}

interface GoogleJobMarkerLayerOptions {
  document?: Document
}

interface MarkerRecord {
  marker: HomeMapMarker
  element: HTMLDivElement
  pin: HTMLSpanElement
  onSelect: (id: string) => void
}

export function createGoogleJobMarkerLayer(
  OverlayViewCtor: typeof google.maps.OverlayView,
  map: google.maps.Map,
  options: GoogleJobMarkerLayerOptions = {},
): GoogleJobMarkerLayer {
  const ownerDocument = options.document ?? document

  class JobMarkerOverlay extends OverlayViewCtor {
    private readonly records = new Map<string, MarkerRecord>()
    private pane: Element | null = null

    onAdd(): void {
      this.pane = this.getPanes()?.overlayMouseTarget ?? null
      for (const record of this.records.values()) this.pane?.appendChild(record.element)
    }

    draw(): void {
      const projection = this.getProjection()
      for (const record of this.records.values()) {
        const pixel = projection.fromLatLngToDivPixel(record.marker)
        if (!pixel) continue
        record.element.style.left = `${pixel.x}px`
        record.element.style.top = `${pixel.y}px`
      }
    }

    onRemove(): void {
      for (const record of this.records.values()) record.element.remove()
      this.pane = null
    }

    update(markers: HomeMapMarker[], selectedId: string | null, onSelect: (id: string) => void): void {
      const nextIds = new Set(markers.map((marker) => marker.id))
      for (const [id, record] of this.records) {
        if (!nextIds.has(id)) {
          record.element.remove()
          this.records.delete(id)
        }
      }

      for (const marker of markers) {
        let record = this.records.get(marker.id)
        if (!record) {
          const element = ownerDocument.createElement('div')
          element.className = 'hme-map__job-marker hme-map__job-marker--google'
          element.style.position = 'absolute'
          element.style.transform = 'translate(-50%, -100%)'
          element.setAttribute('role', 'button')
          element.tabIndex = 0
          const pin = ownerDocument.createElement('span')
          element.appendChild(pin)
          record = { marker, element, pin, onSelect }
          element.addEventListener('click', () => record?.onSelect(record.marker.id))
          element.addEventListener('keydown', (event) => {
            if (event.key === 'Enter' || event.key === ' ') {
              event.preventDefault()
              record?.onSelect(record.marker.id)
            }
          })
          this.records.set(marker.id, record)
          this.pane?.appendChild(element)
        }

        record.marker = marker
        record.onSelect = onSelect
        record.element.title = marker.label
        record.element.setAttribute('aria-label', marker.label)
        const selected = marker.id === selectedId
        record.element.style.width = selected ? '30px' : '24px'
        record.element.style.height = selected ? '30px' : '24px'
        record.element.style.zIndex = selected ? '2' : '1'
        record.pin.className = `hme-pin${selected ? ' is-selected' : ''}`
      }
      this.draw()
    }

    clear(): void {
      for (const record of this.records.values()) record.element.remove()
      this.records.clear()
    }
  }

  const overlay = new JobMarkerOverlay()
  overlay.setMap(map)

  return {
    setMarkers: (markers, selectedId, onSelect) => overlay.update(markers, selectedId, onSelect),
    destroy: () => {
      overlay.clear()
      overlay.setMap(null)
    },
  }
}
