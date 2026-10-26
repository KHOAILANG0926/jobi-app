import { pathToFileURL } from 'node:url'
import { readFileSync } from 'node:fs'

const labels = {
  confirmed_memory_differs_from_source: '확정 기억과 원본 다름',
  stale_confirmation_on_source: '취소되거나 변경된 확정이 원본에 남음',
  map_cache_differs_from_source: '지도 캐시와 원본 다름',
  invalid_source_point: '원본 좌표의 범위·정확도·근거 누락',
}

export function renderLocationIntegrityReport(rows) {
  if (!Array.isArray(rows)) throw new Error('위치 불일치 조회 결과가 배열이 아님')
  const groups = new Map()
  for (const row of rows) {
    if (typeof row.issue !== 'string' || !/^[a-z_]+$/.test(row.issue) ||
        !/^\d+$/.test(String(row.job_id))) throw new Error('위치 불일치 조회 결과 형식 오류')
    const jobs = groups.get(row.issue) ?? new Set()
    jobs.add(String(row.job_id))
    groups.set(row.issue, jobs)
  }
  const lines = [`위치 원본·지도 불일치 ${rows.length}건`]
  for (const [issue, jobs] of [...groups].sort(([a], [b]) => a.localeCompare(b))) {
    lines.push(`- ${labels[issue] ?? issue}: ${jobs.size}개 공고 — ${[...jobs]
      .sort((a, b) => Number(a) - Number(b))
      .map(id => `[${id}](https://viecganban.vn/viec-lam/sb-${id})`).join(', ')}`)
  }
  return lines.join('\n')
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  console.log(renderLocationIntegrityReport(JSON.parse(readFileSync(0, 'utf8'))))
}
