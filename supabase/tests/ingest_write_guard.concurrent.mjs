// 20261126010000_ingest_write_guard.sql — 실제 PostgreSQL 연결 2개 이상 동시 요청 시험(통합 운영 정상화 J그룹 2순위, Lee 2026-11-26). 운영 DB 접속 없음.
// 실행: PG_TEST_URL=<폐기용 DB> node supabase/tests/ingest_write_guard.concurrent.mjs  (CI는 check-postgres-migrations.sh가 이름 규칙 <이름>.concurrent.mjs로 호출)
// 같은 시험을 migration '적용 전'(운영 현재 본문 — 경쟁·덮어쓰기가 실제로 재현돼야 한다)과 '적용 후'(막혀야 한다)에 한 번씩 돌린다. 함수·정책·권한은 migration 파일 그대로(lib/pg-race.mjs).
import assert from 'node:assert/strict'
import { makeScratch, mig, IDS, jobPayload, callSql, settled, isErr, lastNum, errText } from './lib/pg-race.mjs'

const db = await makeScratch()
const opened = []
const sess = (n) => { const s = db.sess(n); opened.push(s); return s }
const q = (sql) => db.scalar(sql)

// 두 연결이 같은 입구를 겹쳐 부른다: A가 트랜잭션을 연 채(미확정) B가 부르고, B가 DB 잠금에서 기다리는지 본 뒤 A를 확정(또는 취소)한다.
async function raceCall({ a, b, endA = 'commit' }) {
  const A = sess('A'), B = sess('B')
  await A.begin(a.role, a.sub); await B.begin(b.role, b.sub)
  const bPid = await B.pid()
  const outA = await A.run(callSql(a.p))
  const pB = B.run(callSql(b.p))
  const early = await settled(pB)
  const blocked = early === null && db.isWaiting(bPid)
  await A.run(endA)
  const outB = early ? early[0] : await pB
  await B.run('commit')
  return { outA, outB, blocked, idA: lastNum(outA), idB: lastNum(outB) }
}

const EMP = { role: 'authenticated', sub: IDS.E1 }
const GUEST = { role: 'anon' }
const CRAWLER = { role: 'service_role' }
const count = (where) => Number(q(`select count(*) from public.local_jobs where ${where}`))

async function suite(patched) {
  const tag = patched ? '후' : '전'
  // ── R1 같은 기업이 같은 내용을 거의 동시에 두 번(이중 클릭·재시도·웹+앱) ──
  {
    const p = jobPayload(`R1${tag}`, { employer_id: IDS.E1 })
    const r = await raceCall({ a: { ...EMP, p }, b: { ...EMP, p } })
    const n = count(`company = 'CTY R1${tag}'`)
    if (patched) { assert.ok(r.blocked, 'R1: 뒤 요청이 DB 잠금에서 기다림'); assert.equal(n, 1, 'R1: 공고 1개'); assert.equal(r.idB, r.idA, 'R1: 뒤 요청은 같은 공고 번호로 돌아옴') }
    else { assert.ok(!r.blocked, 'R1(적용 전): 서로 안 기다림'); assert.equal(n, 2, 'R1(적용 전): 같은 내용이 공고 2개로 등록됨 — 경쟁 재현') }
  }
  // ── R2 게스트(비로그인) 등록 vs 기업 로그인 등록, 같은 내용 동시 ──
  {
    const base = jobPayload(`R2${tag}`)
    const r = await raceCall({ a: { ...GUEST, p: { ...base, guest_manage_token: 'g'.repeat(24) } }, b: { ...EMP, p: { ...base, employer_id: IDS.E1 } } })
    const n = count(`company = 'CTY R2${tag}'`)
    if (patched) { assert.ok(r.blocked && n === 1 && r.idB === r.idA, `R2: 게스트·기업 같은 내용 동시 → 공고 1개(${n})`) }
    else { assert.ok(!r.blocked && n === 2, `R2(적용 전): 두 경로가 각각 등록 — 재현(${n})`) }
  }
  // ── R3 수집(서버 키) vs 기업 등록, 같은 내용 동시 / 수집 둘이 같은 내용 동시 ──
  {
    const base = jobPayload(`R3${tag}`)
    const r = await raceCall({ a: { ...EMP, p: { ...base, employer_id: IDS.E1 } }, b: { ...CRAWLER, p: { ...base, channel: 'crawler_topcv' } } })
    const n = count(`company = 'CTY R3${tag}'`)
    if (patched) assert.ok(r.blocked && n === 1 && r.idB === r.idA, `R3: 기업·수집 같은 내용 동시 → 1개(${n})`)
    else assert.ok(!r.blocked && n === 2, `R3(적용 전): 재현(${n})`)
    const p2 = jobPayload(`R3b${tag}`, { channel: 'crawler_facebook' })
    const r2 = await raceCall({ a: { ...CRAWLER, p: p2 }, b: { ...CRAWLER, p: p2 } })
    const n2 = count(`company = 'CTY R3b${tag}'`)
    if (patched) assert.ok(r2.blocked && n2 === 1 && r2.idB === r2.idA, `R3b: 수집 둘 동시 → 1개(${n2})`)
    else assert.ok(!r2.blocked && n2 === 2, `R3b(적용 전): 재현(${n2})`)
  }
  // ── R4 다른 내용·다른 지점은 서로 기다리지 않는다(잠금 범위가 같은 해시뿐) ──
  {
    const r = await raceCall({ a: { ...EMP, p: jobPayload(`R4a${tag}`, { employer_id: IDS.E1 }) }, b: { ...EMP, p: jobPayload(`R4b${tag}`, { employer_id: IDS.E1 }) } })
    assert.ok(!r.blocked, 'R4: 다른 내용은 안 기다림')
    assert.notEqual(r.idA, r.idB)
  }
  // ── R5 앞 요청이 실패해 되돌아가면(rollback) 기다리던 뒤 요청이 새 공고를 만든다 — 일부 저장 없음 ──
  {
    const p = jobPayload(`R5${tag}`, { employer_id: IDS.E1 })
    const r = await raceCall({ a: { ...EMP, p }, b: { ...EMP, p }, endA: 'rollback' })
    assert.equal(count(`company = 'CTY R5${tag}'`), 1, 'R5: 앞 요청 취소 뒤 공고는 정확히 1개(앞 것은 남지 않음)')
    assert.equal(Number(q(`select count(*) from public.job_ingest_raw where submitted->>'company' = 'CTY R5${tag}'`)), 1, 'R5: 원문 기록도 취소분은 남지 않음')
    if (patched) assert.ok(r.blocked && r.idB > 0, 'R5: 뒤 요청은 기다렸다가 성공')
  }
  // ── R6 수집 경로가 기업·관리자 공고를 다시 수집으로 덮어쓰는가 — 기업이 같은 순간 고치는 중(행 잠금) ──
  {
    const own = jobPayload(`R6${tag}`, { employer_id: IDS.E1, salary: '10 triệu' })
    const E = sess('E'), C = sess('C')
    await E.begin('authenticated', IDS.E1)
    const id = lastNum(await E.run(callSql(own))); await E.run('commit')
    await E.begin('authenticated', IDS.E1)
    assert.ok(!isErr(await E.run(`update public.local_jobs set salary = '15 triệu' where id = ${id};`)), 'R6: 기업이 자기 공고 급여 수정')
    await C.begin('service_role')
    const cPid = await C.pid()
    const pC = C.run(callSql({ channel: 'crawler_topcv', source_text: `다시수집 R6${tag}`, job_id: id, update_fields: ['salary'], salary: '1 triệu' }))
    const early = await settled(pC)
    const blocked = early === null && db.isWaiting(cPid)
    await E.run('commit'); if (!early) await pC; await C.run('commit')
    const salary = q(`select salary from public.local_jobs where id = ${id}`)
    if (patched) { assert.ok(!blocked, 'R6: 수집은 기업 공고를 안 건드려 기다리지 않음'); assert.equal(salary, '15 triệu', 'R6: 기업 수정이 남음') }
    else { assert.ok(blocked, 'R6(적용 전): 수집 갱신이 기업 수정 행 잠금에 걸림'); assert.equal(salary, '1 triệu', 'R6(적용 전): 수집이 기업 수정을 덮어씀 — 재현') }
    // 관리자 공고 + 다시 수집(refresh, 같은 source_url·내용)
    const au = `https://src.example/r6${tag}`
    const adminId = lastNum(await C.run(callSql({ channel: 'admin', source_text: `관리자 R6${tag}`, company: `CTY R6a${tag}`, employer_phone: '0933333333', salary: '12 triệu', location: 'Bắc Ninh', source_url: au, title: 'adm' })))
    await C.run(callSql({ channel: 'crawler_facebook', source_text: `관리자 R6${tag}`, company: `CTY R6a${tag}`, employer_phone: '0933333333', salary: '1 triệu', location: 'Bắc Ninh', source_url: au, title: 'adm', refresh: true }))
    await C.run('commit')
    const adminSalary = q(`select salary from public.local_jobs where id = ${adminId}`)
    if (patched) assert.equal(adminSalary, '12 triệu', 'R6: 다시 수집(refresh)도 관리자 공고를 덮어쓰지 못함')
    else assert.equal(adminSalary, '1 triệu', 'R6(적용 전): 다시 수집이 관리자 공고를 덮어씀 — 재현')
  }
  // ── R7 기업 경로로 원문 주소 선점 → 같은 주소의 수집 공고가 '중복'으로 사라지는가 ──
  {
    const url = `https://squat.example/${patched ? 'after' : 'before'}`
    const E = sess('E'), C = sess('C')
    await E.begin('authenticated', IDS.E1)
    const sq = lastNum(await E.run(callSql(jobPayload(`R7s${tag}`, { employer_id: IDS.E1, source_url: url })))); await E.run('commit')
    await C.begin('service_role')
    const real = lastNum(await C.run(callSql(jobPayload(`R7c${tag}`, { channel: 'crawler_topcv', source_url: url })))); await C.run('commit')
    if (patched) assert.notEqual(real, sq, 'R7: 선점해도 수집 공고는 새 공고로 등록됨')
    else assert.equal(real, sq, 'R7(적용 전): 수집 공고가 선점한 공고의 중복으로 사라짐 — 재현')
  }
  // ── R8 권한: 다른 계정·다른 회사 데이터는 어떤 경로로도 못 고침(적용 전후 같다) ──
  {
    const E1 = sess('E1'), E2 = sess('E2'), S = sess('S'), N = sess('N')
    await E1.begin('authenticated', IDS.E1)
    const id = lastNum(await E1.run(callSql(jobPayload(`R8${tag}`, { employer_id: IDS.E1, salary: '10 triệu' })))); await E1.run('commit')
    const salary = () => q(`select salary from public.local_jobs where id = ${id}`)
    await E2.begin('authenticated', IDS.E2)
    assert.equal((await E2.run(`update public.local_jobs set salary = '1' where id = ${id} returning id;`)).trim(), '', 'R8: 다른 회사 기업의 직접 수정은 0행')
    const viaIngest = await E2.run(callSql({ channel: 'employer', source_text: `x R8${tag}`, job_id: id, update_fields: ['salary'], salary: '2' }))
    assert.equal(salary(), '10 triệu', `R8: 다른 회사 기업이 입구로도 못 고침 (${errText(viaIngest) || 'RLS로 0행'})`)
    await E2.run('rollback')
    await S.begin('authenticated', IDS.S1)
    assert.equal((await S.run(`update public.local_jobs set salary = '3' where id = ${id} returning id;`)).trim(), '', 'R8: 구직자 계정 수정 0행')
    await S.run('rollback')
    await N.begin('anon')
    assert.match(await N.run(`update public.local_jobs set salary = '4' where id = ${id};`), /permission denied/, 'R8: 비로그인은 수정 권한 없음')
    await N.run('rollback')
    await E1.begin('authenticated', IDS.E1)
    assert.match(await E1.run(`update public.local_jobs set origin = 'admin' where id = ${id};`), /permission denied/, 'R8: 기업은 origin 칸을 못 고침')
    await E1.run('rollback'); await E1.begin('authenticated', IDS.E1)
    assert.match(await E1.run(`update public.local_jobs set employer_id = '${IDS.E2}' where id = ${id};`), /permission denied/, 'R8: 기업은 소유자(employer_id)를 못 바꿈')
    await E1.run('rollback')
    for (const ch of ['crawler_topcv', 'admin', 'sql_file', 'lee_confirmed']) {
      await E1.begin('authenticated', IDS.E1)
      assert.match(await E1.run(callSql({ channel: ch, source_text: `x ${ch}${tag}`, company: 'c', title: 't' })), /ERROR:.*(수집 경로는 서버만|관리자 경로는 관리자만|승인된 DB 작업만)/, `R8: 기업 계정의 ${ch} 경로 사칭 거부`)
      await E1.run('rollback')
    }
  }
  // ── R10 같은 source_url에 내용이 다른 글이 동시에 들어온다(수집 두 번·내용이 고쳐진 재수집) — 공고 둘이 생기거나 잘못 갱신되면 안 된다 ──
  {
    const url = `https://src.example/r10-${tag}`
    const a = jobPayload(`R10${tag}`, { channel: 'crawler_topcv', source_url: url, source_text: `원문 버전1 ${tag}`, salary: '8 triệu' })
    const b = { ...a, source_text: `원문 버전2 ${tag}`, salary: '9 triệu' }
    const r = await raceCall({ a: { ...CRAWLER, p: a }, b: { ...CRAWLER, p: b } })
    const n = count(`source_url = '${url}'`)
    if (patched) { assert.ok(r.blocked, 'R10: 같은 원문 주소의 동시 요청은 DB 잠금에서 순서대로'); assert.equal(n, 1, 'R10: 공고 1개'); assert.equal(r.idB, r.idA, 'R10: 뒤 요청은 같은 공고 번호') }
    else assert.equal(n, 2, 'R10(적용 전): 같은 원문 주소 공고가 2개로 등록됨 — 경쟁 재현')
    // 뒤 요청이 다시 수집(refresh)이면 같은 공고의 칸을 고친다(공고는 여전히 1개, 일부만 바뀐 상태가 없음)
    const url2 = `https://src.example/r10r-${tag}`
    const a2 = jobPayload(`R10r${tag}`, { channel: 'crawler_topcv', source_url: url2, source_text: `원문 A ${tag}`, salary: '8 triệu', title: '제목A' })
    const b2 = { ...a2, source_text: `원문 B ${tag}`, salary: '9 triệu', title: '제목B', refresh: true }
    await raceCall({ a: { ...CRAWLER, p: a2 }, b: { ...CRAWLER, p: b2 } })
    const rows = q(`select count(*) || '/' || max(salary) || '/' || max(title) from public.local_jobs where source_url = '${url2}'`)
    if (patched) assert.equal(rows, '1/9 triệu/제목B', 'R10: 재수집은 같은 공고 한 개를 통째로 고침(공고 1개, 칸이 섞이지 않음)')
    else assert.match(rows, /^2\//, 'R10(적용 전): 공고가 둘로 갈라짐 — 재현')
    // 같은 원문 글의 형제 지점(지점 위치가 다름)은 서로의 중복이 아니다: 동시에 와도 둘 다 독립 공고
    const url3 = `https://src.example/r10b-${tag}`
    const brA = { ...jobPayload(`R10s${tag}`, { channel: 'crawler_topcv', source_url: url3 }), branch_location: 'Chi nhánh A, Bắc Ninh', work_locations: [{ raw_address: 'Chi nhánh A, Bắc Ninh' }] }
    const brB = { ...brA, branch_location: 'Chi nhánh B, Bắc Giang', work_locations: [{ raw_address: 'Chi nhánh B, Bắc Giang' }] }
    const rb = await raceCall({ a: { ...CRAWLER, p: brA }, b: { ...CRAWLER, p: brB } })
    assert.equal(count(`source_url = '${url3}'`), 2, 'R10: 같은 글의 다른 지점은 독립 공고 2개')
    assert.notEqual(rb.idA, rb.idB, 'R10: 지점별 공고 번호가 다름')
    assert.equal(Number(q(`select count(*) from public.job_work_locations w join public.local_jobs j on j.id = w.job_id where j.source_url = '${url3}'`)), 2, 'R10: 지점마다 자기 근무지 줄')
  }
  // ── R11 지점별 독립 공고: 같은 글·같은 지점이 동시에 오면 1개, 같은 글·다른 지점은 서로 기다리지 않고 2개 ──
  {
    const base = { ...jobPayload(`R11${tag}`, { employer_id: IDS.E1 }), branch_location: 'Cơ sở 1, Hà Nội', work_locations: [{ raw_address: 'Cơ sở 1, Hà Nội' }] }
    const same = await raceCall({ a: { ...EMP, p: base }, b: { ...EMP, p: base } })
    const n1 = count(`company = 'CTY R11${tag}'`)
    if (patched) assert.ok(same.blocked && n1 === 1 && same.idB === same.idA, `R11: 같은 글·같은 지점 동시 → 1개(${n1})`)
    else assert.equal(n1, 2, 'R11(적용 전): 같은 지점이 2개로 등록됨 — 경쟁 재현')
    const other = { ...jobPayload(`R11o${tag}`, { employer_id: IDS.E1 }), branch_location: 'Cơ sở 1, Hà Nội', work_locations: [{ raw_address: 'Cơ sở 1, Hà Nội' }] }
    const other2 = { ...other, branch_location: 'Cơ sở 2, Hải Phòng', work_locations: [{ raw_address: 'Cơ sở 2, Hải Phòng' }] }
    const diff = await raceCall({ a: { ...EMP, p: other }, b: { ...EMP, p: other2 } })
    assert.ok(!diff.blocked, 'R11: 다른 지점은 서로 기다리지 않음')
    assert.equal(count(`company = 'CTY R11o${tag}'`), 2, 'R11: 다른 지점은 독립 공고 2개')
  }
  // ── R12 같은 내용 동시 등록 뒤 공고 소유권·관리 토큰·수정·마감 권한이 엉뚱한 쪽으로 넘어가지 않는다(두 순서 모두) ──
  if (patched) {
    const T1 = 'a'.repeat(24), T2 = 'b'.repeat(24)
    const owner = (id) => q(`select coalesce(employer_id::text,'∅') || '/' || coalesce(guest_manage_token,'∅') || '/' || origin || '/' || active from public.local_jobs where id = ${id}`)
    const empEdit = async (sub, id) => { const S = sess('S'); await S.begin('authenticated', sub); const o = (await S.run(`update public.local_jobs set title = '탈취', active = false where id = ${id} returning id;`)).trim(); await S.run('rollback'); return o }
    const guestCall = async (id, tok) => { const G = sess('G'); await G.begin('anon'); const o = (await G.run(`select id from public.update_guest_job(${id}, '${tok}', null, null, null, null, null, null, null, null, false);`)).trim(); await G.run('commit'); return o }
    // (a) 게스트가 먼저 → 기업이 같은 내용 등록
    { const base = jobPayload(`R12a${tag}`); const r = await raceCall({ a: { ...GUEST, p: { ...base, guest_manage_token: T1 } }, b: { ...EMP, p: { ...base, employer_id: IDS.E1 } } })
      assert.equal(r.idB, r.idA); assert.equal(owner(r.idA), `∅/${T1}/employer/true`, 'R12a: 게스트 공고의 소유·토큰이 그대로(기업 등록이 가져가지 못함)')
      assert.equal(await empEdit(IDS.E1, r.idA), '', 'R12a: 뒤에 온 기업은 이 공고를 수정·마감 못 함')
      assert.equal(await guestCall(r.idA, T2), '', 'R12a: 다른 토큰은 관리 못 함'); assert.equal(await guestCall(r.idA, T1), String(r.idA), 'R12a: 게스트 본인 토큰은 관리 가능(마감)') }
    // (b) 기업이 먼저 → 게스트가 같은 내용 등록
    { const base = jobPayload(`R12b${tag}`); const r = await raceCall({ a: { ...EMP, p: { ...base, employer_id: IDS.E1 } }, b: { ...GUEST, p: { ...base, guest_manage_token: T1 } } })
      assert.equal(r.idB, r.idA); assert.equal(owner(r.idA), `${IDS.E1}/∅/employer/true`, 'R12b: 기업 공고에 게스트 토큰이 붙지 않음')
      assert.equal(await guestCall(r.idA, T1), '', 'R12b: 게스트 토큰으로 기업 공고 관리 불가')
      const N = sess('N'); await N.begin('anon'); assert.match(await N.run(`select guest_manage_token from public.local_jobs where id = ${r.idA};`), /permission denied/, 'R12b: 토큰 칸은 비로그인이 읽지 못함'); await N.run('rollback')
      assert.equal(await empEdit(IDS.E2, r.idA), '', 'R12b: 다른 회사 기업은 수정·마감 못 함') }
    // (c) 수집이 먼저 → 기업이 같은 내용 등록 / (d) 기업이 먼저 → 수집이 다시 수집(refresh)
    { const base = jobPayload(`R12c${tag}`); const r = await raceCall({ a: { ...CRAWLER, p: { ...base, channel: 'crawler_topcv' } }, b: { ...EMP, p: { ...base, employer_id: IDS.E1 } } })
      assert.equal(r.idB, r.idA); assert.equal(owner(r.idA), '∅/∅/crawler/true', 'R12c: 수집 공고의 소유가 기업으로 넘어가지 않음')
      assert.equal(await empEdit(IDS.E1, r.idA), '', 'R12c: 기업은 수집 공고를 수정·마감 못 함') }
    { const base = jobPayload(`R12d${tag}`, { salary: '10 triệu' }); const r = await raceCall({ a: { ...EMP, p: { ...base, employer_id: IDS.E1 } }, b: { ...CRAWLER, p: { ...base, channel: 'crawler_topcv', refresh: true, salary: '1 triệu' } } })
      assert.equal(r.idB, r.idA); assert.equal(q(`select salary from public.local_jobs where id = ${r.idA}`), '10 triệu', 'R12d: 수집 재수집이 기업 공고를 덮어쓰지 못함')
      assert.equal(owner(r.idA), `${IDS.E1}/∅/employer/true`, 'R12d: 소유 그대로') }
    // (e) 서로 다른 기업 둘이 같은 내용을 동시에: 먼저 확정된 쪽이 소유, 뒤 기업은 같은 번호를 받지만 수정 권한 없음
    { const base = jobPayload(`R12e${tag}`); const r = await raceCall({ a: { ...EMP, p: { ...base, employer_id: IDS.E1 } }, b: { role: 'authenticated', sub: IDS.E2, p: { ...base, employer_id: IDS.E2 } } })
      assert.equal(r.idB, r.idA); assert.equal(owner(r.idA), `${IDS.E1}/∅/employer/true`, 'R12e: 먼저 등록한 기업이 소유')
      assert.equal(await empEdit(IDS.E2, r.idA), '', 'R12e: 뒤 기업은 수정·마감 못 함') }
  }
  // ── R9 입구 도중 실패(근무지 저장 실패) → 공고·원문 기록 모두 취소 ──
  {
    const E = sess('E')
    await E.begin('authenticated', IDS.E1)
    const out = await E.run(callSql(jobPayload(`R9${tag}`, { employer_id: IDS.E1, work_locations: [{ raw_address: 'x', fail: true }] })))
    assert.ok(isErr(out), 'R9: 근무지 저장 실패는 오류로 돌아옴')
    await E.run('rollback')
    assert.equal(count(`company = 'CTY R9${tag}'`), 0, 'R9: 공고가 남지 않음')
    assert.equal(Number(q(`select count(*) from public.job_ingest_raw where submitted->>'company' = 'CTY R9${tag}'`)), 0, 'R9: 원문 기록도 남지 않음')
  }
}

try {
  await suite(false)
  console.log('적용 전: 경쟁·덮어쓰기·주소 선점이 실제로 재현됨')
  db.admin(mig('20261126010000_ingest_write_guard.sql'))
  await suite(true)
  console.log('ingest_write_guard.concurrent: 실제 연결 2개 이상 동시 요청 시험 통과 (적용 전 재현 → 적용 후 차단)')
} finally {
  opened.forEach((s) => { try { s.close() } catch {} })
  db.drop()
}
