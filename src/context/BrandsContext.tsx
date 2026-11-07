import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from 'react'
import { supabase } from '../lib/supabase'
import { assembleBrands } from '../lib/brandRows'
import type { BrandDefinition } from '../data/brandDirectory'

/**
 * 2026-09-10: brandDirectory.ts의 하드코딩 BRAND_DIRECTORY를 대체 — 관리자가
 * 승인한 브랜드(job_brands/job_brand_aliases, active=true만 공개 RLS로 조회됨)를
 * JobsProvider와 동일한 "앱 시작 시 한 번 fetch, 세션 동안 메모리 보관" 패턴으로
 * 제공한다. computeBrandCounts/groupBrandsByCategory는 여전히 순수 함수로 남고,
 * 이 Context는 그 함수들이 소비할 BrandDefinition[]만 공급한다.
 */
interface BrandsContextValue {
  brands: BrandDefinition[]
  loading: boolean
  refreshBrands: () => Promise<void>
}

export const BrandsContext = createContext<BrandsContextValue | null>(null)

export function BrandsProvider({ children }: { children: ReactNode }) {
  const [brands, setBrands] = useState<BrandDefinition[]>([])
  const [loading, setLoading] = useState(true)

  const fetchBrands = useCallback(async () => {
    setLoading(true)
    const { data: brandRows } = await supabase
      .from('job_brands')
      .select('id,name,slug,category,domain,logo_url,initial,color,active,featured')
      .eq('active', true)
    const rows = brandRows ?? []
    if (rows.length === 0) {
      setBrands([])
      setLoading(false)
      return
    }
    const brandIds = rows.map((r) => r.id as number)
    const { data: aliasRows } = await supabase
      .from('job_brand_aliases')
      .select('brand_id,alias,is_primary')
      .in('brand_id', brandIds)
      .eq('active', true)
    const assembled = assembleBrands(rows, aliasRows ?? [])
    setBrands(assembled)
    setLoading(false)
  }, [])

  useEffect(() => { fetchBrands() }, [fetchBrands])

  const refreshBrands = useCallback(async () => { await fetchBrands() }, [fetchBrands])

  const value = useMemo(() => ({ brands, loading, refreshBrands }), [brands, loading, refreshBrands])

  return <BrandsContext.Provider value={value}>{children}</BrandsContext.Provider>
}

export function useBrands() {
  const ctx = useContext(BrandsContext)
  if (!ctx) throw new Error('useBrands must be used within BrandsProvider')
  return ctx
}

/** 브랜드 목록(제공자 밖에서는 빈 목록) — 공고 카드·상세처럼 시험에서 제공자 없이도 그려지는 곳용(2026-11-01 브랜드 로고 수평 전개). */
export function useBrandsOptional(): BrandDefinition[] {
  return useContext(BrandsContext)?.brands ?? []
}
