import { chromium } from 'playwright'
import { join } from 'node:path'
import { tmpdir } from 'node:os'

const baseUrl = process.argv[2] || 'http://127.0.0.1:4173'
const browser = await chromium.launch({ headless: true })

async function verifyViewport(name, viewport) {
  const page = await browser.newPage({ viewport })
  await page.goto(baseUrl, { waitUntil: 'networkidle' })

  const result = await page.evaluate(() => {
    const hero = document.querySelector('.home-brand-hero')
    const discovery = document.querySelector('.home-discovery')
    const latest = document.querySelector('.home-reference-latest')
    const reference = document.querySelector('.home-reference-content')
    if (!(hero instanceof HTMLElement) || !(discovery instanceof HTMLElement) ||
        !(latest instanceof HTMLElement) || !(reference instanceof HTMLElement)) {
      throw new Error('Home composition sections are missing')
    }

    return {
      backgroundSize: getComputedStyle(hero).backgroundSize,
      discoveryCards: discovery.querySelectorAll('.home-discovery__card').length,
      hasKoreaCard: Boolean(discovery.querySelector('.home-discovery__card--korea')),
      latestBeforeReference: latest.getBoundingClientRect().top < reference.getBoundingClientRect().top,
      latestKoreaHref: latest.querySelector('a')?.getAttribute('href'),
      jobCards: document.querySelectorAll('.home-card-wrap').length,
      overflow: document.documentElement.scrollWidth - window.innerWidth,
    }
  })

  const screenshotPath = join(tmpdir(), `viecganban-home-${name}.png`)
  await page.screenshot({ path: screenshotPath, fullPage: false })

  const skillHref = await page.locator('.home-discovery__card--skill .ad-slot__cta-btn').getAttribute('href')
  const accountHref = await page.locator('.home-discovery-account__button').getAttribute('href')
  await page.locator('.home-hero-search__input').fill('kế toán')
  await page.locator('.home-hero-location select').selectOption('hanoi')
  await page.locator('.home-hero-category select').selectOption('office')
  await page.locator('.home-hero-search__button').click()
  await page.waitForTimeout(350)
  const searchState = await page.evaluate(() => ({
    value: document.querySelector('.home-hero-search__input')?.value,
    region: document.querySelector('.home-hero-location select')?.value,
    category: document.querySelector('.home-hero-category select')?.value,
    scrolled: window.scrollY > 0,
  }))

  const failures = []
  const imageSizing = result.backgroundSize.split(',').at(-1)?.trim() || ''
  if (imageSizing === '100% 100%' || (!imageSizing.includes('cover') && !imageSizing.startsWith('auto '))) failures.push('Hero image aspect ratio is not preserved')
  if (result.discoveryCards !== 2) failures.push(`Expected 2 supporting cards, found ${result.discoveryCards}`)
  if (result.hasKoreaCard) failures.push('Duplicate Korea employment card is still visible')
  if (!result.latestBeforeReference) failures.push('Latest jobs section is not directly promoted above reference content')
  if (result.latestKoreaHref !== '/viec-han-quoc' || result.jobCards < 1) failures.push('Latest jobs links or live job data are missing')
  if (result.overflow > 0) failures.push(`Horizontal overflow detected: ${result.overflow}px`)
  if (skillHref !== '/dang-tin') failures.push(`Skill card link changed: ${skillHref}`)
  if (accountHref !== '/dang-nhap') failures.push(`Account card link changed: ${accountHref}`)
  if (searchState.value !== 'kế toán' || searchState.region !== 'hanoi' || searchState.category !== 'office' || !searchState.scrolled) failures.push('Hero search did not preserve keyword, region, category and move to results')

  await page.close()
  if (failures.length) throw new Error(`${name}: ${failures.join('; ')}`)
  return { ...result, skillHref, accountHref, searchState, screenshotPath }
}

try {
  const desktop = await verifyViewport('desktop', { width: 1440, height: 1000 })
  const mobile = await verifyViewport('mobile', { width: 390, height: 844 })
  console.log(JSON.stringify({ desktop, mobile }, null, 2))
} finally {
  await browser.close()
}
