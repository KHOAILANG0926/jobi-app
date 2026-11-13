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
export const SCREEN_CANDIDATES = `j.origin in ('crawler','admin') and ${afterCutoff('j')} and not j.active and not j.admin_hidden and (
  (j.ocr_check->'inspect'->>'screen_wait' = 'true' and j.ocr_check->'inspect'->>'content_hash' = ${H}
    and (j.ocr_check->'screen_audit'->>'content_hash') is distinct from ${H})
  or (j.ocr_check->'screen_audit'->>'content_hash' = ${H} and (j.ocr_check->'screen_audit'->>'ok') = 'false'
    and (j.ocr_check->'screen_audit'->>'checked_at')::timestamptz < now() - interval '3 hours'))`

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
