import { useEffect, useState } from 'react'
import { RADIUS_MAX_KM, RADIUS_MIN_KM } from '../../lib/homeMapFilters'
import { normalizeSearchRadius } from '../../lib/homeMapSearch'

export default function SearchRadiusInput({ value, onChange }: { value: number; onChange: (km: number) => void }) {
  const [draft, setDraft] = useState(String(value))
  useEffect(() => { setDraft(String(value)) }, [value])
  const apply = () => {
    const parsed = Number(draft.trim().replace(',', '.'))
    if (!draft.trim() || !Number.isFinite(parsed)) { setDraft(String(value)); return }
    const km = normalizeSearchRadius(parsed)
    setDraft(String(km))
    onChange(km)
  }
  return <label style={{ display: 'inline-flex', alignItems: 'center', gap: 5, fontWeight: 700 }}>
    <input type="number" inputMode="decimal" min={RADIUS_MIN_KM} max={RADIUS_MAX_KM} step="0.1"
      aria-label="Nhập bán kính (km)" title="0,1–20 km · Nhấn Enter để áp dụng"
      value={draft} onChange={e => setDraft(e.target.value)} onBlur={apply}
      onKeyDown={e => { if (e.key === 'Enter') { e.preventDefault(); e.currentTarget.blur() } }}
      style={{ width: 76, padding: '5px 6px', border: '1px solid #d0d5dd', borderRadius: 6, font: 'inherit', textAlign: 'right' }} />
    <span>km</span>
  </label>
}
