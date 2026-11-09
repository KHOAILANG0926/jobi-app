// Google 좌표 사용 공고 조사(Lee 2026-11-10, 읽기 전용 — 공개 화면과 같은 공개 조회만, DB 쓰기·외부 지도 호출 없음).
// 공개 공고(active·숨김 아님)의 근무지 점마다 좌표 출처와 검증 상태를 나눈다:
//   1 verified  : 독립 검증 좌표(VietMap/Goong 번지 확인 exact·관리자 확정·기존 사업장 확정 재사용·작성자 핀)
//   2 google    : Google 장소 좌표만(검증 없음) → 핀을 빼야 함(약관 14.2·14.3)
//   3 representative : 공단 입구·거리 가운데·동/시/성 중심 등 사업장 자리가 아닌 대표 좌표(chưa xác minh 표시 대상)
//   2b google_link : 관리자 확정이지만 Google 지도 링크에서 옮긴 좌표(따로 표시 — Lee 판단)
//   0 none      : 좌표 없음
// 출력: 건수 + 공고별 한 줄(번호·회사·분류·점 종류·출처 근거 앞부분). 연락처·원문은 출력하지 않는다.
import { supabaseServer as db } from '../../src/lib/supabaseServer.ts'

const GOOGLE_API = /Google [A-Za-z0-9_-]{10,} \(company\)/
const GOOGLE_LINK = /google\.[a-z.]+\/maps|maps\.app\.goo\.gl|goo\.gl\/maps/i
/** 점 하나의 출처·검증 분류. 근거: point_authority(있으면)·point_kind·point_evidence(출처 글자). */
export function classifyPoint(p) {
  const ev = typeof p.point_evidence === 'string' ? p.point_evidence : JSON.stringify(p.point_evidence ?? '')
  const kind = String(p.point_kind ?? ''), auth = String(p.point_authority ?? '')
  if (p.lat === null || p.lat === undefined || !Number.isFinite(Number(p.lat)) || !Number.isFinite(Number(p.lng))) return { cls: 'none', why: 'no_point' }
  if (GOOGLE_API.test(ev)) return { cls: 'google', why: `google_api:${kind}/${auth || '?'}` }
  // 관리자 확정이라도 Google 지도 링크에서 옮긴 좌표면 따로 센다(Google 좌표 — Lee 판단 필요)
  if (/admin_confirmed|auto_reuse/.test(auth) && GOOGLE_LINK.test(ev)) return { cls: 'google_link', why: `admin_google_link:${kind}/${auth}` }
  if (/admin_confirmed|auto_reuse|source_verified|employer/.test(auth) || kind === 'exact') return { cls: 'verified', why: `${kind}/${auth || '?'}` }
  return { cls: 'representative', why: `${kind || 'area'}/${auth || '?'}` }
}

if (process.argv[1]?.endsWith('google-pin-survey.mjs')) {
  const { data: jobs, error } = await db.from('local_jobs').select('id,company').eq('active', true).eq('admin_hidden', false).order('id').abortSignal(AbortSignal.timeout(20000))
  if (error) { console.log('::error::public_jobs_unavailable'); process.exit(1) }
  let COLS = 'job_id,lat,lng,point_kind,point_precision,point_authority,point_evidence,location_verified,coordinate_accuracy'
  { const t = await db.from('job_work_locations').select(COLS).limit(1); if (t.error) { console.log('::notice::point_authority 공개 조회 불가 — 출처 글자·점 종류로만 분류'); COLS = COLS.replace('point_authority,', '') } }
  const points = []
  for (let i = 0; i < jobs.length; i += 100) {
    const { data, error: e } = await db.from('job_work_locations').select(COLS)
      .in('job_id', jobs.slice(i, i + 100).map((j) => j.id)).abortSignal(AbortSignal.timeout(20000))
    if (e) { console.log('::error::public_points_unavailable ' + e.message); process.exit(1) }
    points.push(...data)
  }
  const byJob = new Map(jobs.map((j) => [j.id, { ...j, pts: [] }]))
  for (const p of points) byJob.get(p.job_id)?.pts.push({ ...p, ...classifyPoint(p) })
  const count = { verified: 0, google: 0, google_link: 0, representative: 0, none: 0 }
  const lines = []
  for (const j of byJob.values()) {
    const pts = j.pts.length ? j.pts : [{ cls: 'none', why: 'no_row' }]
    // 공고 분류: Google 점이 하나라도 있으면 2, 아니면 검증 점이 있으면 1, 아니면 대표 좌표 3, 점 없음 0
    const cls = pts.some((p) => p.cls === 'google') ? 'google' : pts.some((p) => p.cls === 'google_link') ? 'google_link' : pts.some((p) => p.cls === 'verified') ? 'verified' : pts.some((p) => p.cls === 'representative') ? 'representative' : 'none'
    count[cls]++
    const ev = (p) => String(typeof p.point_evidence === 'string' ? p.point_evidence : JSON.stringify(p.point_evidence ?? '')).replace(/\s+/g, ' ').slice(0, 90)
    lines.push(`${cls}\t#${j.id}\t${String(j.company ?? '').slice(0, 40)}\t${pts.map((p) => `${p.why}${p.coordinate_accuracy ? `/${p.coordinate_accuracy}` : ''}`).join(',')}\t${pts.map(ev).join(' | ')}`)
  }
  console.log(`공개 공고 ${jobs.length}건 · 근무지 점 ${points.length}개`)
  console.log(`1 독립 검증 좌표 ${count.verified} · 2 Google 장소 좌표(API) ${count.google} · 2b 관리자 확정(Google 지도 링크) ${count.google_link} · 3 대표 좌표 ${count.representative} · 0 좌표 없음 ${count.none}`)
  for (const l of lines.sort()) console.log(l)
}
