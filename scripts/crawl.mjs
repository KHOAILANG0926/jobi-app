/**
 * 베트남 채용공고 크롤러 (Playwright 기반)
 * 대상: vietnamworks.com, topcv.vn, timviecnhanh.com, careerbuilder.vn, vieclam24h.vn
 * 실행: node scripts/crawl.mjs
 * 환경변수: SUPABASE_SERVICE_ROLE_KEY
 */

import { chromium } from 'playwright'
import { createClient } from '@supabase/supabase-js'

const SUPABASE_URL = 'https://edhuesdnuxlbcfephutq.supabase.co'
const SUPABASE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY
if (!SUPABASE_KEY) { console.error('❌ SUPABASE_SERVICE_ROLE_KEY 없음'); process.exit(1) }

const supabase = createClient(SUPABASE_URL, SUPABASE_KEY)

function guessCategory(text = '') {
  const t = text.toLowerCase()
  if (/nhà máy|sản xuất|công nhân|kho|lắp ráp|kỹ thuật|điện tử|cơ khí/.test(t)) return 'factory'
  if (/cà phê|cafe|nhà hàng|bếp|phục vụ|bartender|pha chế/.test(t)) return 'cafe'
  if (/giao hàng|shipper|tài xế|xe máy|vận chuyển|delivery/.test(t)) return 'delivery'
  if (/vệ sinh|giúp việc|dọn dẹp|tạp vụ/.test(t)) return 'cleaning'
  if (/bán hàng|thu ngân|cửa hàng|siêu thị|sales|kinh doanh/.test(t)) return 'retail'
  return 'other'
}

function today() { return new Date().toISOString().slice(0, 10) }

async function scrapeWithPage(browser, url, scraper, siteName) {
  const page = await browser.newPage()
  try {
    await page.setExtraHTTPHeaders({
      'Accept-Language': 'vi-VN,vi;q=0.9,en;q=0.8',
      'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
    })
    console.log(`  → ${url}`)
    await page.goto(url, { waitUntil: 'networkidle', timeout: 30000 })
    await page.waitForTimeout(3000)
    // 디버그: 페이지에서 찾은 요소 수 로그
    const elemCount = await page.evaluate(() => document.querySelectorAll('*').length)
    console.log(`  ℹ️  페이지 요소 수: ${elemCount}`)
    const jobs = await scraper(page)
    console.log(`  ✅ ${siteName}: ${jobs.length}개`)
    return jobs
  } catch (e) {
    console.error(`  ❌ ${siteName} 실패: ${e.message}`)
    return []
  } finally {
    await page.close()
  }
}

// ─── 1. VietnamWorks ───────────────────────────────────────────────
async function scrapeVietnamWorks(page) {
  const title = await page.title()
  console.log(`  📄 페이지 제목: ${title}`)
  // __NEXT_DATA__ JSON 파싱 시도
  const nextData = await page.evaluate(() => {
    const el = document.getElementById('__NEXT_DATA__')
    if (el) return JSON.parse(el.textContent)
    return null
  })
  if (nextData) {
    const jobs = nextData?.props?.pageProps?.jobs?.data || []
    if (jobs.length > 0) {
      return jobs.map(item => ({
        title: item.jobTitle || '',
        company: item.companyName || '',
        location: item.locationNames?.join(', ') || 'Hồ Chí Minh',
        salary: item.salaryRange || '',
        description: `[source:vietnamworks] ${item.jobDescription || ''}`.slice(0, 2000),
        category: guessCategory(item.jobTitle),
        posted_at: today(), urgent: false,
        employer_phone: '',
        application_deadline: item.expiredDate?.slice(0, 10) || '',
      }))
    }
  }
  // DOM 파싱 fallback
  return page.evaluate(() => {
    const items = []
    document.querySelectorAll('[class*="job-item"], [class*="search-result-item"]').forEach(el => {
      const title = el.querySelector('h2, h3, [class*="job-title"]')?.innerText?.trim()
      const company = el.querySelector('[class*="company"]')?.innerText?.trim()
      const location = el.querySelector('[class*="location"]')?.innerText?.trim()
      const salary = el.querySelector('[class*="salary"]')?.innerText?.trim()
      if (title) items.push({ title, company: company||'', location: location||'Hồ Chí Minh', salary: salary||'' })
    })
    return items
  }).then(items => items.map(i => ({
    ...i,
    description: '[source:vietnamworks] ',
    category: guessCategory(i.title),
    posted_at: today(), urgent: false,
    employer_phone: '', application_deadline: '',
  })))
}

// ─── 2. TopCV ─────────────────────────────────────────────────────
async function scrapeTopCV(page) {
  const nextData = await page.evaluate(() => {
    const el = document.getElementById('__NEXT_DATA__')
    if (el) return JSON.parse(el.textContent)
    return null
  })
  if (nextData) {
    const jobs = nextData?.props?.pageProps?.jobs ||
                 nextData?.props?.pageProps?.data?.jobs || []
    if (jobs.length > 0) {
      return jobs.map(item => ({
        title: item.title || '',
        company: item.company?.name || '',
        location: item.working_location?.[0]?.name || 'Hồ Chí Minh',
        salary: item.salary || '',
        description: `[source:topcv] ${item.description || ''}`.slice(0, 2000),
        category: guessCategory(item.title),
        posted_at: today(), urgent: false,
        employer_phone: '',
        application_deadline: item.expired_at?.slice(0, 10) || '',
      }))
    }
  }
  return page.evaluate(() => {
    const items = []
    document.querySelectorAll('.job-item, [class*="job-list-item"]').forEach(el => {
      const title = el.querySelector('h3, h2, [class*="title"]')?.innerText?.trim()
      const company = el.querySelector('[class*="company"]')?.innerText?.trim()
      const location = el.querySelector('[class*="location"]')?.innerText?.trim()
      const salary = el.querySelector('[class*="salary"]')?.innerText?.trim()
      if (title) items.push({ title, company: company||'', location: location||'Hồ Chí Minh', salary: salary||'' })
    })
    return items
  }).then(items => items.map(i => ({
    ...i,
    description: '[source:topcv] ',
    category: guessCategory(i.title),
    posted_at: today(), urgent: false,
    employer_phone: '', application_deadline: '',
  })))
}

// ─── 3. TimViecNhanh ──────────────────────────────────────────────
async function scrapeTimViecNhanh(page) {
  return page.evaluate(() => {
    const items = []
    document.querySelectorAll('.job-item, [class*="job"], li[class*="item"]').forEach(el => {
      const title = el.querySelector('h2, h3, a[class*="title"], [class*="job-name"]')?.innerText?.trim()
      const company = el.querySelector('[class*="company"]')?.innerText?.trim()
      const location = el.querySelector('[class*="location"], [class*="city"]')?.innerText?.trim()
      const salary = el.querySelector('[class*="salary"]')?.innerText?.trim()
      if (title && title.length > 3) items.push({ title, company: company||'', location: location||'', salary: salary||'' })
    })
    return items
  }).then(items => items.map(i => ({
    ...i,
    description: '[source:timviecnhanh] ',
    category: guessCategory(i.title),
    posted_at: today(), urgent: false,
    employer_phone: '', application_deadline: '',
  })))
}

// ─── 4. CareerBuilder ─────────────────────────────────────────────
async function scrapeCareerBuilder(page) {
  return page.evaluate(() => {
    const items = []
    document.querySelectorAll('[class*="job-item"], .job, [class*="card-job"]').forEach(el => {
      const title = el.querySelector('h2, h3, a[class*="title"]')?.innerText?.trim()
      const company = el.querySelector('[class*="company"]')?.innerText?.trim()
      const location = el.querySelector('[class*="location"], [class*="city"]')?.innerText?.trim()
      const salary = el.querySelector('[class*="salary"]')?.innerText?.trim()
      if (title && title.length > 3) items.push({ title, company: company||'', location: location||'', salary: salary||'' })
    })
    return items
  }).then(items => items.map(i => ({
    ...i,
    description: '[source:careerbuilder] ',
    category: guessCategory(i.title),
    posted_at: today(), urgent: false,
    employer_phone: '', application_deadline: '',
  })))
}

// ─── 5. ViecLam24h ────────────────────────────────────────────────
async function scrapeViecLam24h(page) {
  return page.evaluate(() => {
    const items = []
    document.querySelectorAll('[class*="job-item"], [class*="job_item"], article').forEach(el => {
      const title = el.querySelector('h2, h3, a[class*="title"], [class*="name"]')?.innerText?.trim()
      const company = el.querySelector('[class*="company"]')?.innerText?.trim()
      const location = el.querySelector('[class*="location"], [class*="address"]')?.innerText?.trim()
      const salary = el.querySelector('[class*="salary"]')?.innerText?.trim()
      if (title && title.length > 3) items.push({ title, company: company||'', location: location||'', salary: salary||'' })
    })
    return items
  }).then(items => items.map(i => ({
    ...i,
    description: '[source:vieclam24h] ',
    category: guessCategory(i.title),
    posted_at: today(), urgent: false,
    employer_phone: '', application_deadline: '',
  })))
}

// ─── 저장 ─────────────────────────────────────────────────────────
async function saveJobs(jobs) {
  if (!jobs.length) { console.log('  ℹ️  저장할 공고 없음'); return }

  const seen = new Set()
  const unique = jobs.filter(j => {
    if (!j.title || j.title.length < 3) return false
    const key = `${j.title}__${j.company}`.toLowerCase()
    if (seen.has(key)) return false
    seen.add(key)
    return true
  })

  const { data: existing } = await supabase
    .from('jobs')
    .select('title, company')
    .gte('posted_at', new Date(Date.now() - 7 * 86400000).toISOString().slice(0, 10))

  const existingKeys = new Set((existing || []).map(r => `${r.title}__${r.company}`.toLowerCase()))
  const newJobs = unique.filter(j => !existingKeys.has(`${j.title}__${j.company}`.toLowerCase()))

  if (!newJobs.length) { console.log('  ℹ️  모두 중복'); return }

  for (let i = 0; i < newJobs.length; i += 50) {
    const { error } = await supabase.from('jobs').insert(newJobs.slice(i, i + 50))
    if (error) console.error(`  ❌ 저장 실패: ${error.message}`)
    else console.log(`  ✅ ${Math.min(i + 50, newJobs.length)}/${newJobs.length} 저장`)
  }
}

// ─── 메인 ─────────────────────────────────────────────────────────
async function main() {
  console.log('🚀 크롤링 시작:', new Date().toLocaleString('ko-KR'))
  console.log('─'.repeat(50))

  const browser = await chromium.launch({
    headless: true,
    args: ['--ignore-certificate-errors', '--no-sandbox', '--disable-setuid-sandbox'],
  })

  const targets = [
    { name: 'VietnamWorks', url: 'https://www.vietnamworks.com/viec-lam-tat-ca-nganh-nghe', scraper: scrapeVietnamWorks },
    { name: 'TopCV',        url: 'https://www.topcv.vn/tim-viec-lam-moi-nhat', scraper: scrapeTopCV },
    { name: 'TimViecNhanh', url: 'https://www.timviecnhanh.com/viec-lam', scraper: scrapeTimViecNhanh },
    { name: 'CareerBuilder', url: 'https://careerbuilder.vn/viec-lam/tat-ca-viec-lam.html', scraper: scrapeCareerBuilder },
    { name: 'ViecLam24h',   url: 'https://vieclam24h.vn/tim-kiem-viec-lam-nhanh.html', scraper: scrapeViecLam24h },
  ]

  const allJobs = []
  for (const t of targets) {
    console.log(`\n📡 ${t.name} 크롤링 중...`)
    const jobs = await scrapeWithPage(browser, t.url, t.scraper, t.name)
    allJobs.push(...jobs)
  }

  await browser.close()

  console.log(`\n📊 총 수집: ${allJobs.length}개`)
  await saveJobs(allJobs)
  console.log('\n✨ 완료!')
}

main().catch(console.error)
