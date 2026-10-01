import { useEffect, useRef } from 'react'
import { createGoogleJobMarkerLayer, type GoogleJobMarkerLayer } from './GoogleJobMarkerLayer'
import { subscribeGoogleAuthFailure, type GoogleAuthFailureHost } from './googleAuthFailure'
import { loadGoogleMaps } from './googleMapsLoader'
import { calculateInitialZoom, radiusKmToMeters } from './homeMapGeometry'
import type { HomeMapProviderProps, MapPoint, MapViewportSize } from './HomeMapTypes'

interface OriginOverlay {
  setPosition: (position: MapPoint, isUser: boolean) => void
  destroy: () => void
}

function canvasSize(element: HTMLElement): MapViewportSize {
  const bounds = element.getBoundingClientRect()
  return { width: bounds.width, height: bounds.height }
}

function createOriginOverlay(
  OverlayViewCtor: typeof google.maps.OverlayView,
  map: google.maps.Map,
  initialPosition: MapPoint,
  initialIsUser: boolean,
): OriginOverlay {
  class PointOverlay extends OverlayViewCtor {
    private position = initialPosition
    private element: HTMLDivElement | null = null

    onAdd(): void {
      const element = document.createElement('div')
      element.className = 'hme-map__origin'
      element.style.position = 'absolute'
      element.style.transform = 'translate(-50%, -50%)'
      element.style.backgroundColor = initialIsUser ? '#2563eb' : '#64748b'
      this.element = element
      this.getPanes()?.overlayMouseTarget.appendChild(element)
    }

    draw(): void {
      const pixel = this.getProjection().fromLatLngToDivPixel(this.position)
      if (!pixel || !this.element) return
      this.element.style.left = `${pixel.x}px`
      this.element.style.top = `${pixel.y}px`
    }

    onRemove(): void {
      this.element?.remove()
      this.element = null
    }

    update(position: MapPoint, isUser: boolean): void {
      this.position = position
      if (this.element) this.element.style.backgroundColor = isUser ? '#2563eb' : '#64748b'
      this.draw()
    }
  }

  const overlay = new PointOverlay()
  overlay.setMap(map)
  return {
    setPosition: (position, isUser) => overlay.update(position, isUser),
    destroy: () => overlay.setMap(null),
  }
}

export default function GoogleMapCanvas(props: HomeMapProviderProps) {
  const boxRef = useRef<HTMLDivElement>(null)
  const mapRef = useRef<google.maps.Map | null>(null)
  const radiusCircleRef = useRef<google.maps.Circle | null>(null)
  const originOverlayRef = useRef<OriginOverlay | null>(null)
  const jobLayerRef = useRef<GoogleJobMarkerLayer | null>(null)
  const propsRef = useRef(props)
  const generationRef = useRef(0)
  const userInteractedRef = useRef(false)
  const lastRecenterRef = useRef({ origin: props.origin, recenterRequest: props.recenterRequest })
  propsRef.current = props

  useEffect(() => {
    const box = boxRef.current
    if (!box) return
    const generation = ++generationRef.current
    let active = true
    let failed = false
    let ready = false
    let resizeObserver: ResizeObserver | null = null
    const listeners: google.maps.MapsEventListener[] = []
    let lastReported = ''

    const isActive = () => active && generationRef.current === generation
    const fail = (reason: Parameters<HomeMapProviderProps['onFailure']>[0]) => {
      if (!isActive() || failed) return
      failed = true
      propsRef.current.onFailure(reason)
    }
    const unsubscribeAuthFailure = subscribeGoogleAuthFailure(
      window as unknown as GoogleAuthFailureHost,
      () => fail('auth-failure'),
    )
    const markUserInteraction = () => { userInteractedRef.current = true }
    const markZoomControl = (event: MouseEvent) => {
      if (!(event.target instanceof Element)) return
      if (event.target.closest('[aria-label*="Zoom"], [title*="Zoom"], [aria-label*="phóng"], [title*="phóng"]')) {
        markUserInteraction()
      }
    }
    box.addEventListener('wheel', markUserInteraction, { passive: true })
    box.addEventListener('touchstart', markUserInteraction, { passive: true })
    box.addEventListener('click', markZoomControl)

    const apiKey = (import.meta.env.VITE_GOOGLE_MAPS_API_KEY as string | undefined)?.trim() ?? ''
    void loadGoogleMaps(apiKey).then((maps) => {
      if (!isActive()) return
      try {
        const current = propsRef.current
        const initialViewport = current.initialViewport
        const map = new maps.Map(box, {
          center: initialViewport?.center ?? current.origin,
          zoom: initialViewport?.zoom ?? calculateInitialZoom(current.origin.lat, current.radiusKm, canvasSize(box)),
          mapTypeId: maps.MapTypeId.ROADMAP,
          isFractionalZoomEnabled: true,
          zoomControl: true,
          streetViewControl: false,
          fullscreenControl: false,
          mapTypeControl: true,
          mapTypeControlOptions: {
            style: maps.MapTypeControlStyle.HORIZONTAL_BAR,
            mapTypeIds: [maps.MapTypeId.ROADMAP, maps.MapTypeId.HYBRID],
          },
        })
        mapRef.current = map
        lastRecenterRef.current = { origin: current.origin, recenterRequest: current.recenterRequest }

        radiusCircleRef.current = new maps.Circle({
          map,
          center: current.origin,
          radius: radiusKmToMeters(current.radiusKm),
          clickable: false,
          fillColor: '#3b82f6',
          fillOpacity: 0.08,
          strokeColor: '#2563eb',
          strokeOpacity: 0.75,
          strokeWeight: 1.5,
        })
        originOverlayRef.current = createOriginOverlay(maps.OverlayView, map, current.origin, current.originIsUser)
        jobLayerRef.current = createGoogleJobMarkerLayer(maps.OverlayView, map)
        jobLayerRef.current.setMarkers(current.markers, current.selectedId, current.onSelect)

        listeners.push(map.addListener('dragstart', markUserInteraction))
        listeners.push(map.addListener('idle', () => {
          if (!isActive()) return
          const center = map.getCenter()
          const zoom = map.getZoom()
          if (!center || typeof zoom !== 'number') return
          const viewport = { center: { lat: center.lat(), lng: center.lng() }, zoom }
          box.dataset.mapCenterLat = String(viewport.center.lat)
          box.dataset.mapCenterLng = String(viewport.center.lng)
          box.dataset.mapZoom = String(zoom)
          const serialized = `${viewport.center.lat.toFixed(7)},${viewport.center.lng.toFixed(7)},${zoom.toFixed(4)}`
          if (serialized !== lastReported) {
            lastReported = serialized
            propsRef.current.onViewportChange(viewport)
          }
          if (!ready) {
            ready = true
            propsRef.current.onReady()
          }
        }))

        resizeObserver = new ResizeObserver(() => {
          const googleHost = (window as unknown as { google?: typeof google }).google
          if (isActive() && googleHost) googleHost.maps.event.trigger(map, 'resize')
        })
        resizeObserver.observe(box)
      } catch {
        fail('initialization-error')
      }
    }).catch(() => fail('loader-error'))

    return () => {
      active = false
      generationRef.current += 1
      unsubscribeAuthFailure()
      resizeObserver?.disconnect()
      for (const listener of listeners) listener.remove()
      box.removeEventListener('wheel', markUserInteraction)
      box.removeEventListener('touchstart', markUserInteraction)
      box.removeEventListener('click', markZoomControl)
      jobLayerRef.current?.destroy()
      jobLayerRef.current = null
      originOverlayRef.current?.destroy()
      originOverlayRef.current = null
      radiusCircleRef.current?.setMap(null)
      radiusCircleRef.current = null
      mapRef.current = null
    }
  }, [])

  useEffect(() => {
    radiusCircleRef.current?.setRadius(radiusKmToMeters(props.radiusKm))
  }, [props.radiusKm])

  useEffect(() => {
    const map = mapRef.current
    const box = boxRef.current
    if (!map || !box) return
    radiusCircleRef.current?.setCenter(props.origin)
    originOverlayRef.current?.setPosition(props.origin, props.originIsUser)
    const previous = lastRecenterRef.current
    const recenter = previous.origin.lat !== props.origin.lat
      || previous.origin.lng !== props.origin.lng
      || previous.recenterRequest !== props.recenterRequest
    lastRecenterRef.current = { origin: props.origin, recenterRequest: props.recenterRequest }
    if (recenter) {
      userInteractedRef.current = false
      map.setCenter(props.origin)
      map.setZoom(calculateInitialZoom(props.origin.lat, props.radiusKm, canvasSize(box)))
    }
  }, [props.origin, props.originIsUser, props.radiusKm, props.recenterRequest])

  useEffect(() => {
    jobLayerRef.current?.setMarkers(props.markers, props.selectedId, props.onSelect)
  }, [props.markers, props.selectedId, props.onSelect])

  return <div className="hme-map" data-map-provider="google"><div ref={boxRef} className="hme-map__canvas" /></div>
}
