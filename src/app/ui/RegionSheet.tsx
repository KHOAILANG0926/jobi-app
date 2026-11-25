import { useMemo, useState } from 'react'
import { Check, Search } from 'lucide-react'
import { VN_DISTRICTS_BY_PROVINCE, VN_WARDS_BY_DISTRICT } from '../../data/vnDistricts'
import { VN_PROVINCES } from '../../data/vnProvinces'
import { normalizeViText } from '../../lib/jobCoords'
import BottomSheet from './BottomSheet'

// 지역 선택 시트(V3 시안) — 모든 지역 진입(상단 지역 버튼·바로가기 Khu vực·필터 시트·메뉴)이 이 시트 하나를 쓴다.
// 필터는 웹 지역 목록과 같이 성/시 + 동·사(wards)로 걸린다. 구/현을 고르면 그 구/현의 동·사를 모두 고른 것으로 본다.
export function shortProvince(name: string): string { return name.replace(/^(Tỉnh|Thành phố)\s+/, '') }

export default function RegionSheet({ province, wards, onApply, onClose }: { province: string | null; wards: string[]; onApply: (province: string | null, wards: string[]) => void; onClose: () => void }) {
  const [prov, setProv] = useState<string | null>(province)
  const [picked, setPicked] = useState<string[]>(wards)
  const [q, setQ] = useState('')
  const provinces = useMemo(() => {
    const n = normalizeViText(q)
    return VN_PROVINCES.filter((p) => !n || normalizeViText(p).includes(n))
  }, [q])
  const districts = prov ? VN_DISTRICTS_BY_PROVINCE[prov] ?? [] : []
  const wardsOf = (d: string) => (prov ? VN_WARDS_BY_DISTRICT[prov]?.[d] ?? [] : [])
  const isOn = (d: string) => { const w = wardsOf(d); return w.length > 0 && w.every((x) => picked.includes(x)) }
  const toggle = (d: string) => {
    const w = wardsOf(d)
    setPicked((cur) => isOn(d) ? cur.filter((x) => !w.includes(x)) : [...new Set([...cur, ...w])])
  }
  const choose = (p: string) => { setProv(p === prov ? null : p); setPicked([]) }
  const count = districts.filter(isOn).length
  return (
    <BottomSheet title="Chọn khu vực làm việc" onClose={onClose}
      footer={<button type="button" className="app-btn app-btn--primary" onClick={() => { onApply(prov, picked); onClose() }}>{prov ? `Áp dụng${count ? ` (${count})` : ''}` : 'Xem tất cả khu vực'}</button>}>
      <label className="app-search-field"><Search size={18} aria-hidden /><input type="search" placeholder="Nhập tên tỉnh, thành phố" value={q} onChange={(e) => setQ(e.target.value)} aria-label="Tìm tỉnh, thành phố" /></label>
      <div className="app-chip-row app-chip-row--bleed" role="group" aria-label="Tỉnh / Thành phố">
        {provinces.map((p) => <button key={p} type="button" className={'app-chip' + (p === prov ? ' app-on' : '')} aria-pressed={p === prov} onClick={() => choose(p)}>{shortProvince(p)}</button>)}
      </div>
      {prov && (
        <ul className="app-check-list" aria-label={`Quận / Huyện — ${shortProvince(prov)}`}>
          <li><button type="button" className="app-check-row" onClick={() => setPicked([])}><span>Tất cả {shortProvince(prov)}</span><span className={'app-check' + (picked.length === 0 ? ' app-on' : '')}>{picked.length === 0 && <Check size={14} aria-hidden />}</span></button></li>
          {districts.map((d) => <li key={d}><button type="button" className="app-check-row" onClick={() => toggle(d)}><span>{d}</span><span className={'app-check' + (isOn(d) ? ' app-on' : '')}>{isOn(d) && <Check size={14} aria-hidden />}</span></button></li>)}
        </ul>
      )}
    </BottomSheet>
  )
}
