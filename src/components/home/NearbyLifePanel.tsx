// 선택 공고/선택 장소 주변 생활환경 (2026-10-05). 지도에 실제 로드된 VietMap POI만 센다.
// 데이터가 없으면 0(—)으로 두고 추정하지 않는다.
import { useState, type ReactNode } from 'react'
import { Building2 } from 'lucide-react'
import type { NearbyState } from './map/HomeMapTypes'
import { FACILITY_CATEGORIES, NEARBY_RADII_M, formatMeters, type NearbyRadius, type NearbySummary } from '../../lib/nearbyFacilities'

const KIND_DOT: Record<string, string> = {
  restaurant: '#f97316', convenience: '#a855f7', cafe: '#b45309', pharmacy: '#0ea5e9', clinic: '#ef4444',
  bus: '#1d4ed8', lodging: '#7c3aed', market: '#c026d3', bank: '#0f766e', workplace: '#334155',
}

/** 300/500 m 생활시설 수 · 가장 가까운 시설 · 주변 회사. */
export function NearbySummaryView({ summary, title, origin, footer }: {
  summary: NearbySummary
  title: string
  /** 거리 기준 문구(예: "nơi làm việc", "điểm đã chọn"). */
  origin: string
  footer?: ReactNode
}) {
  const [radius, setRadius] = useState<NearbyRadius>(500)
  const [showAllWork, setShowAllWork] = useState(false)
  const counts = summary.counts[radius]
  const total = FACILITY_CATEGORIES.reduce((s, c) => s + counts[c.key], 0)
  const nearestList = FACILITY_CATEGORIES.map((c) => ({ ...c, poi: summary.nearest[c.key] })).filter((c) => c.poi && c.poi.distanceM <= radius)
  const work = summary.workplaces.filter((w) => w.distanceM <= radius)
  const workShown = showAllWork ? work : work.slice(0, 5)

  return (
    <section className="hme-life" aria-label={title} data-testid="nearby-life" data-total={total} data-radius={radius}>
      <div className="hme-life__head">
        <h4 className="hme-life__title">{title}</h4>
        <div className="hme-life__radius" role="group" aria-label="Bán kính tiện ích">
          {NEARBY_RADII_M.map((r) => (
            <button key={r} type="button" aria-pressed={radius === r} className={radius === r ? 'is-active' : ''} onClick={() => setRadius(r)}>{r} m</button>
          ))}
        </div>
      </div>
      <p className="hme-life__lead"><strong>{total}</strong> tiện ích sinh hoạt trong {radius} m</p>
      <ul className="hme-life__grid">
        {FACILITY_CATEGORIES.map((c) => (
          <li key={c.key} className={counts[c.key] === 0 ? 'is-empty' : ''}>
            <span className="hme-life__dot" style={{ background: KIND_DOT[c.key] }} aria-hidden />
            <span className="hme-life__label">{c.label}</span>
            <strong>{counts[c.key] === 0 ? '—' : counts[c.key]}</strong>
          </li>
        ))}
      </ul>
      {nearestList.length > 0 && (
        <div className="hme-life__nearest">
          <div className="hme-life__sub">Gần nhất</div>
          <ul>
            {nearestList.map((c) => (
              <li key={c.key}>
                <span className="hme-life__dot" style={{ background: KIND_DOT[c.key] }} aria-hidden />
                <span className="hme-life__name" title={c.poi!.name}>{c.poi!.name}</span>
                <span className="hme-life__dist">{formatMeters(c.poi!.distanceM)}</span>
              </li>
            ))}
          </ul>
        </div>
      )}
      <div className="hme-life__work">
        <div className="hme-life__sub"><Building2 size={13} aria-hidden /> Công ty, nhà máy xung quanh ({work.length})</div>
        {work.length === 0 ? <p className="hme-life__note">Bản đồ chưa có công ty nào được ghi trong {radius} m.</p> : (
          <ul>
            {workShown.map((w) => (
              <li key={`${w.name}-${w.lat}-${w.lng}`}>
                <span className="hme-life__name" title={w.name}>{w.name}</span>
                <span className="hme-life__dist">{formatMeters(w.distanceM)}</span>
              </li>
            ))}
          </ul>
        )}
        {work.length > 5 && (
          <button type="button" className="hme-more-link" onClick={() => setShowAllWork((v) => !v)}>{showAllWork ? 'Thu gọn' : `Xem tất cả ${work.length}`}</button>
        )}
      </div>
      <p className="hme-life__note">Theo dữ liệu bản đồ VietMap, có thể chưa đầy đủ. Khoảng cách đường chim bay từ {origin}.</p>
      {footer}
    </section>
  )
}

export default function NearbyLifePanel({ state, jobId }: { state: NearbyState; jobId: string }) {
  if (state.status === 'unavailable') {
    return (
      <section className="hme-life" aria-label="Quanh nơi làm việc">
        <h4 className="hme-life__title">Quanh nơi làm việc</h4>
        <p className="hme-life__note">Bản đồ dự phòng hiện tại chưa hỗ trợ xem tiện ích xung quanh.</p>
      </section>
    )
  }
  if (state.status !== 'ready' || state.jobId !== jobId) {
    return (
      <section className="hme-life" aria-label="Quanh nơi làm việc" aria-busy="true">
        <h4 className="hme-life__title">Quanh nơi làm việc</h4>
        <p className="hme-life__note">Đang tải tiện ích xung quanh trên bản đồ…</p>
      </section>
    )
  }
  return (
    <NearbySummaryView
      summary={state.summary}
      title="Quanh nơi làm việc"
      origin="nơi làm việc"
      footer={state.partialRadiusM !== null && <p className="hme-life__note">Một phần bán kính {state.partialRadiusM} m nằm ngoài khung bản đồ nên có thể chưa tính hết.</p>}
    />
  )
}
