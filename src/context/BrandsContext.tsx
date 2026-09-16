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

const BrandsContext = createContext<BrandsContextValue | null>(null)

export function BrandsProvider({ children }: { children: ReactNode }) {
  const [brands, setBrands] = useState<BrandDefinition[]>([])
  const [loading, setLoading] = useState(true)

  const fetchBrands = useCallback(async () => {
    setLoading(true)
    const { data: brandRows } = await supabase
      .from('job_brands')
      .select('id,name,slug,category,domain,initial,color,active,featured')
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
    const aliasesByBrand = new Map<number, { alias: string; isPrimary: boolean }[]>()
    for (const a of aliasRows ?? []) {
      const brandId = a.brand_id as number
      const list = aliasesByBrand.get(brandId) ?? []
      list.push({ alias: a.alias as string, isPrimary: (a.is_primary as boolean) ?? false })
      aliasesByBrand.set(brandId, list)
    }
    const assembled: BrandDefinition[] = rows
      .map((r): BrandDefinition | null => {
        const aliasList = aliasesByBrand.get(r.id as number) ?? []
        if (aliasList.length === 0) return null
        const primary = aliasList.find((a) => a.isPrimary) ?? aliasList[0]
        return {
          id: r.id as number,
          name: r.name as string,
          matchKeys: aliasList.map((a) => a.alias),
          category: r.category as BrandDefinition['category'],
          linkTo: primary.alias,
          domain: (r.domain as string | null) ?? undefined,
          initial: r.initial as string,
          color: r.color as string,
          featured: (r.featured as boolean) ?? false,
        }
      })
      .filter((b): b is BrandDefinition => b !== null)
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
