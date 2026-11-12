// R2(#753) 운영 화면 검증(읽기 전용, 검증 전용): 운영 사이트의 대표 공고를 PC1366·모바일390 브라우저로 열어,
// 독립 기대값(r2Oracle.fixtures.ts)의 근거 문장·급여 숫자·전화가 실제 화면 글자에 있는지 대조한다. 운영 DB 접근·쓰기 없음.
import { chromium } from 'playwright'
import { R2_ORACLE } from '../../src/lib/r2Oracle.fixtures.ts'

const base = process.env.BASE_URL || 'https://www.viecganban.vn'
const IDS = { '4824 KDA': 4824, '4828 Mao Yên': 4828, '4878 TEFAL': 4878, '4879 ADTEK': 4879, '4982 Bomunttl(복수 직무)': 4982, '5157 Highlands': 5157 }
const norm = (s) => String(s).normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/đ/gi, 'd').toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim()
const browser = await chromium.launch({ args: ['--no-sandbox'] })
let checked = 0, missing = 0, absent = 0
for (const width of [1366, 390]) {
  const ctx = await browser.newContext({ viewport: { width, height: 1000 } })
  for (const o of R2_ORACLE) {
    const id = IDS[o.id]; if (!id) continue
    const page = await ctx.newPage()
    let text = ''
    try { await page.goto(`${base}/viec-lam/sb-${id}`, { waitUntil: 'networkidle', timeout: 60000 }); await page.waitForTimeout(2000); text = await page.locator('body').innerText() } catch (e) { text = '' }
    const flat = norm(text)
    const overflow = await page.evaluate(() => document.documentElement.scrollWidth > innerWidth + 1).catch(() => null)
    if (flat.length < 300 || /khong tim thay tin|tin khong ton tai/.test(flat.slice(0, 800))) { console.log(`${width}px ${o.id} (sb-${id}): 운영에 공개된 상세 화면이 아님(비공개/없음) — 비교 제외`); absent++; await page.close(); continue }
    const miss = []
    for (const f of o.facts) { checked++; if (!flat.includes(norm(f.evidence))) { miss.push(f.evidence); missing++ } }
    for (const p of o.ctx.phones) { checked++; if (!flat.replace(/ /g, '').includes(String(p).replace(/\D/g, ''))) { miss.push('전화 ' + p); missing++ } }
    console.log(`${width}px ${o.id} (sb-${id}): 기대 문장 ${o.facts.length}개 중 화면에 없음 ${miss.length}개 ${miss.length ? JSON.stringify(miss) : ''} | 가로넘침 ${overflow}`)
    await page.close()
  }
  await ctx.close()
}
await browser.close()
console.log(`운영 화면 대조: 검사 ${checked}건, 화면에 없음 ${missing}건, 공개 아님으로 제외 ${absent}건`)
if (!checked) { console.error('비교한 공고가 없음'); process.exit(2) }
process.exit(missing ? 1 : 0)
