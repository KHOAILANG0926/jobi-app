import { assignRepresentativeImages } from '../scripts/ocr/assign-image.mjs'

// 대표 이미지 고정 배정 실행기 시험(2026-11-27 Lee): 새 공고에 같은 단계 후보 중 가장 적게 쓰인 이미지를 순서대로 배정하고, 한 번 정해진 번호는 이미지가 추가돼도 바뀌지 않는다.
const eq = (a: unknown, b: unknown, note: string) => { if (JSON.stringify(a) !== JSON.stringify(b)) throw new Error(`${note}: ${JSON.stringify(a)} !== ${JSON.stringify(b)}`) }
type Row = { id: number; title: string; company: string; category: string; subcategory: string | null; occupation_code: string | null; description: string; representative_image_id: string | null }
function fakeClient(rows: Row[]) {
  const updates: Array<[number, string]> = []
  return {
    updates,
    async query(sql: string, params: unknown[] = []) {
      if (sql.includes('group by 1')) {
        const counts = new Map<string, number>()
        for (const r of rows) if (r.representative_image_id) counts.set(r.representative_image_id, (counts.get(r.representative_image_id) ?? 0) + 1)
        return { rows: [...counts].map(([id, n]) => ({ id, n })) }
      }
      if (sql.includes('select id, title')) return { rows: rows.filter((r) => !r.representative_image_id) }
      if (sql.includes('update public.local_jobs')) {
        const row = rows.find((r) => r.id === params[0] && !r.representative_image_id)
        if (!row) return { rowCount: 0, rows: [] }
        row.representative_image_id = String(params[1]); updates.push([row.id, row.representative_image_id]); return { rowCount: 1, rows: [] }
      }
      throw new Error('unexpected sql: ' + sql.slice(0, 60))
    },
  }
}
const manifest = {
  groups: { dich_vu: { fallback: 'neutral' as const } },
  images: [
    { id: 'g-guard-001', file: '/a.jpg', group: 'dich_vu', roles: ['540'], env: null, kind: 'ai', origin: 'test' },
    { id: 'g-guard-002', file: '/b.jpg', group: 'dich_vu', roles: ['540'], env: null, kind: 'ai', origin: 'test' },
    { id: 'g-guard-003', file: '/c.jpg', group: 'dich_vu', roles: ['540'], env: null, kind: 'ai', origin: 'test' },
  ],
}
const guard = (id: number): Row => ({ id, title: 'Tuyển nhân viên bảo vệ', company: 'Công ty Bảo vệ ' + id, category: 'dich_vu', subcategory: null, occupation_code: '540', description: 'Công việc\nNhân viên bảo vệ', representative_image_id: null })
const other = (id: number): Row => ({ id, title: 'Tuyển nhân viên văn phòng', company: 'Công ty ' + id, category: 'van_phong', subcategory: null, occupation_code: '4110', description: 'Công việc\nNhập liệu', representative_image_id: null })
const rows = [guard(1), guard(2), guard(3), guard(4), other(5)]
const client = fakeClient(rows)
const quiet = () => {}
const r1 = await assignRepresentativeImages(client, { manifest, log: quiet })
// 순차 배정: 가장 적게 쓰인 이미지를 목록 순서대로 → 001, 002, 003, 001. 목록에 없는 업종(van_phong)은 배정하지 않는다(화면이 기존 선택 그대로).
eq(client.updates, [[1, 'g-guard-001'], [2, 'g-guard-002'], [3, 'g-guard-003'], [4, 'g-guard-001']], 'sequential assignment')
eq(r1, { targets: 5, assigned: 4 }, 'counts')
// 고정: 다시 돌려도(대상은 아직 없는 공고뿐) 이미 정해진 번호는 그대로, 이미지가 추가돼도 기존 배정은 바뀌지 않는다.
const more = { ...manifest, images: [{ id: 'g-guard-000', file: '/z.jpg', group: 'dich_vu', roles: ['540'], env: null, kind: 'ai', origin: 'test' }, ...manifest.images] }
const r2 = await assignRepresentativeImages(client, { manifest: more, log: quiet })
eq(r2, { targets: 1, assigned: 0 }, 'only unassigned jobs are targets, other group stays unassigned')
eq(rows.slice(0, 4).map((r) => r.representative_image_id), ['g-guard-001', 'g-guard-002', 'g-guard-003', 'g-guard-001'], 'existing assignments never change')
// 새 공고는 새로 추가된 이미지(가장 적게 쓰임)부터.
rows.push(guard(6))
await assignRepresentativeImages(client, { manifest: more, log: quiet })
eq(rows[5].representative_image_id, 'g-guard-000', 'new job takes the least used (newly added) image')
console.log('assign-image: sequential, fixed and add-safe assignment checks passed')
