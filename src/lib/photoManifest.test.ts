import { ENV_KEYS, selectManaged, managedPhoto, type ManagedImage } from './cardPhoto.ts'
import manifest from '../../data/industry-photos/manifest.json' with { type: 'json' }
import sources from '../../data/industry-photos/SOURCES.json' with { type: 'json' }
import codes from '../../data/occupations/34-2020/occupation_codes.json' with { type: 'json' }

// 대표 이미지 목록 무결성(2026-11-27 Lee): 이미지를 목록에 추가만 해도 안전하게 쓰이도록 — 번호 중복 금지·공식 직업코드·근무환경 낱말·출처/라이선스 보존. 파일 존재·크기 상한은 api/_photo-manifest-files.test.ts(파일 시스템).
const eq = (a: unknown, b: unknown, note: string) => { if (JSON.stringify(a) !== JSON.stringify(b)) throw new Error(`${note}: ${JSON.stringify(a)} !== ${JSON.stringify(b)}`) }
const ok = (v: unknown, note: string) => { if (!v) throw new Error(note) }
const images = (manifest as unknown as { images: ManagedImage[] }).images
const validCodes = new Set((codes as Array<{ code: string }>).map((c) => String(c.code)))
const CATEGORIES = ['am_thuc_do_uong', 'quan_ly_ban_hang', 'dich_vu', 'van_phong', 'cskh_kinh_doanh', 'san_xuat_xay_dung', 'cntt_ky_thuat', 'thiet_ke', 'truyen_thong', 'lai_xe_giao_hang', 'y_te_dieu_duong', 'giao_duc_giang_day', 'khac']
eq(new Set(images.map((m) => m.id)).size, images.length, 'ids are unique')
for (const m of images) {
  ok(/^[a-z0-9_-]+$/.test(m.id), `${m.id}: id shape`)
  ok(m.file.startsWith('/images/'), `${m.id}: file under public/images`)
  ok(CATEGORIES.includes(m.group), `${m.id}: known group`)
  for (const r of m.roles ?? []) ok(validCodes.has(r), `${m.id}: official occupation code ${r}`)
  if (m.env) ok((ENV_KEYS as readonly string[]).includes(m.env), `${m.id}: env key ${m.env}`)
  ok(m.kind === 'stock' || m.kind === 'ai', `${m.id}: kind`)
  // 출처·라이선스 보존: 실제 사진은 SOURCES.json 열쇠(또는 줄 안 license), AI 그림은 제작 출처 글.
  if (m.kind === 'stock') ok(m.source && (sources as Record<string, { license?: string }>)[m.source]?.license, `${m.id}: stock image keeps its SOURCES.json license`)
  else ok(m.origin && m.origin.length >= 5, `${m.id}: AI picture keeps its origin`)
}
// SOURCES.json은 지우지 않는다(기존 21개 출처 항목 유지).
ok(Object.keys(sources).length >= 21, 'SOURCES.json entries are preserved')

// 선택 단계(합성 목록): 이미지를 추가하면 코드 수정 없이 ①→②→③→④ 순서로 쓰인다.
const syn = {
  groups: { dich_vu: { fallback: 'neutral' as const }, am_thuc_do_uong: { fallback: 'legacy' as const } },
  images: [
    { id: 'g-guard-factory-001', file: '/g1.jpg', group: 'dich_vu', roles: ['540'], env: 'nha_may', kind: 'ai', origin: 'test' },
    { id: 'g-guard-001', file: '/g2.jpg', group: 'dich_vu', roles: ['540'], env: null, kind: 'ai', origin: 'test' },
    { id: 'g-general-001', file: '/g3.jpg', group: 'dich_vu', kind: 'ai', origin: 'test' },
    { id: 'f-wait-001', file: '/f1.jpg', group: 'am_thuc_do_uong', roles: ['5131'], env: 'nha_hang_nuong', kind: 'ai', origin: 'test' },
  ],
} as unknown as { images: ManagedImage[]; groups: Record<string, { fallback: 'legacy' | 'neutral' }> }
eq(selectManaged(syn, 'dich_vu', '5401', 1, 'nha_may'), '/g1.jpg', '① role + environment')
eq(selectManaged(syn, 'dich_vu', '5401', 1, 'khach_san'), '/g2.jpg', '② role without matching environment')
eq(selectManaged(syn, 'dich_vu', '9112', 1, null), '/g3.jpg', '③ group general')
eq(selectManaged({ ...syn, images: syn.images.filter((m) => m.id !== 'g-general-001') }, 'dich_vu', '9112', 1, null), '/images/industry/khac.jpg', '④ neutral')
eq(selectManaged(syn, 'am_thuc_do_uong', '5131', 1, 'nha_hang_lau'), undefined, '④ legacy keeps the existing selection')
eq(selectManaged(syn, 'dich_vu', '5401', 1, 'nha_may', 'g-guard-001'), '/g2.jpg', 'assigned image never changes when images are added')
eq(selectManaged(syn, 'khac', '5401', 1), undefined, 'groups not in the list use the existing selection')
// 실제 목록: 세부 직무 사진이 없는 경비(540)는 기본 사진, 청소·미용은 해당 사진.
eq(managedPhoto('dich_vu', '540', 1, 'nha_may'), '/images/industry/khac.jpg', 'security: neutral until its pictures exist')
console.log('photoManifest: integrity and tier selection passed')
