// Lee 2026-10-28: "street center" tier dry-run. Manual, read-only, no DB writes, no pins.
// For public announcements whose original address names a street, ask VietMap (through the
// admin read API that holds the Vercel key) for that street inside the original province/city.
// Adopt only when exactly one same-name street exists there; otherwise the rule falls back to
// ward → city. Reports the distance from the current canonical pin. The reference point is a run
// input only (never stored).
import {supabaseServer as publicClient} from '../../src/lib/supabaseServer.ts'
import {normalizePlaceText} from '../../src/lib/locationCandidateMatch.ts'
import {administrativeAreaForTarget, areaContains} from '../../src/lib/administrativeArea.ts'

const BASE = process.env.BASE_URL || 'https://www.viecganban.vn'
const REF = {company: process.env.REF_COMPANY || '', lat: Number(process.env.REF_LAT), lng: Number(process.env.REF_LNG)}
const note = (m) => console.log(`::notice::${m.replace(/\r?\n/g, ' ')}`)
const NOT_STREET = /^(?:kcn|ccn|khu cong nghiep|cum cong nghiep|nha may|phuong|p|xa|thi tran|tt|quan|q|huyen|h|thi xa|tx|thanh pho|tp|tinh|t)\b/
function originalStreet(address) {
  const first = normalizePlaceText(String(address ?? '').split(/,|\s[-–]\s/)[0] ?? '')
  const street = first.replace(/^(?:so\s+)?\d+[a-z]?(?:\/\d+)*\s+/, '').replace(/^(?:duong|pho)\s+/, '').trim()
  return street.length > 2 && !NOT_STREET.test(first) ? street : ''
}
const bareStreet = (name) => normalizePlaceText(name).replace(/^(?:duong|pho)\s+/, '').trim()
const areaText = (address) => String(address).split(/,|\s[-–]\s/).slice(1).join(', ').trim()
function meters(a, b) {
  const r = 6371000, rad = (d) => d * Math.PI / 180
  const dLat = rad(b.lat - a.lat), dLng = rad(b.lng - a.lng)
  const h = Math.sin(dLat / 2) ** 2 + Math.cos(rad(a.lat)) * Math.cos(rad(b.lat)) * Math.sin(dLng / 2) ** 2
  return Math.round(2 * r * Math.asin(Math.sqrt(h)))
}

const login = await publicClient.auth.signInWithPassword({email: process.env.ADMIN_E2E_EMAIL || '', password: process.env.ADMIN_E2E_PASSWORD || ''})
const token = login.data?.session?.access_token
if (!token) { console.log('::error::admin_login_failed'); process.exit(1) }
let calls = 0
async function call(body) {
  calls++
  const res = await fetch(`${BASE}/api/admin?action=business-search`, {method: 'POST', signal: AbortSignal.timeout(40000),
    headers: {'content-type': 'application/json', authorization: `Bearer ${token}`}, body: JSON.stringify({provider: 'vietmap', ...body})})
  const out = await res.json().catch(() => ({}))
  if (!res.ok) throw new Error(`HTTP ${res.status}${out.upstreamStatus ? ` upstream ${out.upstreamStatus}` : ''}`)
  return out
}

const {data: jobs, error} = await publicClient.from('local_jobs').select('id,company,location').eq('active', true).eq('admin_hidden', false).order('id').abortSignal(AbortSignal.timeout(15000))
if (error) { console.log('::error::public_jobs_unavailable'); process.exit(1) }
const {data: points} = await publicClient.from('job_work_locations').select('job_id,raw_address,lat,lng,point_kind,location_verified').in('job_id', jobs.map((j) => j.id))
let targets = 0, adopted = 0
const saved = []
for (const job of jobs) {
  for (const w of (points ?? []).filter((p) => p.job_id === job.id)) {
    const street = originalStreet(w.raw_address)
    const exactPin = w.location_verified || ['exact', 'gate'].includes(w.point_kind)
    if (!street) { note(`#${job.id} ${job.company}: 원문 "${w.raw_address}" → 거리 이름 없음(대상 아님)`); continue }
    if (exactPin) { note(`#${job.id} ${job.company}: 원문 "${w.raw_address}" → 이미 ${w.point_kind}${w.location_verified ? '·확인' : ''} 핀(대상 아님)`); continue }
    targets++
    try {
      const found = await call({kind: 'street', company: street, area: areaText(w.raw_address)})
      const same = (found.hits ?? []).filter((h) => bareStreet(h.name) === street)
      const area = administrativeAreaForTarget(w.raw_address, job.location)
      const inside = []
      for (const h of same.slice(0, 3)) {
        const d = await call({id: h.id})
        if (d.found && area && areaContains({...area, proofType: undefined}, d)) inside.push({...d, name: h.name})
      }
      const current = Number.isFinite(w.lat) && Number.isFinite(w.lng) ? {lat: w.lat, lng: w.lng} : null
      const names = (found.hits ?? []).slice(0, 5).map((h) => `"${h.name}"${h.categories?.length ? `(${h.categories.join('/')})` : ''}`).join(', ')
      if (inside.length !== 1) {
        note(`#${job.id} ${job.company}: 원문 "${w.raw_address}" 거리 "${street}" → 채택 안 함(같은 이름 거리 ${same.length}곳, 원문 성 안 ${inside.length}곳 → 동→시 유지). 후보 ${names || '없음'}`)
        continue
      }
      adopted++
      const p = inside[0]
      const moved = current ? meters(current, p) : null
      const ref = REF.company && Number.isFinite(REF.lat) && normalizePlaceText(REF.company) === normalizePlaceText(job.company)
        ? ` | 참고점까지: 현재 ${current ? meters(current, REF) : '?'}m → 거리 가운데 ${meters(p, REF)}m` : ''
      if (current && ref) saved.push(meters(current, REF) - meters(p, REF))
      note(`#${job.id} ${job.company}: 원문 "${w.raw_address}" 거리 "${street}" → 채택(VietMap "${p.name}", ${p.address}). 현재 ${w.point_kind} 핀에서 ${moved ?? '?'}m 이동${ref}`)
    } catch (e) { note(`#${job.id} ${job.company}: 오류 ${String(e.message).slice(0, 60)}`) }
  }
}
note(`합계: 공개 공고 ${jobs.length}건, 거리 가운데 대상 ${targets}곳, 채택 ${adopted}곳, VietMap 관리자 API 호출 ${calls}회. DB 쓰기 없음`)
