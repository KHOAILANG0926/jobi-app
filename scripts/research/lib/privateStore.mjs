// 수집·검토 데이터/백업을 PC 파일이 아니라 Supabase 비공개 테이블(research_artifacts)에 저장하는 공용 헬퍼.
// 원칙(CLAUDE.md "저장 원칙"): PC에 키·데이터·결과 파일을 저장하지 않는다.
// - 관리자 로그인 세션 토큰만 메모리에서 쓴다(파일·.env에 저장하지 않음).
//     · ADMIN_ACCESS_TOKEN 환경변수(해당 터미널 세션에만 존재) 또는
//     · 실행 시 이메일/비밀번호를 터미널에서 입력(비밀번호는 화면에 표시하지 않음, 어디에도 저장 안 함)
// - 서비스 키(SUPABASE_SERVICE_ROLE_KEY)·VIETMAP_SERVICE_KEY는 이 PC에 두지 않는다(Vercel 환경변수에만).
// - 접근 RPC: admin_save_research_artifact / admin_get_research_artifact / admin_list_research_artifacts
//   (supabase/pending/20261008000000_private_research_store.sql — 승인·적용 전에는 RPC 없음 오류)
import fs from 'node:fs'
import readline from 'node:readline'
import { createClient } from '@supabase/supabase-js'

const SUPABASE_URL = process.env.SUPABASE_URL || 'https://edhuesdnuxlbcfephutq.supabase.co'
export const API_BASE = (process.env.VIGB_API_BASE || 'https://viecganban.vn').replace(/\/$/, '')

// 게시용(anon) 키는 사이트 번들에 이미 공개돼 있다 — 비밀이 아니다. 소스에서 읽어 쓴다.
function anonKey() {
  if (process.env.SUPABASE_ANON_KEY) return process.env.SUPABASE_ANON_KEY
  const src = fs.readFileSync(new URL('../../../src/lib/supabase.ts', import.meta.url), 'utf8')
  const m = src.match(/eyJ[A-Za-z0-9._-]+/)
  if (!m) throw new Error('anon key를 찾지 못했습니다')
  return m[0]
}

function ask(question, hidden = false) {
  return new Promise((resolve) => {
    const rl = readline.createInterface({ input: process.stdin, output: process.stdout, terminal: true })
    if (hidden) {
      rl._writeToOutput = (s) => { if (s.includes(question)) rl.output.write(s); else rl.output.write('') }
    }
    rl.question(question, (answer) => { rl.close(); if (hidden) process.stdout.write('\n'); resolve(answer.trim()) })
  })
}

let session = null
export async function adminSession() {
  if (session) return session
  const client = createClient(SUPABASE_URL, anonKey(), { auth: { persistSession: false, autoRefreshToken: false } })
  let token = process.env.ADMIN_ACCESS_TOKEN?.trim()
  if (!token) {
    const email = await ask('관리자 이메일: ')
    const password = await ask('관리자 비밀번호(표시되지 않음): ', true)
    const { data, error } = await client.auth.signInWithPassword({ email, password })
    if (error || !data.session) throw new Error('관리자 로그인 실패')
    token = data.session.access_token
  }
  const authed = createClient(SUPABASE_URL, anonKey(), {
    auth: { persistSession: false, autoRefreshToken: false },
    global: { headers: { Authorization: `Bearer ${token}` } },
  })
  session = { token, db: authed }
  return session
}

export async function saveArtifact(kind, name, payload, meta = {}) {
  const { db } = await adminSession()
  const { error } = await db.rpc('admin_save_research_artifact', { p_kind: kind, p_name: name, p_payload: payload, p_meta: meta })
  if (error) throw new Error(`비공개 저장 실패(${kind}/${name}): ${error.message}`)
}

export async function loadArtifact(kind, name) {
  const { db } = await adminSession()
  const { data, error } = await db.rpc('admin_get_research_artifact', { p_kind: kind, p_name: name })
  if (error) throw new Error(`비공개 읽기 실패(${kind}/${name}): ${error.message}`)
  return data?.payload ?? null
}

export async function listArtifacts(kind = null) {
  const { db } = await adminSession()
  const { data, error } = await db.rpc('admin_list_research_artifacts', { p_kind: kind })
  if (error) throw new Error(`비공개 목록 실패: ${error.message}`)
  return data ?? []
}

/** 관리자 서버 API(api/admin-vietmap) 경유 VietMap 호출 — 키는 서버에만 있다. */
export async function vietmapCall(body) {
  const { token } = await adminSession()
  let res
  try {
    res = await fetch(`${API_BASE}/api/admin-vietmap`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
      body: JSON.stringify(body),
      signal: AbortSignal.timeout(30_000),
    })
  } catch (e) {
    throw new Error(`서버 API 연결 실패: ${String(e.cause?.code ?? e.name)}`)
  }
  const json = await res.json().catch(() => ({}))
  if (res.status === 429) { const err = new Error('하루 상한(250회) 도달'); err.code = 'DAILY_LIMIT'; err.used = json.used; throw err }
  if (!res.ok) throw new Error(`서버 API ${res.status} ${json.error ?? ''}`.trim())
  return json
}
