/**
 * 카드용 짧은 위치 — 2026-11-01 Lee(알바몬 "쿠팡CLS · 경기 수원시"): 번지·도로는 빼고 동/구·성까지만.
 * 원문 주소 글자만 쓴다(새 지명을 만들지 않음). 남는 게 없으면 원래 주소를 그대로 돌려준다(카드에서 한 줄로 잘림).
 */
export function shortArea(location: string | null | undefined): string {
  const raw = String(location ?? '').replace(/\([^)]*\)/g, ' ').trim()
  if (!raw) return ''
  const parts = raw.split(/\s*[,–—]\s*|\s+-\s+|-\s*(?=(?:p\.?|phường|xã|tp\.?|tỉnh|thành phố)\s)/iu).map((p) => p.trim()).filter(Boolean)
  const kept: string[] = []
  for (const p of parts) {
    if (/\d/.test(p) && !/^(?:kcn|khu công nghiệp)\b/iu.test(p) && !/\b(?:iii|ii|iv|v)\b/i.test(p)) continue   // 번지·도로(숫자) 제외, 공단 이름은 유지
    const key = p.toLocaleLowerCase('vi').replace(/^(?:tỉnh|tp\.?|thành phố|phường|p\.|xã)\s*/u, '')
    if (kept.some((k) => k.toLocaleLowerCase('vi').replace(/^(?:tỉnh|tp\.?|thành phố|phường|p\.|xã)\s*/u, '') === key)) continue
    kept.push(p)
  }
  return kept.length ? kept.slice(-2).join(', ') : raw
}
