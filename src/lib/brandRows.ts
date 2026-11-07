// 브랜드 표 행(job_brands·job_brand_aliases) → 화면이 쓰는 브랜드 목록. 화면(BrandsContext)과 서버(로고 찾기)가 같이 쓴다.
import type { BrandDefinition } from '../data/brandDirectory'

export function assembleBrands(rows: Record<string, unknown>[], aliasRows: Record<string, unknown>[]): BrandDefinition[] {
  const aliasesByBrand = new Map<number, { alias: string; isPrimary: boolean }[]>()
  for (const a of aliasRows) {
    const brandId = a.brand_id as number
    const list = aliasesByBrand.get(brandId) ?? []
    list.push({ alias: a.alias as string, isPrimary: (a.is_primary as boolean) ?? false })
    aliasesByBrand.set(brandId, list)
  }
  return rows
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
        logoUrl: (r.logo_url as string | null) ?? undefined,
        initial: r.initial as string,
        color: r.color as string,
        featured: (r.featured as boolean) ?? false,
      }
    })
    .filter((b): b is BrandDefinition => b !== null)
}
