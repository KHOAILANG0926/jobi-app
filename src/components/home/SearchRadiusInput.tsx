import { useEffect, useState } from 'react'
import { RADIUS_MAX_KM, RADIUS_MIN_KM } from '../../lib/homeMapFilters'
import { normalizeSearchRadius } from '../../lib/homeMapSearch'

export default function SearchRadiusInput({ value, onChange }: { value: number; onChange: (km: number) => void }) {
  const [draft, setDraft] = useState(String(Math.round(value * 1000)))
  useEffect(() => { setDraft(String(Math.round(value * 1000))) }, [value])
  const apply = () => {
    const parsed = Number(draft.trim().replace(',', '.'))
    if (!draft.trim() || !Number.isFinite(parsed)) { setDraft(String(Math.round(value * 1000))); return }
    const km = normalizeSearchRadius(parsed / 1000)
    setDraft(String(Math.round(km * 1000)))
    onChange(km)
  }
  return <label style={{ display: 'inline-flex', alignItems: 'center', gap: 5, fontWeight: 700 }}>
    <input type="number" inputMode="numeric" min={RADIUS_MIN_KM * 1000} max={RADIUS_MAX_KM * 1000} step="100"
      aria-label="Nhập bán kính (m)" title="100–20000 m · Nhấn Enter để áp dụng"
      value={draft} onChange={e => setDraft(e.target.value)} onBlur={apply}
      onKeyDown={e => { if (e.key === 'Enter') { e.preventDefault(); e.currentTarget.blur() } }}
      style={{ width: 76, padding: '5px 6px', border: '1px solid #d0d5dd', borderRadius: 6, font: 'inherit', textAlign: 'right' }} />
    <span>m</span>
  </label>
}
