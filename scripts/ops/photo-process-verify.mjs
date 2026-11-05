// Read-only final acceptance. No database client, uploads or publication writes.
// node scripts/ops/photo-process-verify.mjs <job.json> <production-detail-url> [proof-directory]
import { readFileSync, mkdirSync, writeFileSync, existsSync } from 'node:fs'
import { resolve } from 'node:path'
import { pathToFileURL } from 'node:url'
import { photoProcessPlan, verifyPhotoProcess } from './photo-process.mjs'

export async function runPhotoVerification(payload, { detailUrl, browser, proofDir, fetchImage = fetch }) {
  const detail = new URL(detailUrl)
  if (detail.protocol !== 'https:' || detail.hostname !== 'viecganban.vn' || !/^\/viec-lam\/sb-\d+$/.test(detail.pathname)) throw new Error('정상 운영 상세 URL 필요')
  const plan = photoProcessPlan(payload)
  if (plan.stage !== 'verify_pending') return plan
  mkdirSync(proofDir, { recursive: true })
  return verifyPhotoProcess(payload, {
    detailUrl,
    async image(url) {
      const r = await fetchImage(url, { signal: AbortSignal.timeout(20000), redirect: 'error' })
      if (!r.ok) throw new Error(`이미지 HTTP ${r.status}`)
      const contentType = r.headers.get('content-type') || ''
      if (!/^image\//i.test(contentType)) throw new Error('이미지 MIME 아님')
      const bytes = new Uint8Array(await r.arrayBuffer())
      if (bytes.length > 10 * 1024 * 1024) throw new Error('이미지 10MiB 초과')
      return { contentType, bytes }
    },
    async inspect(width) {
      const context = await browser.newContext({ viewport: { width, height: 1000 }, serviceWorkers: 'block' })
      // Never turn a visual inspection into an authenticated or mutating action.
      await context.route('**/*', route => ['GET', 'HEAD'].includes(route.request().method()) ? route.fallback() : route.abort())
      try {
        const source = await context.newPage()
        const response = await source.goto(plan.sourceUrl, { waitUntil: 'domcontentloaded', timeout: 30000 })
        const norm = s => s.normalize('NFC').toLowerCase().replace(/\s+/g, ' ').trim()
        const named = norm(await source.locator('body').innerText()).includes(norm(payload.company))
        const sourceImages = await source.locator('img').evaluateAll(nodes => nodes.flatMap(n => [n.src, n.currentSrc, n.getAttribute('data-src')].filter(Boolean)))
        const favicon = await source.locator('link[rel*="icon"]').count()
        const sourceVerified = response?.ok() === true && named && (plan.sourceKind === 'brand' ? favicon > 0 : sourceImages.includes(plan.sourceImageUrl))
        const sourceScreenshot = `${proofDir}/source-${width}.png`
        await source.screenshot({ path: sourceScreenshot, fullPage: true })
        const page = await context.newPage()
        const live = await page.goto(detailUrl, { waitUntil: 'domcontentloaded', timeout: 30000 })
        if (!live?.ok()) throw new Error(`상세 HTTP ${live?.status()}`)
        const img = page.locator('.jd2-header .jd2-logo__img').first()
        await img.waitFor({ state: 'visible', timeout: 30000 })
        await img.evaluate(n => n.decode().catch(() => {}))
        const state = await img.evaluate(n => ({ src: n.currentSrc || n.src, loaded: n.complete && n.naturalWidth > 0, company: n.alt }))
        const initial = JSON.parse(await page.locator('script#__INITIAL_STATE__').textContent())
        const job = initial.jobs?.find(j => j.id === plan.expectedJobId)
        const screenshot = `${proofDir}/detail-${width}.png`
        await page.screenshot({ path: screenshot, fullPage: true })
        return { ...state, detailUrl: page.url(), jobId: job?.id, title: job?.title, sourceVerified: sourceVerified && job?.company === payload.company, screenshot, sourceScreenshot }
      } finally { await context.close() }
    },
  })
}

if (process.argv[1] && import.meta.url === pathToFileURL(resolve(process.argv[1])).href) {
  const [file, detailUrl, dir = '/tmp/jobi-photo-proof'] = process.argv.slice(2)
  if (!file || !detailUrl) throw new Error('사용: photo-process-verify.mjs <job.json> <운영 상세 URL> [증거 폴더]')
  const payload = JSON.parse(readFileSync(file, 'utf8'))
  const plan = photoProcessPlan(payload)
  let result = plan
  if (plan.stage === 'verify_pending') {
    const { chromium } = await import('playwright')
    const browser = await chromium.launch({ executablePath: process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH || (existsSync('/usr/bin/chromium') ? '/usr/bin/chromium' : undefined), args: ['--no-sandbox'] })
    try { result = await runPhotoVerification(payload, { detailUrl, browser, proofDir: dir }) }
    finally { await browser.close() }
  }
  mkdirSync(dir, { recursive: true })
  writeFileSync(`${dir}/result.json`, JSON.stringify(result, null, 2) + '\n')
  console.log(JSON.stringify(result, null, 2))
  if (!result.complete) process.exitCode = 1
}
