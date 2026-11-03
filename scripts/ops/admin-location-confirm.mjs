// 관리자 위치 확정을 관리자 화면과 같은 API로(Lee 2026-11-03: 휴대폰에서 PC 로그인 없이 확정).
// 관리자 화면 "📍 Vị trí"에서 하는 일과 똑같다: 대기 목록에서 공고 찾기 → Google 링크로 좌표 → 확정(canonical writer).
// 수동 실행만(workflow_dispatch). 키·비밀번호는 출력하지 않는다.
import {supabaseServer as publicClient} from '../../src/lib/supabaseServer.ts'

const BASE = process.env.BASE_URL || 'https://www.viecganban.vn'
const JOB_ID = Number(process.env.JOB_ID)
const LINK = String(process.env.GOOGLE_LINK || '').trim()
const fail = (m) => { console.log(`::error::${m}`); process.exit(1) }
if (!Number.isSafeInteger(JOB_ID) || !/^https:\/\/(?:www\.)?google\.[a-z.]+\/maps\/|^https:\/\/maps\.app\.goo\.gl\//.test(LINK)) fail('job_id 또는 Google 지도 링크 형식 오류')

const login = await publicClient.auth.signInWithPassword({email: process.env.ADMIN_E2E_EMAIL || '', password: process.env.ADMIN_E2E_PASSWORD || ''})
const token = login.data?.session?.access_token
if (!token) fail('admin_login_failed')
const api = async (method, body) => {
  const res = await fetch(`${BASE}/api/admin?action=location-review`, {method, signal: AbortSignal.timeout(40000),
    headers: {'content-type': 'application/json', authorization: `Bearer ${token}`}, ...(body ? {body: JSON.stringify(body)} : {})})
  const out = await res.json().catch(() => ({}))
  if (!res.ok) fail(`${method} ${body?.action ?? 'queue'}: HTTP ${res.status} ${out.error ?? ''}`)
  return out
}
const queue = await api('GET')
const job = (queue.pending ?? []).find((j) => j.jobId === JOB_ID)
if (!job) fail(`#${JOB_ID}이 위치 확정 대기 목록에 없음(이미 확정됐거나 대상 아님)`)
const {point} = await api('POST', {action: 'resolve', link: LINK})
if (!point || !Number.isFinite(point.lat)) fail('Google 링크에서 좌표를 못 읽음')
console.log(`::notice::#${JOB_ID} ${job.company} — 확정할 좌표 ${point.lat.toFixed(6)}, ${point.lng.toFixed(6)}`)
await api('POST', {action: 'confirm', jobId: JOB_ID, address: job.address, workLocationId: job.workLocationId, lat: point.lat, lng: point.lng, googleLink: point.resolvedUrl || LINK})
console.log(`::notice::#${JOB_ID} 위치 확정 완료`)
