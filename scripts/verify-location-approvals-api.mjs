// job_location_candidates(20260929120000 migration) 적용 후 실제 Supabase API(PostgREST)에서
// 익명(anon) 권한이 의도대로인지 확인한다. 읽기·실패 확인만 하고 데이터를 바꾸지 않는다.
//
// 실행: node --experimental-strip-types scripts/verify-location-approvals-api.mjs
//
// PGlite 테스트(supabase/tests/job_location_approvals.pglite.test.mjs)가 확인하지 못하는
// "실제 PostgREST의 컬럼 권한·RLS 적용"을 보완한다. 관리자 경로(실제 JWT로 RPC 호출·승인·철회)는
// 관리자 화면(/admin → 📍 Vị trí)에서 사람이 한 번 수동 확인해야 한다.
import { supabase } from '../src/lib/supabase.ts'

let pass = 0, fail = 0
const ok = (c, m) => { if (c) { pass++; console.log('✅', m) } else { fail++; console.log('❌', m) } }

// 1) 공개 컬럼 조회는 되고, 승인 안 된 행은 보이지 않아야 한다
const pub = await supabase.from('job_location_candidates')
  .select('job_id,company_snapshot,address_snapshot,lat,lng,place_precision,status')
ok(!pub.error, `anon can read public columns (${pub.error?.message ?? `${pub.data.length} rows`})`)
ok(!pub.error && pub.data.every((r) => r.status === 'approved'), 'anon sees approved rows only')

// 2) 근거·검토자 컬럼은 읽을 수 없어야 한다
for (const col of ['evidence', 'reviewed_by', 'created_by', 'review_note']) {
  const r = await supabase.from('job_location_candidates').select(col).limit(1)
  ok(!!r.error, `anon cannot read ${col} (${r.error?.message ?? 'NO ERROR'})`)
}

// 3) 직접 쓰기 불가
const ins = await supabase.from('job_location_candidates').insert({
  job_id: 0, company_snapshot: 'x', address_snapshot: 'x', lat: 21, lng: 106,
  place_precision: 'building', source: 'other', evidence: 'api check',
})
ok(!!ins.error, `anon cannot insert (${ins.error?.message ?? 'NO ERROR'})`)

// 4) 관리자 RPC는 비로그인으로 호출 불가
const list = await supabase.rpc('admin_list_location_candidates')
ok(!!list.error, `anon cannot call admin_list_location_candidates (${list.error?.message ?? 'NO ERROR'})`)
const review = await supabase.rpc('admin_review_location_candidate', { p_candidate_id: 0, p_action: 'approve', p_note: '' })
ok(!!review.error, `anon cannot call admin_review_location_candidate (${review.error?.message ?? 'NO ERROR'})`)

console.log(`\n결과: ${pass} passed, ${fail} failed`)
process.exit(fail ? 1 : 0)
