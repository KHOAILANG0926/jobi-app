// Lee 2026-11-08 "3 적용"·5번 B안: 공고 등록 '미리보기'가 저장 전 입력값을 상세 화면 틀 그대로 새 창에 보여 주고, 단추는 눌리지 않는지(PC·휴대폰).
import assert from 'node:assert/strict'
import { chromium } from 'playwright'
import { collectScreen } from '../ops/screen-collect.mjs'
import { screenAudit } from '../../src/lib/screenAudit.ts'
const base = (process.env.BASE_URL || 'http://localhost:4173').replace(/\/$/, '')
const b = await chromium.launch({ executablePath: process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH || undefined })
try {
  for (const [name, viewport, button] of [['pc', { width: 1366, height: 900 }, '.pj-side__pv button:first-child'], ['mobile', { width: 390, height: 844 }, '.pj-bar button:has-text("Xem trước")']]) {
    const ctx = await b.newContext({ viewport })
    await ctx.route('**/*', (r) => { const u = new URL(r.request().url()); return u.origin === new URL(base).origin ? r.continue() : r.fulfill({ json: [] }) })
    const page = await ctx.newPage(); page.setDefaultTimeout(15000)
    await page.goto(base + '/dang-tin', { waitUntil: 'domcontentloaded' })
    const title = 'Tuyển nhân viên phục vụ thử xem trước ' + name
    await page.locator('.pj input[maxlength="40"]').first().fill(title.slice(0, 40))
    await page.locator('.pj').getByRole('button', { name: 'Part-time', exact: true }).click()
    // Lee 2026-11-08 B안: 간편 템플릿 '적용하기' → 미리보기 상세 ④가 템플릿 모양 그대로
    page.on('dialog', (d) => d.accept())
    await page.locator('.amt-apply__btn').click()
    const popupP = ctx.waitForEvent('page')
    await page.locator(button).first().click()
    const pop = await popupP
    await pop.waitForLoadState('domcontentloaded')
    await pop.locator('.jd2-preview-note').waitFor()
    assert.equal((await pop.locator('h1.jd2-header__title').innerText()).trim(), title.slice(0, 40), 'preview shows typed title')
    assert.equal(await pop.locator('.jd2-page--v2').count(), 1, 'preview uses the latest detail frame')
    await pop.locator('.jd2-template-doc .amt-pv').waitFor()
    assert.equal(await pop.locator('.jd2-detail-sections').count(), 0, 'template replaces plain description lines')
    // #579: 전화 없이 미리 보면 연락처 없음 안내 상자가 다른 칸(표·지도)을 덮지 않는다
    const overlaps = await pop.evaluate(() => {
      const a = document.querySelector('.jd2-aside--no-contact'); if (!a || getComputedStyle(a).display === 'none') return []
      const ab = a.getBoundingClientRect()
      return [...a.parentElement.children].filter((c) => c !== a && c.tagName !== 'H2' && getComputedStyle(c).display !== 'none')
        .filter((c) => { const r = c.getBoundingClientRect(); return r.top < ab.bottom - 1 && r.bottom > ab.top + 1 && r.left < ab.right - 1 && r.right > ab.left + 1 })
        .map((c) => c.className)
    })
    assert.deepEqual(overlaps, [], 'no-contact notice does not cover other boxes')
    const pe = await pop.locator('.jd2-page--preview button').first().evaluate((el) => getComputedStyle(el).pointerEvents)
    assert.equal(pe, 'none', 'buttons are inert in preview')
    // #5876(Lee 2026-11-10): 제목 앞 회사명을 떼면 이어 붙은 대시도 떼고, 제목의 'CÔNG NHÂN'을 회사명으로 보지 않는다(회사 줄 = 회사명 전체)
    await pop.evaluate(() => { const k = 'vgb:postjob-preview'; const j = JSON.parse(localStorage.getItem(k) || '{}')
      localStorage.setItem(k, JSON.stringify({ ...j, company: 'CÔNG TY TNHH ZHAN AN', title: 'CÔNG TY TNHH ZHAN AN – TUYỂN DỤNG CÔNG NHÂN SẢN XUẤT' })) })
    await pop.reload({ waitUntil: 'domcontentloaded' })
    await pop.locator('.jd2-preview-note').waitFor()
    assert.equal((await pop.locator('h1.jd2-header__title').innerText()).trim(), 'TUYỂN DỤNG CÔNG NHÂN SẢN XUẤT', 'title loses company prefix and its dash')
    assert.equal((await pop.locator('.jd2-header__company').innerText()).trim(), 'CÔNG TY TNHH ZHAN AN', 'company line is the full name')
    // 화면 대조 검사(#646): 같은 화면을 수집기·판정 함수로 읽어도 제목·회사 줄 확정 오류가 없어야 한다(운영 검사와 같은 부품)
    const seen = await collectScreen(pop, name)
    const bad = screenAudit({ id: 0, title: 'CÔNG TY TNHH ZHAN AN – TUYỂN DỤNG CÔNG NHÂN SẢN XUẤT', company: 'CÔNG TY TNHH ZHAN AN' }, [seen]).filter((f) => f.sure && ['title', 'company'].includes(f.key))
    assert.deepEqual(bad, [], 'screen audit finds no title/company error on the rendered preview')
    // Lee 2026-11-10 적용(상세 ④ 꾸민 본문): 수집 공고 모양(템플릿 없이 원문 줄)으로 큰 급여·아이콘 카드·절차 화살표·전화 버튼이 나오고 가로로 넘치지 않는다
    await pop.evaluate(() => { const k = 'vgb:postjob-preview'; const j = JSON.parse(localStorage.getItem(k) || '{}')
      localStorage.setItem(k, JSON.stringify({ ...j, descriptionHtml: undefined, description_html: undefined, category: 'san_xuat_xay_dung', rawSalary: '7.300.000Đ/THÁNG', salary: '7.300.000Đ/THÁNG', employerPhone: '0969661314',
        description: ['Công việc', '2. CÔNG VIỆC', 'Vận hành, hỗ trợ sản xuất tại bộ phận ép nhựa.', 'Lắp ráp và đóng gói sản phẩm nhựa.', 'Thu nhập', 'THƯỞNG GẮN BÓ ĐẾN 1.000.000Đ', 'Tiền tăng ca được tính riêng theo quy định.',
          'Quy trình tuyển dụng', 'Vui lòng liên hệ trực tiếp để được tư vấn và sắp xếp phỏng vấn.'].join('\n') })) })
    await pop.reload({ waitUntil: 'domcontentloaded' })
    await pop.locator('.jd2-rich').waitFor()
    assert.equal((await pop.locator('.jd2-rich__hero b').innerText()).trim(), '7.300.000Đ/THÁNG', 'rich: big salary')
    assert((await pop.locator('.jd2-rich__card').count()) >= 3, 'rich: icon cards')
    assert.equal((await pop.locator('.jd2-rich__step').count()), 3, 'rich: process arrows from source words')
    assert.equal(await pop.locator('a.jd2-rich__cta').getAttribute('href'), 'tel:0969661314', 'rich: call button')
    assert(!(await pop.evaluate(() => document.documentElement.scrollWidth > innerWidth + 1)), 'rich: no horizontal overflow')
    assert.match(await pop.locator('.jd2-desc-visual__img').getAttribute('src'), /07-nhua-ep/, 'header drawing: factory kind (ép nhựa) as before')
    // 2026-11-11 Lee "사진 안 맞는다": 커피 가게는 카드와 같은 카페 사진(쌀국수 주방 아님)
    await pop.evaluate(() => { const k = 'vgb:postjob-preview'; const j = JSON.parse(localStorage.getItem(k) || '{}')
      localStorage.setItem(k, JSON.stringify({ ...j, category: 'am_thuc_do_uong', company: 'TRUNG NGUYÊN LEGEND BẮC NINH', title: 'TUYỂN NHÂN VIÊN PHỤC VỤ – TRUNG NGUYÊN LEGEND', description: `${j.description}\nPha chế cà phê, phục vụ khách` })) })
    await pop.reload({ waitUntil: 'domcontentloaded' })
    await pop.locator('.jd2-desc-visual__img').waitFor()
    assert.equal(await pop.locator('.jd2-desc-visual__img').getAttribute('src'), '/images/industry/am_thuc_do_uong.jpg', 'header photo: coffee shop gets the cafe photo like the card')
    console.log('PASS job preview', name)
    await ctx.close()
  }
} finally { await b.close() }
