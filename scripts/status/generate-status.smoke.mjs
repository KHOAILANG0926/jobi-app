// 생성기 전체 실행 점검(네트워크 없음): 가짜 응답으로 generate-status.mjs를 끝까지 돌려 STATUS.md가 만들어지는지 본다.
// 2026-10-11 코드 이동 중 변수 선언이 빠져 운영 실행이 실패한 사고 재발 방지. 실행: node scripts/status/generate-status.smoke.mjs
import { execFileSync } from 'node:child_process'
import { mkdtempSync, readFileSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import assert from 'node:assert/strict'

const dir = mkdtempSync(join(tmpdir(), 'status-smoke-'))
const mock = join(dir, 'mock.mjs')
writeFileSync(mock, `globalThis.fetch = async (url) => {
  const u = String(url); const j = (b, s = 200) => ({ ok: s < 300, status: s, json: async () => b })
  if (u.includes('/commits/master')) return j({ sha: 'abc1234def0', commit: { message: 'smoke' } })
  if (u.includes('/pulls?')) return j([{ number: 1, title: 't', merged_at: '2026-10-11T00:00:00Z', merge_commit_sha: 'abc1234' }])
  if (u.includes('/deployments/') ) return j([{ state: 'success' }])
  if (u.includes('/deployments?')) return j([{ id: 1, sha: 'abc1234def0', created_at: '2026-10-11T00:00:00Z' }])
  if (u.includes('/commits?')) return j([])
  if (u.includes('/api/status-recheck')) return j({ calls: 1, results: [{ jobId: 4713, state: 'ok', stored: { lat: 21.1, lng: 106 }, fetched: { lat: 21.1, lng: 106 } }] })
  if (u.includes('oidc')) return j({ value: 'tok' })
  if (u.startsWith('https://viecganban.vn')) return j({})
  if (u.includes('local_jobs?select=id,source')) return j([{ id: 4713, source: 'chotot:1', active: true, admin_hidden: false }])
  if (u.includes('job_location_candidates')) return j([{ job_id: 4713, reviewed_at: '2026-10-08T05:23:14Z', evidence: 'Tìm theo địa chỉ chi tiết trên VietMap: P\\\\nĐịa chỉ VietMap: P 1A Lê Thái Tổ\\\\nVietMap ref: geocode:A', lat: 21.1, lng: 106 }])
  if (u.includes('job_work_locations')) return j([{ job_id: 4713, raw_address: '1A Lê Thái Tổ, Bắc Ninh' }])
  if (u.includes('local_jobs?select=id,company')) return j([{ id: 4713, company: 'PIZZA' }])
  if (u.includes('vietmap_usage_daily')) return j([{ day: '2026-10-11', calls: 1, updated_at: '2026-10-11T00:00:00Z' }])
  if (u.includes('ocr_check')) return j([{ id: 1 }, { id: 2 }])
  if (u.includes('job_posting_rules')) return j([{ rule_key: 'R1_phone_digits_only', block_mode: '없음', last_tested_at: '2026-10-13T00:00:00Z', last_test_result: '통과' }])
  if (u.includes('admin_audit_logs')) return j([{ action: 'x', target_type: 'job', target_id: '1', created_at: '2026-10-11T00:00:00Z' }])
  return j([])
}`)
const out = join(dir, 'STATUS.md')
execFileSync(process.execPath, ['--import', mock, join(import.meta.dirname, 'generate-status.mjs')], {
  env: { ...process.env, SUPABASE_URL: 'https://x.supabase.co', SUPABASE_SERVICE_ROLE_KEY: 'k', GITHUB_TOKEN: 't', GITHUB_REPOSITORY: 'a/b',
    ACTIONS_ID_TOKEN_REQUEST_URL: 'https://oidc/x?y=1', ACTIONS_ID_TOKEN_REQUEST_TOKEN: 't', OUT: out },
  stdio: 'inherit',
})
const md = readFileSync(out, 'utf8')
for (const part of ['## 1.', '## 5.', '## 6.', '## 7.', '## 8.', '## 9.', 'OCR 읽기불가', 'R1_phone_digits_only', '✅ 일치']) assert.ok(md.includes(part), `STATUS에 ${part} 있음`)
assert.ok(!md.includes('조회 실패'), '조회 실패 없음')
console.log('generate-status smoke: all assertions passed')
