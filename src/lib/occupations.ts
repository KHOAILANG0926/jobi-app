// 공식 직업분류(QĐ 34/2020/QĐ-TTg) 화면용 도우미. 이름은 DB occupation_master(공개 읽기)에서만 가져온다 —
// 화면에서 직업명·코드를 따로 만들지 않는다.
import { useEffect, useState } from 'react'
import { supabase } from './supabase'
export { occupationGroupCode, occupationGroupsInJobs, matchesOccupationGroups } from './occupationGroups'
export type { OccupationGroupCount } from './occupationGroups'

interface NamesClient {
  from: (table: string) => {
    select: (cols: string) => { in: (col: string, values: string[]) => PromiseLike<{ data: { code: string; name_vi: string }[] | null; error: unknown }> }
  }
}

const nameCache = new Map<string, string>()

/** occupation_master에서 코드 → 공식 베트남어 직업명. 실패하면 빈 결과(화면은 이름 없이 동작). */
export async function fetchOccupationNames(codes: string[], client: NamesClient = supabase as unknown as NamesClient): Promise<Map<string, string>> {
  const wanted = [...new Set(codes.filter((c) => /^\d{1,5}$/.test(c)))]
  const missing = wanted.filter((c) => !nameCache.has(c))
  if (missing.length > 0) {
    const { data, error } = await client.from('occupation_master').select('code,name_vi').in('code', missing)
    if (error) console.error('fetchOccupationNames failed', error)
    for (const row of data ?? []) nameCache.set(row.code, row.name_vi)
  }
  return new Map(wanted.filter((c) => nameCache.has(c)).map((c) => [c, nameCache.get(c) as string]))
}

/** React용: 주어진 코드들의 공식 직업명. */
export function useOccupationNames(codes: string[]): Map<string, string> {
  const key = [...new Set(codes)].sort().join(',')
  const [names, setNames] = useState<Map<string, string>>(new Map())
  useEffect(() => {
    if (!key) { setNames(new Map()); return }
    let alive = true
    fetchOccupationNames(key.split(',')).then((m) => { if (alive) setNames(m) })
    return () => { alive = false }
  }, [key])
  return names
}
