// 화면 대조 검사(#646) 수집기 — 열린 상세 화면에서 보이는 값을 모은다(판정은 src/lib/screenAudit.ts).
// 상세 화면 읽기(scripts/ops/detail-read.mjs)와 공고 미리보기 화면 검사(scripts/layout/job-preview-check.mjs)가 같이 쓴다.
import { BENEFIT_ORDER } from '../../src/lib/screenAudit.ts'
import { afterCutoff } from './auto-cutoff.mjs'

/**
 * 화면 대조 대상(별칭 j, SQL 조건) — 공개 판정(job-inspect.mjs)과 대조기(detail-read.mjs SCREEN_CANDIDATES=1)가 같이 쓴다.
 * ① 검사표가 '화면 대조만 남음'(inspect.screen_wait)으로 기록한 비공개 공고 중 지금 내용으로 대조 기록이 없는 것
 * ② 지금 내용으로 확정 오류가 기록된 지 3시간 지난 비공개 공고(화면 코드를 고쳤을 수 있어 다시 대조)
 */
const H = 'public.job_inspect_content_hash(j)'
// (승인 대기 짝 변경, #728 R2 A4) DB가 공개 시작을 막아 inspect_hold를 건 고용주·legacy 공고도 같은 화면 대조를 받는다 — 안 받으면 검사표의 화면 대조 대기가 풀리지 않는다.
export const SCREEN_CANDIDATES = `((j.origin in ('crawler','admin') and ${afterCutoff('j')}) or (j.origin in ('employer','legacy') and j.ocr_check->>'inspect_hold' = 'true')) and not j.active and not j.admin_hidden and (
  (j.ocr_check->'inspect'->>'screen_wait' = 'true' and j.ocr_check->'inspect'->>'content_hash' = ${H}
    and (j.ocr_check->'screen_audit'->>'content_hash') is distinct from ${H})
  or (j.ocr_check->'screen_audit'->>'content_hash' = ${H} and (j.ocr_check->'screen_audit'->>'ok') = 'false'
    and (j.ocr_check->'screen_audit'->>'checked_at')::timestamptz < now() - interval '3 hours'))`

/**
 * 지도 핀 기다리기(2026-11-13, sb-5438 모바일 핀 한 번 빔): 상세의 지도(.jd2-vmap)는 JobVietMap 코드 조각을 동적으로 불러온 뒤에야 그려지므로
 * (src/pages/JobDetail.tsx ClientOnlyMap) 고정 대기만으로는 느린 모바일·CI에서 핀을 읽기 전에 수집할 수 있다. 지도 목록 API가 핀이 있다고 한 공고만
 * 핀이 달린 지도 요소를 기다린다. 끝내 안 뜨면 false — 호출자는 '핀 불일치'가 아니라 '핀 읽지 못함(미검증)'으로 다룬다.
 */
export async function waitForMap(page, expectPins, timeout = 20_000) {
  if (!expectPins) return true
  return page.waitForSelector('.jd2-vmap[data-planned-location-points]:not([data-planned-location-points="[]"])', { timeout, state: 'attached' }).then(() => true, () => false)
}

export function collectScreen(page, device) {
  return page.evaluate(({ device, order }) => {
    const txt = (s) => document.querySelector(s)?.textContent?.trim() ?? null
    const hrefs = (s) => [...document.querySelectorAll(s)].map((a) => a.getAttribute('href') ?? '')
    // 지도 핀: 지도 부품이 그리는 점 목록(JobVietMap data-planned-location-points)
    const pins = [...document.querySelectorAll('.jd2-vmap[data-planned-location-points]')].flatMap((e) => {
      try { return JSON.parse(e.getAttribute('data-planned-location-points') || '[]') } catch { return [] }
    }).filter((p) => typeof p?.lat === 'number' && typeof p?.lng === 'number').map((p) => `${p.lat},${p.lng}`)
    // 복리후생 아이콘: 상단 7칸 순서 그대로(칸 수가 다르면 읽지 않음)
    const icons = [...document.querySelectorAll('.jd2-header .jd2-benefits > .jd2-benefit')]
    const benefits = icons.length === order.length ? icons.flatMap((e, i) => (e.classList.contains('jd2-benefit--active') ? [order[i]] : [])) : []
    // 승인된 4영역(제목으로 찾음): 영역별 글자. 글자 조각 사이를 공백으로 이어 붙은 낱말이 생기지 않게 한다.
    const titles = { '①': 'Điều kiện làm việc', '②': 'Thông tin tuyển dụng', '③': 'Khu vực làm việc', '④': 'Mô tả công việc' }
    const areas = {}
    for (const sec of document.querySelectorAll('.jd2-page section.jd2-sec')) {
      const key = Object.keys(titles).find((k) => titles[k] === sec.querySelector(':scope > h2')?.textContent?.trim())
      if (!key) continue
      const w = document.createTreeWalker(sec, NodeFilter.SHOW_TEXT); const parts = []
      while (w.nextNode()) parts.push(w.currentNode.textContent)
      areas[key] = (areas[key] ?? '') + '\n' + parts.join(' ')
    }
    return {
      areas,
      device, title: txt('h1.jd2-header__title') ?? txt('h1') ?? '', company: txt('.jd2-header__company'), salary: txt('.jd2-hl-salary__val'),
      mapLinks: [...new Set(hrefs('a[href*="google.com/maps"]'))],
      pins: [...new Set(pins)],
      tel: [...new Set(hrefs('a[href^="tel:"]').map((h) => h.slice(4)))],
      zalo: [...new Set(hrefs('a[href*="zalo.me"]').map((h) => (/zalo\.me\/(\+?\d+)/.exec(h) ?? [])[1]).filter(Boolean))],
      benefits,
    }
  }, { device, order: [...BENEFIT_ORDER] })
}

/**
 * 목록·메인 카드 수집(R2 잔여 검증): 상세 화면만 보던 화면 대조가 카드(공고 목록)에 나오는 값은 확인하지 못했다.
 * 여러 목록 화면을 끝까지 내려 `article.jc[data-job-id]` 카드의 상호·제목·급여 글자를 번호별로 모은다(먼저 모은 값을 유지).
 * 화면마다 따로 돌려준다(배열 항목 하나 = 화면 하나, 못 읽은 화면은 null) — 한 화면 값이 다른 화면 값을 가리지 않게.
 * 못 찾은 공고·못 읽은 화면은 호출자가 '카드 미검증'으로 다룬다(통과로 세지 않음).
 */
export async function collectCards(page, base, paths = ['/', '/viec-lam/tim-kiem?pageSize=100']) {
  const routes = []
  for (const path of paths) {
    const cards = {}
    routes.push(cards)
    try {
      await page.goto(base + path, { waitUntil: 'domcontentloaded', timeout: 60_000 })
      await page.locator('article.jc[data-job-id]').first().waitFor({ timeout: 30_000 })
      // 검색 목록은 페이지가 나뉘어 있어(Sau → 버튼) 마지막 페이지까지 넘기며 모은다(메인은 버튼이 없어 한 번).
      for (let pg = 0; pg < 50; pg++) {
        let last = -1
        for (let i = 0; i < 30; i++) {
          const n = await page.locator('article.jc[data-job-id]').count()
          if (n === last) break
          last = n
          await page.evaluate(() => window.scrollTo(0, document.body.scrollHeight))
          await page.waitForTimeout(700)
        }
        const got = await page.evaluate(() => Object.fromEntries([...document.querySelectorAll('article.jc[data-job-id]')].map((el) => [
          String(el.getAttribute('data-job-id')).replace(/^sb-/, ''),
          { title: el.querySelector('.jc__title')?.textContent?.trim() ?? '', company: el.querySelector('.jc__company')?.textContent?.trim() ?? '', salary: el.querySelector('.jc__salary')?.textContent?.trim() ?? '' }])))
        Object.assign(cards, got)
        const next = page.locator('button:has-text("Sau →")')
        if (!(await next.count()) || !(await next.first().isEnabled())) break
        const firstId = await page.locator('article.jc[data-job-id]').first().getAttribute('data-job-id')
        await next.first().click()
        await page.waitForFunction((id) => document.querySelector('article.jc[data-job-id]')?.getAttribute('data-job-id') !== id, firstId, { timeout: 15_000 })
      }
    } catch { routes[routes.length - 1] = null /* 이 목록 화면을 못 읽음 — 호출자가 미검증으로 기록 */ }
  }
  return routes
}
