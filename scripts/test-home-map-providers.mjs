import { spawn } from 'node:child_process'
import { chromium } from 'playwright'
import { loadEnv } from 'vite'

const npmCommand = process.platform === 'win32' ? 'npm.cmd' : 'npm'
const baseUrl = 'http://127.0.0.1:4173'
const fileEnv = loadEnv('production', process.cwd(), '')
const geoKeyPresent = Boolean(process.env.VITE_GEOAPIFY_API_KEY || fileEnv.VITE_GEOAPIFY_API_KEY)
const realGoogleKeyPresent = Boolean(process.env.VITE_GOOGLE_MAPS_API_KEY || fileEnv.VITE_GOOGLE_MAPS_API_KEY)

if (!geoKeyPresent) throw new Error('VITE_GEOAPIFY_API_KEY must be supplied through the process environment')

function run(command, args, env = process.env) {
  return new Promise((resolve, reject) => {
    const child = spawn(command, args, { stdio: 'inherit', env, shell: process.platform === 'win32' })
    child.on('error', reject)
    child.on('exit', (code) => code === 0 ? resolve() : reject(new Error(`${command} exited with ${code}`)))
  })
}

async function waitForServer() {
  for (let attempt = 0; attempt < 80; attempt += 1) {
    try {
      const response = await fetch(baseUrl)
      if (response.ok) return
    } catch {}
    await new Promise((resolve) => setTimeout(resolve, 250))
  }
  throw new Error('Preview server did not start')
}

async function withPreview(callback) {
  const server = spawn(npmCommand, ['run', 'preview', '--', '--host', '127.0.0.1', '--port', '4173', '--strictPort'], {
    stdio: 'ignore',
    env: process.env,
    shell: process.platform === 'win32',
  })
  try {
    await waitForServer()
    return await callback()
  } finally {
    server.kill()
  }
}

async function build(googleKey) {
  await run(npmCommand, ['run', 'build'], { ...process.env, VITE_GOOGLE_MAPS_API_KEY: googleKey })
}

function attachDiagnostics(page) {
  const errors = []
  page.on('pageerror', (error) => errors.push(`pageerror:${error.message}`))
  page.on('console', (message) => {
    if (message.type() === 'error') errors.push(`console:${message.text().replace(/(apiKey|key)=[^&\s]+/gi, '$1=[redacted]')}`)
  })
  return errors
}

async function waitForProvider(page, provider, timeout = 15_000) {
  await page.locator(`.hme-map[data-map-provider="${provider}"]`).waitFor({ state: 'visible', timeout })
  if (provider === 'geoapify') {
    await page.waitForFunction(() => Boolean(document.querySelector('.hme-map__canvas')?.dataset.mapZoom), null, { timeout })
  }
}

async function readViewport(page) {
  return page.locator('.hme-map__canvas').evaluate((element) => ({
    lat: Number(element.dataset.mapCenterLat),
    lng: Number(element.dataset.mapCenterLng),
    zoom: Number(element.dataset.mapZoom),
  }))
}

async function setRadius(page, radiusKm) {
  await page.locator('.hme-radius input[type="range"]').evaluate((element, value) => {
    const input = element
    const setter = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value').set
    setter.call(input, String(value))
    input.dispatchEvent(new Event('input', { bubbles: true }))
    input.dispatchEvent(new Event('change', { bubbles: true }))
  }, radiusKm)
  await page.waitForFunction((value) => document.querySelector('.hme-radius__row strong')?.textContent?.trim() === `${value} km`, radiusKm)
}

async function chooseRegion(page, label) {
  const menu = page.locator('.hme-loc__menu')
  if (!await menu.isVisible().catch(() => false)) await page.locator('.hme-loc__current').click()
  await page.locator('#hme-region').selectOption({ label })
  await page.waitForTimeout(700)
}

function assertClose(actual, expected, tolerance, label) {
  if (!Number.isFinite(actual) || Math.abs(actual - expected) > tolerance) {
    throw new Error(`${label}: expected ${expected} ± ${tolerance}, received ${actual}`)
  }
}

async function verifyNoKeyGeoapify(browser) {
  const requestSummary = { google: 0, styleStatuses: [] }
  const page = await browser.newPage({ viewport: { width: 1440, height: 900 }, geolocation: { latitude: 21.3, longitude: 106.2 } })
  await page.context().grantPermissions(['geolocation'], { origin: baseUrl })
  const errors = attachDiagnostics(page)
  page.on('request', (request) => { if (request.url().includes('maps.googleapis.com')) requestSummary.google += 1 })
  page.on('response', (response) => {
    if (response.url().includes('maps.geoapify.com') && response.url().includes('/styles/')) requestSummary.styleStatuses.push(response.status())
  })
  await page.goto(baseUrl, { waitUntil: 'domcontentloaded' })
  await waitForProvider(page, 'geoapify')
  await page.locator('.home-featured').waitFor({ state: 'visible', timeout: 12_000 })
  for (let attempt = 0; attempt < 40 && requestSummary.styleStatuses.length === 0; attempt += 1) {
    await page.waitForTimeout(250)
  }
  if (requestSummary.google !== 0) throw new Error('Google request occurred in key-absent build')
  if (!requestSummary.styleStatuses.some((status) => status >= 200 && status < 400)) throw new Error('Geoapify style did not load successfully')
  if (await page.locator('.hme-map__notice').count()) throw new Error('Healthy Geoapify rendered a technical error notice')

  const layouts = []
  for (const [width, height, expectedMapHeight] of [[1366, 768, 425], [1440, 900, 440], [1920, 1080, 485]]) {
    await page.setViewportSize({ width, height })
    await page.waitForTimeout(200)
    const metrics = await page.evaluate(() => {
      const root = document.querySelector('.hme').getBoundingClientRect()
      const controls = document.querySelector('.hme__controls').getBoundingClientRect()
      const map = document.querySelector('.hme__map').getBoundingClientRect()
      const panel = document.querySelector('.hme__panel').getBoundingClientRect()
      return {
        height: root.height,
        aligned: Math.abs(controls.top - map.top) < 1 && Math.abs(map.top - panel.top) < 1
          && Math.abs(controls.bottom - map.bottom) < 1 && Math.abs(map.bottom - panel.bottom) < 1,
        overflow: document.documentElement.scrollWidth - window.innerWidth,
        panelOverflow: getComputedStyle(document.querySelector('.hme__panel')).overflowY,
        controlsOverflow: getComputedStyle(document.querySelector('.hme__controls')).overflowY,
        featured: Boolean(document.querySelector('.home-featured')),
        korea: Boolean(document.querySelector('.home-hero-cta')),
      }
    })
    assertClose(metrics.height, expectedMapHeight, 1, `${width}x${height} map height`)
    if (!metrics.aligned || metrics.overflow > 0 || metrics.panelOverflow !== 'auto' || metrics.controlsOverflow !== 'auto' || !metrics.featured || !metrics.korea) {
      throw new Error(`${width}x${height} layout regression: ${JSON.stringify(metrics)}`)
    }
    layouts.push({ width, height, mapHeight: metrics.height })
  }

  await page.setViewportSize({ width: 1440, height: 900 })
  await setRadius(page, 3)
  await chooseRegion(page, 'Bắc Giang')
  await chooseRegion(page, 'Bắc Ninh')
  const initial = await readViewport(page)
  const mapSize = await page.locator('.hme__map').evaluate((element) => ({ width: element.clientWidth, height: element.clientHeight }))
  const metersPerPixel = 156543.03392804097 * Math.cos(21.1861 * Math.PI / 180) / (2 ** initial.zoom)
  const diameterRatio = (6000 / metersPerPixel) / Math.min(mapSize.width, mapSize.height)
  if (diameterRatio < 0.60 || diameterRatio > 0.70) throw new Error(`3km projected diameter ratio is ${diameterRatio}`)

  const mapBox = await page.locator('.hme__map').boundingBox()
  await page.mouse.move(mapBox.x + mapBox.width / 2, mapBox.y + mapBox.height / 2)
  await page.mouse.wheel(0, -700)
  await page.waitForTimeout(700)
  const afterWheel = await readViewport(page)
  await setRadius(page, 5)
  const afterWheelRadius = await readViewport(page)
  assertClose(afterWheelRadius.zoom, afterWheel.zoom, 0.001, 'wheel then radius keeps zoom')
  assertClose(afterWheelRadius.lat, afterWheel.lat, 0.000001, 'wheel then radius keeps latitude')
  assertClose(afterWheelRadius.lng, afterWheel.lng, 0.000001, 'wheel then radius keeps longitude')

  await page.mouse.move(mapBox.x + mapBox.width / 2, mapBox.y + mapBox.height / 2)
  await page.mouse.down()
  await page.mouse.move(mapBox.x + mapBox.width / 2 + 80, mapBox.y + mapBox.height / 2 + 30, { steps: 5 })
  await page.mouse.up()
  await page.waitForTimeout(700)
  const afterDrag = await readViewport(page)
  await setRadius(page, 6)
  const afterDragRadius = await readViewport(page)
  assertClose(afterDragRadius.lat, afterDrag.lat, 0.000001, 'drag then radius keeps latitude')
  assertClose(afterDragRadius.lng, afterDrag.lng, 0.000001, 'drag then radius keeps longitude')

  await page.locator('.maplibregl-ctrl-zoom-in').click()
  await page.waitForTimeout(700)
  const afterControl = await readViewport(page)
  await setRadius(page, 7)
  const afterControlRadius = await readViewport(page)
  assertClose(afterControlRadius.zoom, afterControl.zoom, 0.001, 'zoom control then radius keeps zoom')

  await chooseRegion(page, 'Bắc Giang')
  const afterRegion = await readViewport(page)
  if (Math.abs(afterRegion.lat - afterControlRadius.lat) < 0.01) throw new Error('Region change did not recenter')
  await page.locator('.hme-loc__current').click()
  await page.locator('.hme-loc__use').click()
  await page.waitForTimeout(900)
  const afterLocation = await readViewport(page)
  assertClose(afterLocation.lat, 21.3, 0.01, 'current location recenters latitude')
  assertClose(afterLocation.lng, 106.2, 0.01, 'current location recenters longitude')

  await page.setViewportSize({ width: 375, height: 812 })
  await page.waitForTimeout(200)
  const mobile = await page.evaluate(() => {
    const controls = document.querySelector('.hme__controls').getBoundingClientRect()
    const map = document.querySelector('.hme__map').getBoundingClientRect()
    const panel = document.querySelector('.hme__panel').getBoundingClientRect()
    return { vertical: controls.top < map.top && map.top < panel.top, overflow: document.documentElement.scrollWidth - window.innerWidth }
  })
  if (!mobile.vertical || mobile.overflow > 0) throw new Error('375px mobile map structure regressed')
  if (errors.some((error) => /hydration|maps\.geoapify|style\.json/i.test(error))) throw new Error(errors.join('; '))
  await page.close()
  return { layouts, diameterRatio: Number(diameterRatio.toFixed(4)), interaction: 'PASS', mobile: 'PASS' }
}

function googleFixture({ throwOnMap = false } = {}) {
  return `(() => {
    const old = window.google.maps.__ib__;
    class FakeMap {
      constructor(element, options) {
        if (${throwOnMap}) throw new Error('forced init failure');
        this.element = element; this.center = options.center; this.zoom = options.zoom; this.listeners = {};
        setTimeout(() => this.emit('idle'), 0);
      }
      addListener(type, callback) { (this.listeners[type] ||= []).push(callback); return { remove: () => { this.listeners[type] = (this.listeners[type] || []).filter(x => x !== callback); } }; }
      emit(type) { for (const callback of this.listeners[type] || []) callback(); }
      getCenter() { const p = this.center; return { lat: () => Number(p.lat), lng: () => Number(p.lng) }; }
      getZoom() { return this.zoom; }
      setCenter(center) { this.center = center; this.emit('idle'); }
      setZoom(zoom) { this.zoom = zoom; this.emit('idle'); }
    }
    class FakeCircle { constructor(options) { Object.assign(this, options); } setRadius(radius) { this.radius = radius; } setCenter(center) { this.center = center; } setMap(map) { this.map = map; } }
    class FakeOverlayView {
      setMap(map) { this.map = map; if (map) { this.onAdd?.(); this.draw?.(); } else this.onRemove?.(); }
      getPanes() { return { overlayMouseTarget: this.map.element }; }
      getProjection() { return { fromLatLngToDivPixel: p => ({ x: Number(p.lng), y: Number(p.lat) }) }; }
    }
    const maps = { Map: FakeMap, Circle: FakeCircle, OverlayView: FakeOverlayView,
      MapTypeId: { ROADMAP: 'roadmap', HYBRID: 'hybrid' }, MapTypeControlStyle: { HORIZONTAL_BAR: 1 },
      event: { trigger: () => {} } };
    window.google.maps.importLibrary = async () => maps;
    old();
  })();`
}

async function verifyFailure(browser, mode) {
  const page = await browser.newPage({ viewport: { width: 1440, height: 900 } })
  attachDiagnostics(page)
  if (mode === 'abort') await page.route('**/maps.googleapis.com/maps/api/js?**', (route) => route.abort())
  else if (mode === 'timeout') await page.route('**/maps.googleapis.com/maps/api/js?**', async (route) => {
    await new Promise((resolve) => setTimeout(resolve, 13_500));
    await route.abort().catch(() => undefined)
  })
  else await page.route('**/maps.googleapis.com/maps/api/js?**', (route) => route.fulfill({ contentType: 'application/javascript', body: googleFixture({ throwOnMap: mode === 'init' }) }))
  await page.goto(baseUrl, { waitUntil: 'domcontentloaded' })
  if (mode === 'auth') {
    await waitForProvider(page, 'google')
    await page.waitForTimeout(250)
    await page.evaluate(() => window.gm_authFailure?.())
  }
  await waitForProvider(page, 'geoapify', mode === 'timeout' ? 16_000 : 8_000)
  if (await page.locator('.hme-map[data-map-provider="google"]').count()) throw new Error(`${mode} left a Google canvas mounted`)
  if (await page.locator('.hme-map[data-map-provider="geoapify"]').count() !== 1) throw new Error(`${mode} did not end with exactly one Geoapify canvas`)
  await page.close()
}

const browser = await chromium.launch({ headless: true })
const report = { keyAbsent: null, failures: {}, actualGoogle: realGoogleKeyPresent ? 'NOT_RUN' : 'PENDING_NO_KEY' }
try {
  await build('')
  report.keyAbsent = await withPreview(() => verifyNoKeyGeoapify(browser))

  await build('browser-fixture-key')
  await withPreview(async () => {
    for (const mode of ['abort', 'timeout', 'auth', 'init']) {
      await verifyFailure(browser, mode)
      report.failures[mode] = 'PASS'
    }
  })

  if (realGoogleKeyPresent) report.actualGoogle = 'PENDING_PREVIEW_VALIDATION'
} finally {
  await browser.close()
  await build('')
}

console.log(JSON.stringify(report, null, 2))
