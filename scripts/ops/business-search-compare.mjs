// Lee 2026-10-28 (C): VietMap vs Goong business-name search comparison. Manual, read-only.
// Reads public announcements with the anonymous public client (same as the pin check), then calls the
// admin-only read API /api/admin?action=business-search which uses the provider keys held in Vercel.
// No DB writes, no pins, no operational change. No provider keys in GitHub; nothing secret is printed.
// Results are ::notice:: annotations. The reference point (Google, reference only) arrives as
// workflow inputs and is never written anywhere.
import {supabaseServer as publicClient} from '../../src/lib/supabaseServer.ts'
import {isExactCompanyName, normalizePlaceText} from '../../src/lib/locationCandidateMatch.ts'
import {administrativeAreaForTarget, areaContains} from '../../src/lib/administrativeArea.ts'
import {findIndustrialPark} from '../../src/lib/industrialPark.ts'

const REF = {company: process.env.REF_COMPANY || '', lat: Number(process.env.REF_LAT), lng: Number(process.env.REF_LNG)}
const EXTRA = {company: process.env.EXTRA_COMPANY || '', address: process.env.EXTRA_ADDRESS || ''}
const note = (m) => console.log(`::notice::${m.replace(/\r?\n/g, ' ')}`)

const NOT_STREET = /^(?:kcn|ccn|khu cong nghiep|cum cong nghiep|phuong|p|xa|thi tran|tt|quan|q|huyen|h|thi xa|tx|thanh pho|tp|tinh|t)\b/
function originalStreet(address) {
  const first = normalizePlaceText(String(address ?? '').split(/,|\s[-–]\s/)[0] ?? '')
  const street = first.replace(/^(?:so\s+)?\d+[a-z]?(?:\/\d+)*\s+/, '').replace(/^(?:duong|pho)\s+/, '').trim()
  return street.length > 2 && !NOT_STREET.test(first) ? street : ''
}
const areaText = (address) => String(address).split(/,|\s[-–]\s/).slice(-3).join(', ').trim()
function judge(job, poi) {
  if (!poi) return {found: false, why: 'no_single_exact_name'}
  const area = administrativeAreaForTarget(job.address, job.location)
  const inside = !!area && areaContains({...area, proofType: undefined}, poi)
  const street = originalStreet(job.address)
  const text = ` ${normalizePlaceText(poi.address || '')} `
  const streetOk = street ? text.includes(` ${street} `) : null
  return {found: true, inside, streetOk, lat: poi.lat, lng: poi.lng}
}
function meters(a, b) {
  const r = 6371000, rad = (d) => d * Math.PI / 180
  const dLat = rad(b.lat - a.lat), dLng = rad(b.lng - a.lng)
  const h = Math.sin(dLat / 2) ** 2 + Math.cos(rad(a.lat)) * Math.cos(rad(b.lat)) * Math.sin(dLng / 2) ** 2
  return Math.round(2 * r * Math.asin(Math.sqrt(h)))
}
const BASE = process.env.BASE_URL || 'https://www.viecganban.vn'
// Admin login (same E2E admin secrets as the admin location review check). Provider keys stay in Vercel.
const login = await publicClient.auth.signInWithPassword({email: process.env.ADMIN_E2E_EMAIL || '', password: process.env.ADMIN_E2E_PASSWORD || ''})
const token = login.data?.session?.access_token
if (!token) { console.log('::error::admin_login_failed'); process.exit(1) }
const missing = new Set()
async function call(provider, body) {
  const res = await fetch(`${BASE}/api/admin?action=business-search`, {method: 'POST', signal: AbortSignal.timeout(40000),
    headers: {'content-type': 'application/json', authorization: `Bearer ${token}`}, body: JSON.stringify({provider, ...body})})
  const out = await res.json().catch(() => ({}))
  if (res.status === 503 && out.error === 'not_configured') { missing.add(provider); return null }
  if (!res.ok) throw new Error(`HTTP ${res.status}${out.upstreamStatus ? ` upstream ${out.upstreamStatus}` : ''}`)
  return out
}
async function search(provider, job) {
  const found = await call(provider, {company: job.company, area: areaText(job.address)})
  if (!found) return {skip: true}
  const exact = (found.hits ?? []).filter((h) => h.name && isExactCompanyName(job.company, h.name))
  if (exact.length !== 1) return {calls: 1, ...judge(job, null), why: exact.length > 1 ? 'multiple_same_name' : 'no_exact_name'}
  const place = await call(provider, {id: exact[0].id})
  if (!place?.found) return {calls: 2, ...judge(job, null), why: 'no_detail_point'}
  return {calls: 2, ...judge(job, {lat: place.lat, lng: place.lng, address: place.address || ''})}
}

const {data: jobs, error} = await publicClient.from('local_jobs').select('id,company,location').eq('active', true).eq('admin_hidden', false).order('id').abortSignal(AbortSignal.timeout(15000))
if (error) { console.log('::error::public_jobs_unavailable'); process.exit(1) }
const {data: places} = await publicClient.from('job_work_locations').select('job_id,raw_address').in('job_id', jobs.map((j) => j.id))
const cases = jobs.filter((j) => j.company?.trim()).map((j) => ({id: j.id, company: j.company, location: j.location || '', address: places?.find((p) => p.job_id === j.id)?.raw_address || j.location || ''}))
if (EXTRA.company && EXTRA.address && !cases.some((c) => isExactCompanyName(EXTRA.company, c.company))) cases.push({id: 'extra', company: EXTRA.company, location: EXTRA.address, address: EXTRA.address})
note(`표본 ${cases.length}건(공개 공고 ${jobs.length}건 중 회사명 있음${EXTRA.company ? ' + 입력 사례' : ''}). 관리자 API(Vercel 키) 경유`)

const total = {vietmap: {found: 0, ok: 0, calls: 0, errors: 0}, goong: {found: 0, ok: 0, calls: 0, errors: 0}}
const errors = {vietmap: [], goong: []}
for (const job of cases) {
  const park = findIndustrialPark(job.address, job.location) ? '공단' : '공단 밖'
  const parts = []
  for (const name of ['vietmap', 'goong']) {
    if (missing.has(name)) { parts.push(`${name}=Vercel 키 없음`); continue }
    try {
      const r = await search(name, job)
      if (r.skip) { parts.push(`${name}=Vercel 키 없음`); continue }
      total[name].calls += r.calls
      if (r.found) total[name].found++
      const accepted = r.found && r.inside && r.streetOk !== false
      if (accepted) total[name].ok++
      let diff = ''
      if (r.found && REF.company && Number.isFinite(REF.lat) && isExactCompanyName(REF.company, job.company)) {
        const m = meters(r, REF); diff = ` 참고점 차이 ${m}m`; errors[name].push(m)
      }
      parts.push(`${name}=${r.found ? '찾음' : `못찾음(${r.why})`}${r.found ? ` 성 안=${r.inside ? '예' : '아니오'} 거리=${r.streetOk === null ? '원문 거리 없음' : r.streetOk ? '일치' : '불일치'} 채택조건=${accepted ? '충족' : '미충족'}${diff}` : ''} 호출 ${r.calls}`)
    } catch (e) { total[name].errors++; parts.push(`${name}=오류(${String(e.message).slice(0, 40)})`) }
  }
  note(`#${job.id} ${job.company} [${park}] 원문 "${job.address}" → ${parts.join(' | ')}`)
}
for (const name of ['vietmap', 'goong']) {
  if (missing.has(name)) note(`${name}: Vercel 환경변수에 키 없음(not_configured)`)
  const t = total[name], avg = errors[name].length ? Math.round(errors[name].reduce((a, b) => a + b, 0) / errors[name].length) : null
  note(`합계 ${name}: 찾음 ${t.found}/${cases.length}, 채택조건 충족 ${t.ok}/${cases.length}, 오류 ${t.errors}, 호출 ${t.calls}회${avg === null ? '' : `, 참고점 평균 차이 ${avg}m`}`)
}
