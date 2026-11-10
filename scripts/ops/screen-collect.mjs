// 화면 대조 검사(#646) 수집기 — 열린 상세 화면에서 보이는 값을 모은다(판정은 src/lib/screenAudit.ts).
// 상세 화면 읽기(scripts/ops/detail-read.mjs)와 공고 미리보기 화면 검사(scripts/layout/job-preview-check.mjs)가 같이 쓴다.
import { BENEFIT_ORDER } from '../../src/lib/screenAudit.ts'

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
    return {
      device, title: txt('h1.jd2-header__title') ?? txt('h1') ?? '', company: txt('.jd2-header__company'), salary: txt('.jd2-hl-salary__val'),
      mapLinks: [...new Set(hrefs('a[href*="google.com/maps"]'))],
      pins: [...new Set(pins)],
      tel: [...new Set(hrefs('a[href^="tel:"]').map((h) => h.slice(4)))],
      zalo: [...new Set(hrefs('a[href*="zalo.me"]').map((h) => (/zalo\.me\/(\+?\d+)/.exec(h) ?? [])[1]).filter(Boolean))],
      benefits,
    }
  }, { device, order: [...BENEFIT_ORDER] })
}
