// 20261126020000_job_apply_and_contact_gate.sql — 실제 PostgreSQL 연결 2개 이상 동시 요청·권한(RLS) 시험(통합 운영 정상화 J그룹 2순위, Lee 2026-11-26). 운영 DB 접속 없음.
// 실행: PG_TEST_URL=<폐기용 DB> node supabase/tests/job_apply_and_contact_gate.concurrent.mjs  (CI는 check-postgres-migrations.sh가 이름 규칙 <이름>.concurrent.mjs로 호출)
// migration '적용 전'(재현)·'적용 후'(차단) 한 번씩. 역할(anon·authenticated·service_role)·auth.uid()·RLS·열 권한은 migration 파일 그대로 올린 실제 정의 위에서 돈다.
import assert from 'node:assert/strict'
import { makeScratch, mig, IDS, jobPayload, callSql, settled, isErr, lastNum, errText } from './lib/pg-race.mjs'

const db = await makeScratch()
const opened = []
const sess = (n) => { const s = db.sess(n); opened.push(s); return s }
const q = (sql) => db.scalar(sql)
const step = (s) => { if (process.env.RACE_TRACE) console.error('·', s) }
const EMP = ['authenticated', IDS.E1]

// 공개 중인 기업 공고 하나를 입구로 등록(실제 등록 경로)
async function newJob(tag, o = {}, sub = IDS.E1) {
  const E = sess('seed'); await E.begin('authenticated', sub)
  const id = lastNum(await E.run(callSql(jobPayload(tag, { employer_id: sub, ...o })))); await E.run('commit'); E.close()
  assert.ok(id > 0, `공고 준비 실패(${tag})`)
  return id
}
const applySql = (id, seeker = IDS.S1, employer = IDS.E1) =>
  `insert into public.applications(job_id, seeker_id, employer_id, status) values (${id}, '${seeker}', '${employer}', 'submitted') returning id;`
const appCount = (id) => Number(q(`select count(*) from public.applications where job_id = ${id}`))

async function suite(patched) {
  const tag = patched ? '후' : '전'
  // ── A1 마감(수정)과 지원이 겹침: 기업이 닫는 중(미확정)에 구직자가 지원 ──
  {
    step('A1')
    const id = await newJob(`A1${tag}`)
    const E = sess('E'), S = sess('S')
    await E.begin(...EMP); await S.begin('authenticated', IDS.S1)
    const sPid = await S.pid()
    assert.ok(!isErr(await E.run(`update public.local_jobs set active = false where id = ${id};`)), 'A1: 기업이 공고를 닫음(미확정)')
    const pS = S.run(applySql(id))
    const early = await settled(pS)
    const blocked = early === null && db.isWaiting(sPid)
    await E.run('commit')
    const outS = early ? early[0] : await pS
    await S.run(isErr(outS) ? 'rollback' : 'commit')
    if (patched) {
      assert.ok(blocked, 'A1: 지원 저장이 공고 행 잠금에서 기다림(닫는 수정과 순서대로 처리)')
      assert.match(outS, /마감·숨김 공고에는 새로 지원할 수 없음/, 'A1: 닫힌 공고 지원은 거부')
      assert.equal(appCount(id), 0, 'A1: 지원 기록이 남지 않음')
    } else {
      assert.ok(!blocked && !isErr(outS), 'A1(적용 전): 닫는 중에도 지원이 저장됨')
      assert.equal(appCount(id), 1, 'A1(적용 전): 닫힌 공고에 지원이 쌓임 — 재현')
    }
  }
  // ── A2 지원이 먼저(미확정) → 닫는 수정이 순서대로: 이미 낸 지원은 남는다 ──
  {
    step('A2')
    const id = await newJob(`A2${tag}`)
    const E = sess('E'), S = sess('S')
    await S.begin('authenticated', IDS.S1); await E.begin(...EMP)
    const ePid = await E.pid()
    assert.ok(!isErr(await S.run(applySql(id))), 'A2: 지원 저장(미확정)')
    const pE = E.run(`update public.local_jobs set active = false where id = ${id};`)
    const early = await settled(pE)
    const blocked = early === null && db.isWaiting(ePid)
    await S.run('commit'); if (!early) await pE; await E.run('commit')
    assert.equal(appCount(id), 1, 'A2: 먼저 낸 지원은 남음')
    assert.equal(q(`select active from public.local_jobs where id = ${id}`), 'f', 'A2: 공고는 닫힘')
    if (patched) assert.ok(blocked, 'A2: 닫는 수정이 진행 중 지원 저장을 기다림')
    else assert.ok(!blocked, 'A2(적용 전): 서로 기다리지 않음(순서 보장 없음)')
  }
  // ── A3 오래된 화면 상태(열려 있다고 본 뒤 이미 닫힘)로 지원 ──
  {
    step('A3')
    const id = await newJob(`A3${tag}`)
    const E = sess('E'), S = sess('S')
    await E.begin(...EMP); await E.run(`update public.local_jobs set active = false where id = ${id};`); await E.run('commit')
    await S.begin('authenticated', IDS.S1)
    const out = await S.run(applySql(id)); await S.run(isErr(out) ? 'rollback' : 'commit')
    if (patched) { assert.match(out, /마감·숨김 공고에는 새로 지원할 수 없음/, 'A3: 닫힌 공고는 DB가 거부'); assert.equal(appCount(id), 0) }
    else assert.equal(appCount(id), 1, 'A3(적용 전): 닫힌 공고에 지원 저장 — 재현')
  }
  // ── A4 마감일 지남 / 마감일 오늘(열림) / 관리자 숨김 ──
  {
    step('A4')
    const past = await newJob(`A4p${tag}`, { application_deadline: '2020-01-01' })
    const today = await newJob(`A4t${tag}`, { application_deadline: q(`select (now() at time zone 'Asia/Ho_Chi_Minh')::date`) })
    const hidden = await newJob(`A4h${tag}`)
    db.admin(`update public.local_jobs set admin_hidden = true where id = ${hidden}`)
    const S = sess('S')
    for (const [id, name, shouldOpen] of [[past, '마감일 지남', !patched], [today, '마감일 오늘', true], [hidden, '관리자 숨김(기존 RLS가 이미 막음 — 새 트리거는 같은 기준의 두 번째 장치)', false]]) {
      await S.begin('authenticated', IDS.S1)
      const out = await S.run(applySql(id)); await S.run(isErr(out) ? 'rollback' : 'commit')
      assert.equal(!isErr(out), shouldOpen, `A4: ${name} → ${shouldOpen ? '지원 저장됨' : '지원 거부'} (${errText(out)})`)
    }
  }
  // ── A5 지원 내역 보존·본인만 조회·삭제 ──
  {
    step('A5')
    const id = await newJob(`A5${tag}`)
    const S1 = sess('S1'), S2 = sess('S2'), E = sess('E')
    await S1.begin('authenticated', IDS.S1); await S1.run(applySql(id)); await S1.run('commit')
    await E.begin(...EMP); await E.run(`update public.local_jobs set active = false where id = ${id};`); await E.run('commit')
    await S1.begin('authenticated', IDS.S1)
    assert.equal((await S1.run(`select count(*) from public.applications where job_id = ${id};`)).trim(), '1', 'A5: 공고가 닫힌 뒤에도 본인 지원 내역은 보임')
    await S1.run('rollback')
    await S2.begin('authenticated', IDS.S2)
    assert.equal((await S2.run(`select count(*) from public.applications where job_id = ${id};`)).trim(), '0', 'A5: 다른 구직자는 못 봄')
    await S2.run('rollback'); await S1.begin('authenticated', IDS.S1)
    assert.equal((await S1.run(`delete from public.applications where job_id = ${id} returning id;`)).trim() !== '', true, 'A5: 본인은 자기 지원 삭제(취소) 가능')
    await S1.run('commit')
  }
  // ── A6 지원 권한(RLS): 다른 사람 이름으로·다른 기업으로·정지 계정·기업 계정·비로그인, 같은 사람의 동시 중복 지원 ──
  {
    step('A6')
    const id = await newJob(`A6${tag}`)
    const S = sess('S'), N = sess('N')
    const denied = async (role, sub, sql, label) => { await S.begin(role, sub); const o = await S.run(sql); await S.run('rollback'); assert.ok(isErr(o), `A6: ${label} 거부 (${errText(o)})`) }
    await denied('authenticated', IDS.S1, applySql(id, IDS.S2), '다른 구직자 이름으로 지원')
    await denied('authenticated', IDS.S1, applySql(id, IDS.S1, IDS.E2), '다른 기업(employer_id 위조)으로 지원')
    await denied('authenticated', IDS.S3, applySql(id, IDS.S3), '정지 계정 지원')
    // (참고: 기업 계정의 지원은 20261128060000_applications_insert_not_employer로 거절된다 — 시험은 applications_insert_not_employer.pglite.test.mjs·격리 스택 E2E AP5)
    await N.begin('anon'); assert.match(await N.run(applySql(id)), /permission denied/, 'A6: 비로그인 지원 거부'); await N.run('rollback')
    // 같은 사람이 두 연결에서 동시에 같은 공고 지원(이중 클릭·웹+앱): 하나만 저장
    const A = sess('A'), B = sess('B')
    await A.begin('authenticated', IDS.S1); await B.begin('authenticated', IDS.S1)
    const bPid = await B.pid()
    assert.ok(!isErr(await A.run(applySql(id))), 'A6: 첫 지원 저장(미확정)')
    const pB = B.run(applySql(id)); const early = await settled(pB)
    assert.ok(early === null && db.isWaiting(bPid), 'A6: 같은 사람의 두 번째 지원이 첫 지원 확정을 기다림')
    await A.run('commit'); const outB = await pB; await B.run('rollback')
    assert.match(outB, /duplicate key|applications_job_id_seeker_id_key/, 'A6: 중복 지원 거부')
    assert.equal(appCount(id), 1, 'A6: 지원은 정확히 1건')
  }
  // ── A7 웹·앱이 같은 공고를 동시에 수정: 다른 칸은 둘 다 남고, 같은 칸은 마지막 확정이 이김(일부 저장 없음) ──
  {
    step('A7')
    const id = await newJob(`A7${tag}`)
    const W = sess('W'), P = sess('P')
    await W.begin(...EMP); await P.begin(...EMP)
    const pPid = await P.pid()
    await W.run(`update public.local_jobs set title = '웹 제목' where id = ${id};`)
    const pP = P.run(`update public.local_jobs set salary = '앱 급여' where id = ${id};`)
    const early = await settled(pP)
    assert.ok(early === null && db.isWaiting(pPid), 'A7: 같은 공고 행의 동시 수정은 순서대로(뒤가 기다림)')
    await W.run('commit'); await pP; await P.run('commit')
    assert.equal(q(`select title || '/' || salary from public.local_jobs where id = ${id}`), '웹 제목/앱 급여', 'A7: 다른 칸 수정은 둘 다 남음(서로 덮어쓰지 않음)')
  }
  // ── A8 연락처·주소 보호: 공개 중인 기업 공고에서 연락처(전화)·주소 글자를 모두 없애는 수정 ──
  {
    step('A8')
    const id = await newJob(`A8${tag}`)
    const A = sess('A'), B = sess('B')
    await A.begin(...EMP); await B.begin(...EMP)
    // 두 연결이 같은 공고에서 동시에 '전화 지우기'·'주소 지우기'(각각 한 칸씩 — 둘 다 성공하면 연락처·주소 둘 다 없는 공개 공고가 됨)
    const outA = await A.run(`update public.local_jobs set employer_phone = null where id = ${id};`)
    const pB = B.run(`update public.local_jobs set location = null where id = ${id};`) // A가 확정 전이면 같은 행 잠금으로 B가 기다린다
    const early = await settled(pB, 1200)
    await A.run(isErr(outA) ? 'rollback' : 'commit')
    const outB = early ? early[0] : await pB
    await B.run(isErr(outB) ? 'rollback' : 'commit')
    const row = q(`select coalesce(employer_phone,'∅') || '/' || coalesce(location,'∅') || '/' || active from public.local_jobs where id = ${id}`)
    if (patched) {
      assert.match(outA, /공개 중인 공고에서 연락처·주소를 없앨 수 없음/, `A8: 전화 지우기 거부 (${errText(outA)})`)
      assert.match(outB, /공개 중인 공고에서 연락처·주소를 없앨 수 없음/, `A8: 주소 지우기 거부 (${errText(outB)})`)
      assert.equal(row, '0912345678/KCN Yên Phong, Bắc Ninh/true', 'A8: 연락처·주소가 그대로')
    } else {
      assert.ok(!isErr(outA) && !isErr(outB), 'A8(적용 전): 둘 다 지워짐')
      assert.equal(row, '∅/∅/true', 'A8(적용 전): 연락처·주소 없는 공개 공고 — 재현')
    }
  }
  // ── A9 허용되는 수정은 그대로: 연락처를 다른 번호로 바꾸기, 공고 닫으면서 비우기, 수집·관리자 공고 규칙(기존 그대로) ──
  {
    step('A9')
    const id = await newJob(`A9${tag}`)
    const E = sess('E'); await E.begin(...EMP)
    assert.ok(!isErr(await E.run(`update public.local_jobs set employer_phone = '0977000111' where id = ${id};`)), 'A9: 연락처 변경은 허용')
    assert.ok(!isErr(await E.run(`update public.local_jobs set active = false, employer_phone = null where id = ${id};`)), 'A9: 닫으면서 비우기는 허용(공개가 아니게 됨)')
    await E.run('commit')
    const id2 = await newJob(`A9b${tag}`, { employer_phone: null, contact_zalo: null })
    await E.begin(...EMP)
    assert.ok(!isErr(await E.run(`update public.local_jobs set title = '제목만 수정' where id = ${id2};`)), 'A9: 이미 연락처가 비어 있던 옛 공고의 다른 칸 수정은 허용')
    await E.run('commit')
  }
}

// ── 공개 판정 트리거 함수(enforce_job_publish_gate)를 definer로 바꾼 것의 권한 범위 — 실제 역할로 확인(적용 후에만) ──
async function definerScope() {
  const sql = (x) => db.scalar(x)
  // 소유자·definer·search_path·실행 권한(PUBLIC·anon·authenticated 없음)
  assert.equal(sql(`select p.prosecdef::text || '/' || pg_get_userbyid(p.proowner) || '/' || coalesce(array_to_string(p.proconfig, ','), '') from pg_proc p where p.oid = 'public.enforce_job_publish_gate()'::regprocedure`), 'true/postgres/search_path=pg_catalog, public', '소유자 postgres·definer·search_path 고정')
  assert.equal(sql(`select count(*) from pg_proc p, aclexplode(coalesce(p.proacl, acldefault('f', p.proowner))) a where p.oid = 'public.enforce_job_publish_gate()'::regprocedure and a.privilege_type = 'EXECUTE' and (a.grantee = 0 or a.grantee in (select oid from pg_roles where rolname in ('anon', 'authenticated')))`), '0', 'PUBLIC·anon·authenticated는 직접 실행 권한 없음')
  const S = sess('D')
  for (const [role, sub] of [['anon'], ['authenticated', IDS.E1], ['service_role']]) {
    await S.begin(role, sub)
    const out = await S.run(`select public.enforce_job_publish_gate();`); await S.run('rollback')
    assert.ok(isErr(out), `${role}: 트리거 함수를 직접 부를 수 없음 (${errText(out)})`)
    if (role === 'service_role') continue // 서버 키의 판정 함수 직접 실행은 20261101190000부터 있던 상태(이 PR이 바꾸지 않음)
    await S.begin(role, sub)
    const out2 = await S.run(`select public.job_publish_gate_reason(l) from public.local_jobs l limit 1;`); await S.run('rollback')
    assert.match(out2, /permission denied/, `${role}: 판정 계산 함수도 직접 부를 수 없음(트리거 안에서만 쓰임)`)
  }
  // 호출 경로: 기업이 자기 공고를 고칠 때만 도는 트리거 — 남의 공고·id 바꾸기·소유자 바꾸기·origin 바꾸기는 definer여도 열리지 않음
  const mine = await newJob('D1'); const others = await newJob('D2', { employer_id: IDS.E2 }, IDS.E2)
  const E = sess('E')
  await E.begin('authenticated', IDS.E1)
  assert.equal((await E.run(`update public.local_jobs set title = 'x' where id = ${others} returning id;`)).trim(), '', 'definer여도 남의 공고 수정은 RLS가 막음')
  await E.run('rollback'); await E.begin('authenticated', IDS.E1)
  assert.match(await E.run(`update public.local_jobs set id = ${others + 1000} where id = ${mine};`), /permission denied|can only be updated to DEFAULT/, 'id는 못 바꿈(근무지 행을 남의 번호로 읽게 만드는 길 없음)')
  await E.run('rollback'); await E.begin('authenticated', IDS.E1)
  assert.match(await E.run(`update public.local_jobs set employer_id = '${IDS.E2}' where id = ${mine};`), /permission denied/, '소유자 못 바꿈')
  await E.run('rollback')
  // 근무지 행은 RLS 없이 읽지만 결과(공개 판정 값)는 자기 공고 한 줄에만 기록 — 남의 근무지 유무가 새지 않음
  db.admin(`insert into public.job_work_locations(job_id, raw_address, normalized_address) values (${others}, 'x', 'x')`)
  await E.begin('authenticated', IDS.E1)
  assert.ok(!isErr(await E.run(`update public.local_jobs set title = '내 공고 수정' where id = ${mine};`)), '자기 공고 수정은 그대로')
  await E.run('commit')
  assert.equal(sql(`select coalesce(publish_gate_reason,'∅') from public.local_jobs where id = ${mine}`), 'ok', '자기 공고 판정값만 기록')
  // search_path 바꿔치기: public에 같은 이름 함수를 만들어도(최악 가정) pg_catalog가 먼저라 판정이 속지 않음
  db.admin(`create function public.regexp_replace(text, text, text, text) returns text language sql as $$ select '0123456789' $$`)
  try {
    const id = await newJob('D3')
    await E.begin(...EMP)
    assert.match(await E.run(`update public.local_jobs set employer_phone = null where id = ${id};`), /공개 중인 공고에서 연락처·주소를 없앨 수 없음/, '가짜 public 함수가 있어도 판정이 속지 않음')
    await E.run('rollback')
  } finally { db.admin(`drop function public.regexp_replace(text, text, text, text)`) }
  // 수집 경로 판정은 그대로(연락처 없는 수집 공고는 비공개로 저장)
  const C = sess('C'); await C.begin('service_role')
  const cid = lastNum(await C.run(callSql(jobPayload('D4', { channel: 'crawler_topcv', employer_phone: null })))); await C.run('commit')
  assert.equal(sql(`select active::text || '/' || publish_gate_reason from public.local_jobs where id = ${cid}`), 'false/no_application_path', '수집 공고의 연락처 없음 → 비공개 규칙 그대로')
}

try {
  await suite(false)
  console.log('적용 전: 닫힌 공고 지원 저장·연락처/주소 삭제가 실제로 재현됨')
  db.admin(mig('20261126020000_job_apply_and_contact_gate.sql'))
  await suite(true)
  await definerScope()
  console.log('job_apply_and_contact_gate.concurrent: 실제 연결 2개 이상 동시 요청·권한 시험 통과 (적용 전 재현 → 적용 후 차단)')
} finally {
  opened.forEach((s) => { try { s.close() } catch {} })
  db.drop()
}
