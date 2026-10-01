import { createGoogleJobMarkerLayer } from './GoogleJobMarkerLayer.ts'

function assert(condition: boolean, label: string): void {
  if (!condition) throw new Error(label)
}

class FakeElement {
  className = ''
  title = ''
  tabIndex = -1
  style: Record<string, string> = {}
  children: FakeElement[] = []
  parent: FakeElement | null = null
  attributes = new Map<string, string>()
  listeners = new Map<string, Array<(event: { key?: string; preventDefault: () => void }) => void>>()

  appendChild(child: FakeElement): FakeElement {
    child.remove()
    child.parent = this
    this.children.push(child)
    return child
  }

  remove(): void {
    if (!this.parent) return
    this.parent.children = this.parent.children.filter((child) => child !== this)
    this.parent = null
  }

  setAttribute(name: string, value: string): void { this.attributes.set(name, value) }
  addEventListener(type: string, listener: (event: { key?: string; preventDefault: () => void }) => void): void {
    this.listeners.set(type, [...(this.listeners.get(type) ?? []), listener])
  }
  dispatch(type: string, key?: string): void {
    for (const listener of this.listeners.get(type) ?? []) listener({ key, preventDefault: () => undefined })
  }
}

const pane = new FakeElement()
let createdElements = 0
const fakeDocument = {
  createElement: () => { createdElements += 1; return new FakeElement() },
} as unknown as Document

class FakeOverlayView {
  onAdd(): void {}
  draw(): void {}
  onRemove(): void {}
  setMap(map: unknown): void {
    if (map) { this.onAdd(); this.draw() } else this.onRemove()
  }
  getPanes() { return { overlayMouseTarget: pane } }
  getProjection() {
    return { fromLatLngToDivPixel: (point: { lat: number; lng: number }) => ({ x: point.lng, y: point.lat }) }
  }
}

const selected: string[] = []
const layer = createGoogleJobMarkerLayer(
  FakeOverlayView as unknown as typeof google.maps.OverlayView,
  {} as google.maps.Map,
  { document: fakeDocument },
)
const markers = [
  { id: 'job-a', lat: 21.1, lng: 106.1, label: 'Job A' },
  { id: 'job-b', lat: 21.1, lng: 106.1, label: 'Job B' },
]
layer.setMarkers(markers, 'job-b', (id) => selected.push(id))

assert(pane.children.length === 2, 'same-coordinate jobs remain two job-id marker records')
const jobA = pane.children.find((element) => element.title === 'Job A')
const jobB = pane.children.find((element) => element.title === 'Job B')
assert(Boolean(jobA && jobB), 'both job marker elements are mounted')
jobA?.dispatch('click')
jobB?.dispatch('keydown', 'Enter')
assert(selected.join(',') === 'job-a,job-b', 'each job id selects independently')
assert(jobB?.children[0]?.className.includes('is-selected') === true, 'selected job receives selected styling')

const createdAfterFirstRender = createdElements
layer.setMarkers([markers[1]], null, (id) => selected.push(id))
assert(pane.children.length === 1 && pane.children[0] === jobB, 'stale ids are removed and unchanged ids keep DOM identity')
assert(createdElements === createdAfterFirstRender, 'unchanged ids are not recreated')

layer.destroy()
assert(pane.children.length === 0, 'destroy removes all marker DOM')
console.log('GoogleJobMarkerLayer.test.ts: marker identity assertions passed')
