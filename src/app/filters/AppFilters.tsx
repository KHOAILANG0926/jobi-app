import { createContext, useCallback, useContext, useMemo, useState, type ReactNode } from 'react'
import { activeFilterCount, EMPTY_APP_FILTERS, type AppFilterState } from './applyFilters'
import { kvLocal } from '../../lib/kvStore'

// 앱 전체가 공유하는 필터 상태 1개 — 홈·검색 결과·목록·지도의 칩 줄, 지도 빠른 칩, 필터 시트가 모두 이 상태를 읽고 쓴다(별도 상태 금지).
const REGION_KEY = 'vgb:app:region'

function loadRegion(): Pick<AppFilterState, 'province' | 'wards'> {
  try {
    const raw = kvLocal.get(REGION_KEY)
    if (!raw) return { province: null, wards: [] }
    const v = JSON.parse(raw) as { province?: unknown; wards?: unknown }
    return { province: typeof v.province === 'string' ? v.province : null, wards: Array.isArray(v.wards) ? v.wards.filter((w): w is string => typeof w === 'string') : [] }
  } catch { return { province: null, wards: [] } }
}

function saveRegion(f: Pick<AppFilterState, 'province' | 'wards'>) {
  try { kvLocal.set(REGION_KEY, JSON.stringify({ province: f.province, wards: f.wards })) } catch { /* 저장 못 해도 화면은 동작 */ }
}

interface AppFiltersValue {
  filters: AppFilterState
  count: number
  setFilters: (next: AppFilterState) => void
  patch: (p: Partial<AppFilterState>) => void
  reset: () => void
}

const Ctx = createContext<AppFiltersValue | null>(null)

export function AppFiltersProvider({ children }: { children: ReactNode }) {
  const [filters, setState] = useState<AppFilterState>(() => ({ ...EMPTY_APP_FILTERS, ...loadRegion() }))
  const setFilters = useCallback((next: AppFilterState) => { setState(next); saveRegion(next) }, [])
  const patch = useCallback((p: Partial<AppFilterState>) => setState((cur) => { const next = { ...cur, ...p }; saveRegion(next); return next }), [])
  const reset = useCallback(() => setState((cur) => { const next = { ...EMPTY_APP_FILTERS, province: cur.province, wards: cur.wards }; return next }), [])
  const value = useMemo(() => ({ filters, count: activeFilterCount(filters), setFilters, patch, reset }), [filters, setFilters, patch, reset])
  return <Ctx.Provider value={value}>{children}</Ctx.Provider>
}

export function useAppFilters(): AppFiltersValue {
  const v = useContext(Ctx)
  if (!v) throw new Error('useAppFilters must be used inside AppFiltersProvider')
  return v
}
