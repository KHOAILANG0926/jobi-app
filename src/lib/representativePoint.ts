// 메인 지도와 공고 상세가 같은 대략 위치를 쓰게 한다(2026-10-20 Lee: "핀하고 상세공고 핀 위치가 안 맞는다 — 큰 문제").
// 메인 지도와 똑같이 /api/map-locations(위치 찾기 결과: 공단 입구·공단·동 중심)를 읽는다. 위치는 한 곳(DB)에서만 정한다.
import { useEffect, useState } from 'react'

export interface RepresentativePoint { kind: 'gate' | 'area'; lat: number; lng: number; source: string }

export function numericJobId(jobId: string | null | undefined): number | null {
  const m = String(jobId ?? '').match(/^(?:sb-)?(\d+)$/)
  return m ? Number(m[1]) : null
}

export function useRepresentativePoint(jobId: string | null | undefined): RepresentativePoint | null {
  const id = numericJobId(jobId)
  const [state, setState] = useState<{ id: number; point: RepresentativePoint | null } | null>(null)
  useEffect(() => {
    if (id == null) return
    let alive = true
    fetch(`/api/map-locations?ids=${id}`)
      .then((r) => (r.ok ? r.json() : null))
      .then((j) => {
        const p = j?.points?.[`sb-${id}`]
        const ok = p && (p.kind === 'gate' || p.kind === 'area') && Number.isFinite(p.lat) && Number.isFinite(p.lng)
        if (alive) setState({ id, point: ok ? { kind: p.kind, lat: p.lat, lng: p.lng, source: String(p.source ?? '') } : null })
      })
      .catch(() => { if (alive) setState({ id, point: null }) })
    return () => { alive = false }
  }, [id])
  return state && state.id === id ? state.point : null
}
