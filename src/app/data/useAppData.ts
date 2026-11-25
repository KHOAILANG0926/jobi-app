import { useCallback, useEffect, useMemo, useState } from 'react'
import { useAuth } from '../../context/AuthContext'
import { useJobs } from '../../context/JobsContext'
import { loadApplications } from '../../lib/applicationsStorage'
import { loadSavedJobIds, toggleSavedJobId } from '../../lib/storage'
import type { Job } from '../../types/job'
import { useAppFilters } from '../filters/AppFilters'
import type { AppJobAreas } from '../filters/applyFilters'

/** 공고 주소 → 성·동 판정(웹 급구/지역 목록과 같은 lib/jobAreaWards). 지역 조건이 걸렸을 때만 계산한다 — 성·동 자료(수천 개)와
 *  판정 코드는 그때 처음 불러와서, 홈 첫 화면은 그 무게를 지지 않는다. */
const NO_AREAS: AppJobAreas = new Map()
export function useJobAreas(jobs: Job[], needed: boolean): AppJobAreas {
  const [resolve, setResolve] = useState<((j: Job) => ReturnType<typeof import('../../lib/jobAreaWards').resolveJobArea>) | null>(null)
  useEffect(() => {
    if (!needed || resolve) return
    let alive = true
    import('../../lib/jobAreaWards').then(async (m) => {
      try { const old = await import('../../data/vnOldWards'); m.setOldWardData(old.VN_OLD_WARDS_BY_PROVINCE) } catch { /* 옛 동 자료는 없어도 판정은 동작 */ }
      if (alive) setResolve(() => m.resolveJobArea)
    }).catch(() => {})
    return () => { alive = false }
  }, [needed, resolve])
  return useMemo(() => (needed && resolve ? new Map(jobs.map((j) => [j.id, resolve(j)])) : NO_AREAS), [jobs, needed, resolve])
}

/** 저장한 공고 번호 — 웹과 같은 저장소(lib/storage)와 같은 변경 알림 이벤트. */
export function useSavedJobIds() {
  const { user } = useAuth()
  const [ids, setIds] = useState<string[]>(() => loadSavedJobIds(user?.id))
  useEffect(() => {
    const sync = () => setIds(loadSavedJobIds(user?.id))
    sync()
    window.addEventListener('vgb:saved-jobs', sync)
    window.addEventListener('storage', sync)
    return () => { window.removeEventListener('vgb:saved-jobs', sync); window.removeEventListener('storage', sync) }
  }, [user?.id])
  const toggle = useCallback((id: string) => { toggleSavedJobId(id, user?.id); setIds(loadSavedJobIds(user?.id)) }, [user?.id])
  const set = useMemo(() => new Set(ids), [ids])
  return { ids, set, toggle }
}

/** 내가 지원한 공고 번호(로그인했을 때만). */
export function useAppliedJobIds(): Set<string> {
  const { user } = useAuth()
  const [ids, setIds] = useState<Set<string>>(new Set())
  useEffect(() => {
    if (!user?.id) { setIds(new Set()); return }
    let cancelled = false
    loadApplications().then((apps) => { if (!cancelled) setIds(new Set(apps.filter((a) => a.seekerId === user.id).map((a) => a.jobId))) }).catch(() => {})
    return () => { cancelled = true }
  }, [user?.id])
  return ids
}

export function useAppJobs() {
  const { jobs, loading, jobsError } = useJobs()
  const { filters } = useAppFilters()
  const areas = useJobAreas(jobs, filters.province !== null)
  // 지역 판정 자료가 아직 로딩 중이면(지역 조건이 막 걸린 순간) 빈 판정으로 전부 걸러 내지 않도록 목록 화면이 areasReady를 본다.
  return { jobs, loading, jobsError, areas, areasReady: filters.province === null || areas.size > 0 || jobs.length === 0 }
}
