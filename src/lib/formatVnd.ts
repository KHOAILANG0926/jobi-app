/** Format integer VND with Vietnamese grouping (e.g. 3.200.000 đ/tháng). */
export function formatVnd(amount: number, suffix = 'đ'): string {
  if (!Number.isFinite(amount) || amount < 0) return `0 ${suffix}`
  const rounded = Math.round(amount)
  const s = String(rounded)
  const withDots = s.replace(/\B(?=(\d{3})+(?!\d))/g, '.')
  return `${withDots} ${suffix}`.trim()
}
