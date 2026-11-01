// 2026-11-01: 화면 브랜드 업종 30개와 DB 검사 값이 같아야 한다(공장 없음)
import { readFileSync as _rf } from 'node:fs'
import { BRAND_CATEGORY_IDS as _ids } from '../src/data/brandDirectory.ts'
{
  const sql = _rf(new URL('../supabase/migrations/20261101220000_brand_categories_30.sql', import.meta.url), 'utf8')
  const dbIds = [...sql.matchAll(/'([a-z_]+)'/g)].map((m) => m[1]).filter((x) => x !== 'brand')
  if (_ids.length !== 30 || JSON.stringify([...new Set(dbIds)].sort()) !== JSON.stringify([..._ids].sort())) throw new Error('brand categories UI≠DB')
  if (_ids.some((x) => /factory|kcn|nha_may/.test(x))) throw new Error('factories are not brands')
  console.log('brand categories: 30 UI = DB')
}
