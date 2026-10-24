// Automated acceptance of ONE unpublished job in an isolated browser-only fixture.
// The DB row is loaded by trusted CI via PostgreSQL. Nothing is inserted into the public website.
import fs from 'node:fs'
import { chromium } from 'playwright'

const file = process.argv[2]
if (!file) throw new Error('usage: node review-hidden-job.mjs fixture.json')
const fixture = JSON.parse(fs.readFileSync(file, 'utf8'))
const job = fixture.job
if (!job || !Number.isInteger(job.id) || !fixture.fingerprint) throw new Error('Invalid DB fixture')
const s = value => String(value ?? '').trim()
const key = value => s(value).normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase().replace(/\s+/g,' ')
const reason = message => { throw new Error('REVIEW_FAIL job=' + job.id + ': ' + message) }

// Content relevance: require a usable core, not a copy of every source sentence.
// Optional conditions remain optional; source-platform controls and links are not job content.
for (const field of ['title', 'company', 'description', 'salary', 'location'])
  if (!s(job[field])) reason('empty core field ' + field)
if (!(s(job.employer_phone) || s(job.contact_zalo))) reason('missing actual applicant contact')
if (!s(job.occupation_code) || !s(job.occupation_evidence)) reason('missing occupation evidence')
if (['crawler','admin'].includes(job.origin) && !s(job.source_text))
  reason('missing original source evidence')
if (/https?:\/\/|(?:muaban\.net|chotot\.com|topcv\.vn)|(?:Đăng nhập|Đăng ký tài khoản|Tin tương tự|Xem thêm tin đăng)/iu.test(s(job.description)))
  reason('source-site UI or external portal link is still in description')

const base = process.env.BASE_URL || 'http://127.0.0.1:4173'
const browser = await chromium.launch({ headless: true })
try {
  for (const width of [390,1280]) {
    const page = await browser.newPage({ viewport: { width, height: 900 } })
    await page.addInitScript(payload => { window.__JOB_REVIEW_FIXTURE__ = payload }, { job, locations:fixture.locations ?? [] })
    const errors = []
    page.on('pageerror', e => errors.push(e.message))
    await page.goto(`${base}/viec-lam/sb-${job.id}?reviewFixture=1`, { waitUntil:'domcontentloaded', timeout:60000 })
    await page.waitForFunction(expected => document.querySelector('h1')?.textContent?.includes(expected), s(job.title), { timeout:20000 })
    await page.locator('.jd2-sec--conditions-grid').waitFor({ timeout:15000 })
    const observed = await page.evaluate(() => {
      const visible = el => !!el && !!el.getClientRects().length
      const recruit = document.querySelector('.jd2-sec--recruit-grid')
      const condition = document.querySelector('.jd2-sec--conditions-grid')
      const desc = document.querySelector('.jd2-detail-sections')
      return {
        title: document.querySelector('h1')?.textContent || '',
        recruit: visible(recruit) ? recruit.innerText : '',
        conditions: visible(condition) ? condition.innerText : '',
        desc: visible(desc) ? desc.innerText : '',
        all: document.body.innerText,
        tel: [...document.querySelectorAll('a[href^="tel:"]')].some(visible),
        overflow: document.documentElement.scrollWidth - window.innerWidth,
        directions: [...document.querySelectorAll('a[href*="google.com/maps"]')].map(a=>a.href),
        mapContainer: !!document.querySelector('.jd2-map-container, .jd2-location-pending-compact, .jd2-map-wrap, .jd2-map-addr-list'),
        location: document.querySelector('#jd2-section-location')?.textContent || document.querySelector('.jd2-location-above-map')?.textContent || '',
      }
    })
    if (!key(observed.title).includes(key(job.title))) reason(width + ': wrong job rendered')
    if (!key(observed.conditions).includes(key(job.salary))) reason(width + ': salary not rendered')
    const sourceLine = s(job.description).split(/\r?\n/).map(x=>x.trim().replace(/^[-•*]\s*/, ''))
      .find(x => x.length > 18 && !/^(mô tả công việc|quyền lợi|yêu cầu)/iu.test(x))
    if (sourceLine && !key(observed.desc).includes(key(sourceLine)))
      reason(width + ': job duty omitted from rendered detail')
    for (const [field,target] of [
      ['education','recruit'], ['preference','recruit'], ['age_requirement','recruit'],
      ['gender_requirement','recruit'], ['hours','conditions'], ['work_days','conditions'],
    ]) {
      if (s(job[field]) && !key(observed[target]).includes(key(job[field])))
        reason(width + ': populated field not visible in proper template section: ' + field)
    }
    if (s(job.location) && !key(observed.all).includes(key(job.location))) reason(width + ': location not rendered')
    if (Array.isArray(fixture.locations) && fixture.locations.length > 0 && !observed.mapContainer) reason(width + ': workplace map/location missing')
    if (!observed.tel && s(job.employer_phone)) reason(width + ': no callable phone action')
    if (observed.overflow > 4) reason(width + ': horizontal overflow ' + observed.overflow)
    if (errors.length) reason(width + ': browser runtime error: ' + errors.join('; ').slice(0,300))
    console.log('JOB_REVIEW_PASS',job.id,width,'fields+detail+contacts+overflow')
    await page.close()
  }
} finally { await browser.close() }
fs.writeFileSync(file+'.passed', JSON.stringify({job_id:job.id,fingerprint:fixture.fingerprint,result:'pass'}))
