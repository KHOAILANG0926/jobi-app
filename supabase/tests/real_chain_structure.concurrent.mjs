// 실제 migration 전체(위치 저장 함수·위치/직업분류/중복 보류/공개 판정 트리거 포함)를 올린 시험용 DB에서 하는 검증 — 통합 운영 정상화 2·3순위(Lee 2026-11-26).
// 실행: PG_TEST_URL=<폐기용 서버> node supabase/tests/real_chain_structure.concurrent.mjs   (운영 DB 접속 없음, 서버 안에 시험용 DB를 새로 만들고 지움)
// ※ 이 시험은 check-postgres-migrations.sh의 '바뀐 migration 이름 규칙'에 걸리는 파일이 아니라(새 migration이 없다) 자동으로 호출되지 않는다 — 손으로 위 명령을 쓴다.
// 이미 통과한 시험(ingest_write_guard·job_apply_and_contact_gate .concurrent: 같은 내용 동시 등록·소유권·마감 대 지원 등)은 반복하지 않는다. 여기는 그 시험이 대역으로 둔 것만 본다:
//  G1 실제 위치 저장 함수(replace_job_work_locations → location_private.write_location)와 역할별 권한
//  G2 직업분류·공개 게이트·중복 보류·위치 트리거가 함께 있을 때 등록·수정·마감·지원·공개 상호 영향
//  G3 크롤러·기업·관리자 갱신 충돌   G4 웹·앱 동시 수정(전역 잠금·잠금 순서 역전)   G5 SECURITY DEFINER 전수 점검
// 대역 사용(시험 대상 아님): 운영 이전 기반 표·열, pg_net/pg_cron/vault/storage 대역, 위치 찾기 큐 표·map_r1_snapshot·map_r1_public_points 대역(pg-chain.mjs BASE) — 위치 저장 함수·트리거는 대역 아님.
import assert from 'node:assert/strict'
import { makeChain } from './lib/pg-chain.mjs'
import { IDS, jobPayload, callSql, lastNum, errText, isErr, settled, sleep } from './lib/pg-race.mjs'

const c = await makeChain()
const opened = []
const sess = (n) => { const s = c.sess(n); opened.push(s); return s }
const ADM_CLAIMS = { app_metadata: { role: 'admin' } }
const findings = [], defects = []
const note = (m) => { findings.push(m); console.log('FINDING:', m) }
// 결함: 안전해야 하는 동작이 실제로는 안 지켜지는 것을 재현한 경우. 이 시험은 migration을 고치지 않으므로(DB 구조·권한 변경은 대표 승인 대상) 재현 결과를 크게 남기고 통과시키되,
// 고친 뒤에는 STRICT_DEFECTS=1로 돌리면 아직 재현되는 결함이 있을 때 실패한다(고쳐지면 자동으로 '안전' 쪽 단언으로 바뀜).
const defect = (m) => { defects.push(m); console.log('DEFECT(재현됨):', m) }
try {
  // ── 0. 구조: 못 올라간 migration은 알려진 4개뿐(korea 계열 3 + 운영 데이터 상태를 전제하는 다중지점 전환 1 — 순서가 어긋난 20261107172459는 applyMigrations의 재시도로, 운영 이전 표는 승인 대기 SQL 적용으로 올라감) — 새로 실패하는 파일이 생기면 시험이 실패한다 ──
  assert.deepEqual(c.failed.map((f) => f[0]), [
    '0012_korea_jobs_expand.sql', '0013_korea_jobs_public_views_grants_fix.sql', '0014_korea_jobs_vi_translation.sql',
    '20261124120000_multi_branch_conversion.sql'], `예상 밖 migration 실패: ${JSON.stringify(c.failed)}`)
  for (const f of ['public.replace_job_work_locations(bigint,jsonb)', 'location_private.write_location(bigint,text,jsonb)', 'public.ingest_job(jsonb)', 'dedupe_private.hold_on_publish()',
    'public.enforce_job_publish_gate()', 'public.enforce_occupation_publication()', 'public.applications_job_open_gate()', 'ingest_private.find_existing(bigint,text,text,text,text,text,text)']) {
    assert.ok(c.has(`to_regprocedure('${f}') is not null`), `실제 정의가 올라와 있어야 함: ${f}`)
  }
  for (const t of ['trg_000_ingest_gateway_only', 'trg_00_canonical_gate', 'trg_01_canonical_job_identity', 'trg_02_administrative_pin', 'trg_zz0_publish_gate', 'trg_zzzz_occupation_publication', 'trg_zzzzz_duplicate_hold', 'trg_zzz_inspect_current']) {
    assert.ok(c.has(`exists (select 1 from pg_trigger where tgrelid = 'public.local_jobs'::regclass and tgname = '${t}')`), `트리거 ${t}`)
  }
  c.admin(`insert into auth.users(id) values ('${IDS.E1}'),('${IDS.E2}'),('${IDS.S1}'),('${IDS.ADM}') on conflict do nothing;
    insert into public.account_statuses(user_id,status) values ('${IDS.E1}','active'),('${IDS.E2}','active'),('${IDS.S1}','active'),('${IDS.ADM}','active') on conflict (user_id) do update set status='active';
    insert into public.account_roles(user_id,role) values ('${IDS.E1}','employer'),('${IDS.E2}','employer'),('${IDS.S1}','seeker'),('${IDS.ADM}','seeker') on conflict (user_id) do update set role=excluded.role;`)

  const OCC = { occupation_code: '82022', occupation_evidence: 'làm linh kiện tai nghe' }
  const text = (tag) => `CTY ${tag} tuyển làm linh kiện tai nghe tại KCN Yên Phong`           // 회사 이름이 원문에 있어야 하는 규칙(R5)
  const job = (tag, o = {}) => jobPayload(tag, { source_text: text(tag), description: 'Công nhân lắp ráp linh kiện tai nghe tại nhà máy, làm theo ca', ...OCC, ...o })
  const reg = async (role, sub, p, claims) => { const S = sess('reg'); await S.begin(role, sub, claims); const out = await S.run(callSql(p)); await S.run(isErr(out) ? 'rollback' : 'commit'); S.close(); return out }
  const state = (id) => c.scalar(`select origin||' active='||active||' hidden='||admin_hidden||' hold='||coalesce(ocr_check->>'inspect_hold','-') from public.local_jobs where id=${id}`)
  // 검사기가 하는 일: 지금 내용의 검사 통과 기록을 적고 공개(기계 계정 + 관리자 판정 — 공개 전 정책 검토 'review'는 관리자가 통과시킨다)
  const publish = (id) => c.admin(`select set_config('request.jwt.claim.sub','${IDS.ADM}',false), set_config('request.jwt.claims','{"app_metadata":{"role":"admin"}}',false);
    update public.local_jobs l set ocr_check = coalesce(ocr_check,'{}'::jsonb) || jsonb_build_object('inspect', jsonb_build_object('content_hash', public.job_inspect_content_hash(l), 'publishable', true)), active = true where id = ${id};`)
  const wl = [{ raw_address: 'Lô A, KCN Yên Phong, Bắc Ninh' }]

  // ── G1 실제 위치 저장 함수·권한 ──
  {
    const idC = lastNum(await reg('service_role', null, job('g1c', { channel: 'crawler_topcv', source_url: 'https://src.example/g1c', work_locations: wl })))
    assert.ok(idC > 0, 'G1: 수집(service_role)은 실제 위치 저장 함수로 근무지까지 등록')
    assert.equal(c.scalar(`select count(*) || ' ' || string_agg(point_kind || '/' || point_authority, ',') from public.job_work_locations where job_id = ${idC}`), '1 unresolved/unresolved', 'G1: 위치 못 찾은 근무지는 확정 좌표 없이 unresolved로만 저장(대략 위치 없음)')
    assert.equal(c.scalar(`select count(*) from public.job_work_locations where job_id = ${idC} and lat is not null`), '0', 'G1: 좌표를 지어내지 않음')
    // 기업·게스트·관리자 경로는 근무지를 보낼 수 없다 — 실제 함수는 service_role만 실행 가능, 요청 전체가 되돌려져 일부 저장 없음
    const before = c.scalar(`select (select count(*) from public.local_jobs) || '/' || (select count(*) from public.job_ingest_raw) || '/' || (select count(*) from public.job_work_locations)`)
    for (const [lab, role, sub, extra] of [['기업', 'authenticated', IDS.E1, { employer_id: IDS.E1 }], ['게스트', 'anon', null, { guest_manage_token: 'g'.repeat(24) }]]) {
      const out = await reg(role, sub, job('g1' + lab, { work_locations: wl, ...extra }))
      assert.match(out, /permission denied for function replace_job_work_locations/, `G1: ${lab} 경로의 근무지 저장은 거부`)
    }
    assert.equal(c.scalar(`select (select count(*) from public.local_jobs) || '/' || (select count(*) from public.job_ingest_raw) || '/' || (select count(*) from public.job_work_locations)`), before, 'G1: 거부된 요청은 공고·원문 기록·근무지를 하나도 남기지 않음')
    for (const [role, sub] of [['authenticated', IDS.E1], ['anon', null]]) {
      const S = sess('d'); await S.begin(role, sub)
      assert.match(await S.run(`select public.replace_job_work_locations(${idC}, '[]'::jsonb);`), /permission denied/, `G1: ${role}가 저장 함수 직접 호출 거부`); await S.run('rollback')
      await S.begin(role, sub)
      assert.match(await S.run(`insert into public.job_work_locations(job_id, raw_address) values (${idC}, 'x');`), /permission denied|row-level security/, `G1: ${role}가 근무지 표에 직접 쓰기 거부`); await S.run('rollback')
      await S.begin(role, sub)
      assert.match(await S.run(`update public.job_work_locations set lat = 21.0, lng = 106.0 where job_id = ${idC};`), /permission denied|row-level security/, `G1: ${role}가 근무지 좌표 직접 수정 거부`); await S.run('rollback')
      await S.begin(role, sub)
      assert.match(await S.run(`select location_private.company_identity('x');`), /permission denied for schema location_private/, `G1: ${role}는 위치 비공개 스키마를 못 씀`); await S.run('rollback')
    }
    // 기업 공고에는 서버 키로도 못 씀(수집 공고 전용)
    const idE = lastNum(await reg('authenticated', IDS.E1, job('g1e', { employer_id: IDS.E1 })))
    const K = sess('k'); await K.begin('service_role')
    assert.match(await K.run(`select public.replace_job_work_locations(${idE}, '[]'::jsonb);`), /crawler only/, 'G1: 수집 공고가 아니면 서버 키도 거부'); await K.run('rollback')
  }

  // ── G2 등록·수정·마감·지원·공개 상호 영향(실제 트리거 전부) ──
  let pub
  {
    const out = await reg('authenticated', IDS.E1, job('g2', { employer_id: IDS.E1 }))
    pub = lastNum(out); assert.ok(pub > 0, errText(out))
    assert.match(state(pub), /^employer active=false hidden=false/, 'G2: 기업 등록은 검사 통과 기록·정책 검토가 끝나기 전까지 비공개 — 공개 요청(active:true)을 보냈어도')
    // 검사 통과 전에 기업이 켜려 해도 안 켜짐
    let E = sess('e'); await E.begin('authenticated', IDS.E1)
    assert.ok(!isErr(await E.run(`update public.local_jobs set active = true where id = ${pub};`))); await E.run('commit')
    assert.match(state(pub), /active=false/, 'G2: 기업이 직접 켜도 검사 통과 기록 없이는 공개되지 않음')
    // 지원도 비공개 공고에는 못 함
    let S = sess('s'); await S.begin('authenticated', IDS.S1)
    assert.match(await S.run(`insert into public.applications(job_id, seeker_id, employer_id, status) values (${pub}, '${IDS.S1}', '${IDS.E1}', 'submitted');`), /row-level security|마감·숨김/, 'G2: 비공개(검사 대기) 공고에는 지원 못 함'); await S.run('rollback')
    publish(pub)
    assert.match(state(pub), /active=true/, 'G2: 검사 통과 기록 + 공개 → 공개')
    // 공개 후 지원 → 기업 마감 → 새 지원 거부, 기존 지원 보존·양쪽에서 조회
    S = sess('s'); await S.begin('authenticated', IDS.S1)
    assert.ok(!isErr(await S.run(`insert into public.applications(job_id, seeker_id, employer_id, status) values (${pub}, '${IDS.S1}', '${IDS.E1}', 'submitted');`)), 'G2: 공개 공고 지원 성공'); await S.run('commit')
    E = sess('e'); await E.begin('authenticated', IDS.E1)
    assert.ok(!isErr(await E.run(`update public.local_jobs set active = false where id = ${pub};`)), 'G2: 기업 마감'); await E.run('commit')
    assert.match(state(pub), /active=false/)
    const S3 = sess('s3'); await S3.begin('authenticated', IDS.S1)
    assert.equal((await S3.run(`select count(*) from public.applications where job_id = ${pub};`)).trim(), '1', 'G2: 마감 뒤에도 본인 지원 내역 보존'); await S3.run('rollback')
    const E3 = sess('e3'); await E3.begin('authenticated', IDS.E1)
    assert.equal((await E3.run(`select count(*) from public.applications where job_id = ${pub};`)).trim(), '1', 'G2: 마감 뒤에도 기업이 받은 지원 조회'); await E3.run('rollback')
    // 마감 중 내용을 고치면 검사 기록이 낡아 다시 켤 때 공개되지 않음(재검사 필요) / 내용이 그대로면 다시 켜짐
    E = sess('e'); await E.begin('authenticated', IDS.E1)
    assert.ok(!isErr(await E.run(`update public.local_jobs set active = true where id = ${pub};`)), 'G2: 내용 그대로 다시 켜기'); await E.run('commit')
    assert.match(state(pub), /active=true/, 'G2: 내용이 그대로면 마감 뒤 다시 공개(검사 기록 유효)')
    E = sess('e'); await E.begin('authenticated', IDS.E1); await E.run(`update public.local_jobs set active = false where id = ${pub};`); await E.run('commit')
    E = sess('e'); await E.begin('authenticated', IDS.E1); await E.run(`update public.local_jobs set title = '내용 바꿈 ${pub}' where id = ${pub};`); await E.run('commit')
    E = sess('e'); await E.begin('authenticated', IDS.E1); await E.run(`update public.local_jobs set active = true where id = ${pub};`); await E.run('commit')
    assert.match(state(pub), /active=false/, 'G2: 마감 중 제목을 고쳤으면 다시 켜도 검사 기록이 낡아 비공개 유지(재검사 대기)')
    publish(pub)
    // 공개 중 연락처·주소 보호(#1096)가 실제 트리거 전체와 함께 동작
    E = sess('e'); await E.begin('authenticated', IDS.E1)
    assert.match(await E.run(`update public.local_jobs set employer_phone = null, location = null where id = ${pub};`), /공개 중인 공고에서 연락처·주소를 없앨 수 없음/, 'G2: 공개 중 연락처·주소 동시 삭제 거부(실제 위치 트리거 구조에서도)'); await E.run('rollback')
    // 공개 중 주소 글자 수정: 위치 트리거(canonical identity·administrative pin·map_r1 큐)가 함께 돌아도 공개·소유 유지
    E = sess('e'); await E.begin('authenticated', IDS.E1)
    assert.ok(!isErr(await E.run(`update public.local_jobs set location = 'Lô B, KCN Quế Võ, Bắc Ninh' where id = ${pub};`)), 'G2: 공개 중 주소 수정 허용'); await E.run('commit')
    assert.match(state(pub), /employer active=true/, 'G2: 주소를 고쳐도 공개 유지·origin 그대로(위치 트리거가 소유·공개를 바꾸지 않음)')
    assert.notEqual(c.scalar(`select requested_at is null from public.job_signal_queue where workflow = 'job-ocr-check.yml'`), 't', 'G2: 공고 입력이 바뀌면 검사 요청 신호가 기록됨(캐시 갱신 신호)')
    // 관리자 숨김: 새 지원 거부, 기존 지원 보존, 기업이 다시 켜도 숨김 유지
    const A = sess('a'); await A.begin('authenticated', IDS.ADM, ADM_CLAIMS)
    assert.ok(!isErr(await A.run(`select public.admin_set_job_hidden(${pub}, true, '시험');`)), 'G2: 관리자 숨김'); await A.run('commit')
    assert.match(state(pub), /hidden=true/)
    S = sess('s'); await S.begin('authenticated', IDS.S1)
    assert.ok(isErr(await S.run(`insert into public.applications(job_id, seeker_id, employer_id, status) values (${pub}, '${IDS.S1}', '${IDS.E1}', 'submitted');`)), 'G2: 숨김 공고 지원 거부'); await S.run('rollback')
    E = sess('e'); await E.begin('authenticated', IDS.E1); await E.run(`update public.local_jobs set active = true where id = ${pub};`); await E.run('commit')
    assert.match(state(pub), /hidden=true/, 'G2: 기업이 다시 켜도 관리자 숨김은 풀리지 않음')
    assert.equal(c.scalar(`select count(*) from public.applications where job_id = ${pub}`), '1', 'G2: 숨김 뒤에도 기존 지원 보존')
  }

  // ── G2b 정책 검토('review') 판정 공고: 기업이 마감한 뒤 스스로 다시 켤 수 없다(관리자만 공개로 돌릴 수 있음) ──
  {
    const rv = lastNum(await reg('authenticated', IDS.E1, job('g2b', { employer_id: IDS.E1, description: null })))
    assert.equal(c.scalar(`select policy_decision from public.local_jobs where id = ${rv}`).startsWith('review:'), true, 'G2b: 설명이 없으면 정책 판정이 review')
    publish(rv)
    assert.match(state(rv), /active=true/, 'G2b: 관리자 판정과 검사 기록으로 공개는 됨')
    let E = sess('e'); await E.begin('authenticated', IDS.E1); await E.run(`update public.local_jobs set active = false where id = ${rv};`); await E.run('commit')
    E = sess('e'); await E.begin('authenticated', IDS.E1); await E.run(`update public.local_jobs set active = true where id = ${rv};`); await E.run('commit')
    assert.match(state(rv), /active=false/, 'G2b: review 판정 공고는 기업이 마감한 뒤 다시 켜도 공개되지 않음')
    note('정책 판정이 review인 기업 공고(설명이 비었거나 직무 근거 부족)는 한번 마감하면 기업이 스스로 다시 열 수 없고 관리자가 다시 공개해야 한다 — 화면에서 "다시 열기"가 조용히 실패해 보일 수 있다(화면 안내 문구 점검 항목)')
  }

  // ── G3 크롤러·기업·관리자 갱신 충돌 ──
  {
    const own = lastNum(await reg('authenticated', IDS.E1, job('g3', { employer_id: IDS.E1, salary: '10 triệu' })))
    publish(own)
    // (a) 수집 재수집은 기업 공고를 못 덮는다(실제 트리거 구조에서도)
    const K = sess('k'); await K.begin('service_role')
    await K.run(callSql({ channel: 'crawler_topcv', source_text: '재수집 g3', job_id: own, update_fields: ['salary'], salary: '1 triệu' })); await K.run('commit')
    assert.equal(c.scalar(`select salary from public.local_jobs where id = ${own}`), '10 triệu', 'G3: 수집 재수집이 기업 공고 급여를 덮지 못함')
    // (b) 기업이 켜는 순간(행 잠금 중) 관리자 숨김이 겹침: 숨김이 사라지지 않고 둘 다 반영
    const E = sess('e'), A = sess('a'); await E.begin('authenticated', IDS.E1); await A.begin('authenticated', IDS.ADM, ADM_CLAIMS)
    const aPid = await A.pid()
    await E.run(`update public.local_jobs set salary = '11 triệu' where id = ${own};`)
    const pA = A.run(`select public.admin_set_job_hidden(${own}, true, '동시');`)
    const early = await settled(pA, 1500)
    assert.ok(early === null && c.isWaiting(aPid), 'G3: 관리자 숨김이 기업 수정(행 잠금)을 기다림')
    await E.run('commit'); await pA; await A.run('commit')
    assert.match(c.scalar(`select admin_hidden || ' ' || salary from public.local_jobs where id = ${own}`), /^true 11 triệu$/, 'G3: 기업 수정과 관리자 숨김이 둘 다 반영(서로 덮지 않음)')
    // (c) 수집 공고를 기업·게스트·다른 기업이 못 고침(소유 구분)
    const idC = lastNum(await reg('service_role', null, job('g3c', { channel: 'crawler_topcv', source_url: 'https://src.example/g3c' })))
    const X = sess('x'); await X.begin('authenticated', IDS.E2)
    assert.equal((await X.run(`update public.local_jobs set title = '탈취' where id = ${idC} returning id;`)).trim(), '', 'G3: 다른 기업은 수집 공고를 못 고침'); await X.run('rollback')
  }

  // ── G4 웹·앱 동시 수정: 전역 잠금·잠금 순서 역전 ──
  {
    const j1 = lastNum(await reg('authenticated', IDS.E1, job('g4a', { employer_id: IDS.E1 })))
    const j2 = lastNum(await reg('authenticated', IDS.E2, job('g4b', { employer_id: IDS.E2 })))
    // (a) 같은 행의 서로 다른 칸을 웹·앱이 동시에 고침: 순서대로 처리되고 둘 다 남는다(낙관적 잠금 없음 — 마지막 확정이 같은 칸을 이김)
    const W = sess('w'), P = sess('p'); await W.begin('authenticated', IDS.E1); await P.begin('authenticated', IDS.E1)
    const pPid = await P.pid()
    await W.run(`update public.local_jobs set title = '웹 제목' where id = ${j1};`)
    const pP = P.run(`update public.local_jobs set salary = '앱 급여' where id = ${j1};`)
    assert.ok((await settled(pP, 1200)) === null && c.isWaiting(pPid), 'G4: 같은 공고의 동시 수정은 뒤가 기다림')
    await W.run('commit'); await pP; await P.run('commit')
    assert.equal(c.scalar(`select title || '/' || salary from public.local_jobs where id = ${j1}`), '웹 제목/앱 급여', 'G4: 다른 칸 수정은 둘 다 남음')
    // (b) 전역 잠금: 공고 쓰기 트랜잭션이 열려 있는 동안 다른 공고 쓰기도 기다린다(trg_00_canonical_gate가 모든 local_jobs 쓰기에 같은 DB 잠금을 건다)
    const X = sess('x'), Y = sess('y'); await X.begin('authenticated', IDS.E1); await Y.begin('authenticated', IDS.E2)
    const yPid = await Y.pid()
    await X.run(`update public.local_jobs set title = '전역 a' where id = ${j1};`)
    const pY = Y.run(`update public.local_jobs set title = '전역 b' where id = ${j2};`)
    const blocked = (await settled(pY, 1500)) === null && c.isWaiting(yPid)
    assert.ok(blocked, 'G4: 서로 다른 공고(다른 기업)의 쓰기도 앞 트랜잭션이 끝날 때까지 기다림 — 전역 직렬화')
    await X.run('commit'); await pY; await Y.run('commit')
    note('모든 local_jobs 쓰기가 같은 DB 잠금(trg_00_canonical_gate)으로 직렬화됨 — 열려 있는 쓰기 트랜잭션(수집 일괄·ops-run-sql 등)이 있으면 모든 기업·관리자·지원자의 공고 수정이 그동안 기다린다(처리량·지연 위험, 정확성 문제 아님)')
    // (c) 잠금 순서: 위치 저장 함수와 일반 UPDATE가 같은 순서(전역 잠금 → 공고 행)로 잠가 교착이 없다 — 한 트랜잭션이 다른 공고를 먼저 고친 뒤 같은 공고를 고치는 경우도
    const idC = lastNum(await reg('service_role', null, job('g4c', { channel: 'crawler_topcv', source_url: 'https://src.example/g4c', work_locations: wl })))
    const B = sess('b'), R = sess('r'); await B.begin('service_role'); await R.begin('service_role')
    await B.run(`update public.local_jobs set title = 'dl-1' where id = ${j1};`)                       // B가 전역 잠금을 쥠
    const pR = R.run(`select public.replace_job_work_locations(${idC}, '[{"raw_address":"Lô B, KCN Yên Phong, Bắc Ninh"}]'::jsonb);`)   // R: 전역 잠금 대기(행은 아직 안 잠금)
    assert.ok((await settled(pR, 1200)) === null, 'G4: 위치 저장이 전역 잠금을 기다림')
    const outB = await Promise.race([B.run(`update public.local_jobs set title = 'dl-2' where id = ${idC};`), sleep(8000).then(() => 'timeout')])   // B: 같은 공고 수정 — R이 행을 안 쥐어 바로 됨
    assert.ok(outB !== 'timeout' && !isErr(outB), `G4: 교착·지연 없이 같은 트랜잭션의 두 번째 공고 수정 완료 (${outB === 'timeout' ? '멈춤' : errText(outB)})`)
    await B.run('commit')
    const outR = await Promise.race([pR, sleep(8000).then(() => 'timeout')])
    assert.ok(outR !== 'timeout' && !isErr(outR), `G4: 앞 트랜잭션이 끝나면 위치 저장이 이어서 완료 (${outR === 'timeout' ? '멈춤' : errText(outR)})`)
    await R.run('commit')
    assert.equal(c.scalar(`select count(*) || ' ' || max(raw_address) from public.job_work_locations where job_id = ${idC}`), '1 Lô B, KCN Yên Phong, Bắc Ninh', 'G4: 근무지 교체 결과가 온전(일부 저장 없음)')
    assert.equal(c.scalar(`select title from public.local_jobs where id = ${idC}`), 'dl-2', 'G4: 앞 트랜잭션의 수정도 반영')
  }

  // ── G5 SECURITY DEFINER 전수 점검 ──
  {
    const rows = c.admin(`\\pset format unaligned\n\\pset tuples_only on\nselect n.nspname || '.' || p.proname || '|' || (p.prorettype = 'trigger'::regtype) || '|' || string_agg(distinct r.rolname, ',' order by r.rolname)
      from pg_proc p join pg_namespace n on n.oid = p.pronamespace cross join (select rolname from pg_roles where rolname in ('anon','authenticated')) r
      where p.prosecdef and n.nspname in ('public','location_private','dedupe_private','ingest_private') and has_function_privilege(r.rolname, p.oid, 'EXECUTE')
      group by n.nspname, p.proname, p.prorettype order by 1`).trim().split('\n').map((l) => l.split('|'))
    const direct = rows.filter((r) => r[1] === 'false')
    const names = (role) => direct.filter((r) => r[2].split(',').includes(role)).map((r) => r[0]).sort()
    // 허용 목록(각각 이유): 토큰·소유 확인을 함수 안에서 하거나, 공개 조회·집계용
    // 관리자 함수 4개는 20261127000000_admin_functions_revoke_anon이 anon 실행 권한을 회수했다(운영엔 0020 초안이 적용된 적 없어 그 전까지 anon 실행 가능이었음, #1070).
    const ANON_OK = ['public.community_increment_views', 'public.crawl_source_allowed', 'public.get_guest_job', 'public.get_job_conditions', 'public.is_account_active',
      'public.job_signal_record_status', 'public.map_r1_public_points', 'public.set_job_pinned_location', 'public.update_guest_job', 'public.update_job_conditions',
      // 입구(ingest_job)가 부르는 비공개 도우미 — 게스트 등록도 같은 입구를 써서 비로그인에도 실행 권한을 준다(20261029010000). 이 스키마가 REST에 노출되지 않는다는 전제에 기대는 구조(아래 FINDING)
      'ingest_private.audit_admin_create', 'ingest_private.branch_key', 'ingest_private.find_existing', 'ingest_private.job_state', 'ingest_private.link', 'ingest_private.log', 'ingest_private.open_raw'].sort()
    assert.deepEqual(names('anon'), ANON_OK, `G5: 비로그인이 실행할 수 있는 SECURITY DEFINER 함수 목록이 허용 목록과 다름 — 새 함수는 권한 점검을 거쳐 목록에 이유와 함께 추가: ${JSON.stringify(names('anon'))}`)
    const adminFns = names('authenticated').filter((n) => n.startsWith('public.admin_'))
    const authOther = names('authenticated').filter((n) => !n.startsWith('public.admin_') && !ANON_OK.includes(n)).sort()
    assert.deepEqual(authOther, ['public.job_alert_is_active_seeker', 'public.job_duplicate_decide', 'public.ks_add_review', 'public.ks_my_profile'], `G5: 로그인 사용자만 실행할 수 있는 비관리자 함수 목록: ${JSON.stringify(authOther)}`)
    // job_duplicate_decide(관리자 전용 의도): 함수 안의 관리자 확인이 current_user를 보는데, SECURITY DEFINER 안의 current_user는 호출자가 아니라 함수 소유자(postgres)라 언제나 통과한다
    {
      const sus = lastNum(await reg('service_role', null, job('g5d', { channel: 'crawler_topcv', source_url: 'https://src.example/g5d' })))
      c.admin(`update public.local_jobs set duplicate_status = 'suspect' where id = ${sus}`)
      const X = sess('dup'); await X.begin('authenticated', IDS.E2)      // 이 공고와 무관한 일반 기업 계정
      const o = await X.run(`select public.job_duplicate_decide(${sus}, 'duplicate');`); await X.run(isErr(o) ? 'rollback' : 'commit')
      const after = c.scalar(`select duplicate_status from public.local_jobs where id = ${sus}`)
      if (!isErr(o) && after === 'duplicate') {
        defect('public.job_duplicate_decide(20261107070000)가 관리자가 아닌 일반 기업 계정에도 통과한다 — 중복 의심 공고를 남의 계정이 \'중복\'(비공개) 또는 \'중복 아님\'(공개로 되돌림)으로 확정할 수 있다. 원인: 함수가 SECURITY DEFINER인데 관리자 확인을 `current_user in (\'postgres\',\'supabase_admin\',\'service_role\')`로 해서, definer 안의 current_user는 항상 함수 소유자(postgres)라 조건이 늘 참. 최소 수정안: 그 줄을 호출자 기준으로 — `coalesce(current_setting(\'request.jwt.claim.role\', true), \'\') = \'service_role\'`(서버 키) 또는 `public.is_admin()`만 허용하고 current_user 비교를 지움(migration — 대표 승인 대상, 이 PR에서는 하지 않음)')
      } else {
        assert.match(o, /관리자만|insufficient_privilege/, 'G5: 관리자가 아닌 계정은 job_duplicate_decide 거부')
        assert.equal(after, 'suspect', 'G5: 거부되면 중복 판정 상태가 그대로')
      }
    }
    // 입구 비공개 도우미를 비로그인이 DB에서 직접 부르면 무슨 일이 생기는가(REST 노출 전제를 빼고 본 실제 동작)
    {
      const hiddenJob = pub                                              // G2에서 관리자가 숨긴 공고
      const raw = c.scalar(`select min(id) from public.job_ingest_raw`)
      const P = sess('probe'); await P.begin('anon')
      const leak = (await P.run(`select origin || ' active=' || active from ingest_private.job_state(${hiddenJob});`)).trim()
      await P.run('rollback'); await P.begin('anon')
      const linkOut = await P.run(`select ingest_private.link(${raw}, ${hiddenJob});`); await P.run('commit')
      await P.begin('anon'); const rawDirect = await P.run(`select count(*) from public.job_ingest_raw;`); await P.run('rollback')
      assert.match(rawDirect, /permission denied/, 'G5: 원문 기록 표는 비로그인이 직접 읽지 못함(RLS·권한)')
      const reachable = []
      if (/employer active=/.test(leak)) reachable.push('job_state(숨긴 공고의 소유 구분·공개 여부·판정 사유 조회)')
      if (!isErr(linkOut) && c.scalar(`select job_id from public.job_ingest_raw where id = ${raw}`) === String(hiddenJob)) reachable.push('link(원문 기록의 공고 연결 바꾸기)')
      if (reachable.length) note(`입구 비공개 도우미(ingest_private.*)가 비로그인에도 실행 가능하고 SECURITY DEFINER라 RLS·표 권한을 우회한다 — DB 연결 수준에서 직접 부르면: ${reachable.join(', ')}. 이 스키마가 Supabase REST(PostgREST)에 노출되지 않는다는 전제로만 안전하다(저장소에 노출 설정 기록 없음 — 대시보드 설정은 이 시험 환경에서 미확인). 최소 수정안: 게스트 등록이 필요한 함수만 남기고 나머지(link·log·open_raw·job_state)는 anon 실행 권한 회수 + 입구를 definer 래퍼로 감싸기(migration — 대표 승인 대상, 이 PR에서는 하지 않음)`)
    }
    // 트리거 함수는 직접 부를 수 없다
    for (const r of rows.filter((x) => x[1] === 'true')) {
      const S = sess('t'); await S.begin('anon'); const o = await S.run(`select ${r[0]}();`); await S.run('rollback')
      assert.match(o, /trigger functions can only be called as triggers|permission denied/, `G5: 트리거 함수 ${r[0]} 직접 호출 불가`)
    }
    // 관리자 함수 전부: 관리자가 아닌 로그인 계정(기업·구직자)은 어떤 인자로도 거부, 아무것도 안 바뀐다
    const snap = () => c.scalar(`select (select count(*) from public.local_jobs where admin_hidden) || '/' || (select count(*) from public.account_statuses where status <> 'active') || '/' || (select count(*) from public.job_location_candidates)`)
    const before = snap()
    for (const fn of adminFns) {
      const nArgs = Number(c.scalar(`select pronargs from pg_proc where oid = (select oid from pg_proc where proname = '${fn.slice(7)}' and pronamespace = 'public'::regnamespace limit 1)`))
      for (const [role, sub] of [['authenticated', IDS.E1], ['authenticated', IDS.S1]]) {
        const S = sess('adm'); await S.begin(role, sub)
        const o = await S.run(`select ${fn}(${Array(nArgs).fill('null').join(',')});`); await S.run('rollback')
        assert.match(o, /admin (access|permission) required/, `G5: 비관리자 ${sub === IDS.E1 ? '기업' : '구직자'}가 ${fn} 호출 → 거부`)
      }
    }
    assert.equal(snap(), before, 'G5: 거부된 관리자 함수 호출이 데이터를 바꾸지 않음')
    // 토큰 확인 함수: 틀린 토큰·남의 공고는 거부(정상 토큰만 통과)
    const gid = lastNum(await reg('anon', null, job('g5g', { guest_manage_token: 'k'.repeat(24) })))
    for (const [fn, args] of [['get_guest_job', `${gid}, '${'z'.repeat(24)}'`], ['update_guest_job', `${gid}, '${'z'.repeat(24)}', '탈취'`]]) {
      const S = sess('g'); await S.begin('anon'); const o = (await S.run(`select * from public.${fn}(${args}${fn === 'update_guest_job' ? ', null, null, null, null, null, null, null' : ''});`)).trim(); await S.run('rollback')
      assert.equal(o, '', `G5: 틀린 토큰으로 ${fn} → 아무것도 안 돌아옴`)
    }
    for (const [role, sub] of [['anon', null], ['authenticated', IDS.E2]]) {
      const S = sess('p'); await S.begin(role, sub)
      assert.match(await S.run(`select public.set_job_pinned_location(${gid}, '${'z'.repeat(24)}', 'x', 21.0, 106.0);`), /not allowed/, `G5: ${role}가 틀린 토큰으로 위치 핀 지정 → 거부`); await S.run('rollback')
    }
    assert.equal(c.scalar(`select count(*) from public.job_work_locations where job_id = ${gid} and point_authority = 'poster_pin'`), '0')
    // 권한 상승 점검: 정상 토큰이면 자기(게스트) 공고만 고칠 수 있고 다른 공고는 못 건드린다
    const other = lastNum(await reg('anon', null, job('g5h', { guest_manage_token: 'm'.repeat(24) })))
    const G = sess('g2'); await G.begin('anon')
    await G.run(`select * from public.update_guest_job(${other}, '${'k'.repeat(24)}', '다른 공고 탈취', null, null, null, null, null, null, null, null);`); await G.run('commit')
    assert.notEqual(c.scalar(`select title from public.local_jobs where id = ${other}`), '다른 공고 탈취', 'G5: 내 토큰으로 다른 게스트 공고를 못 고침')
    note('is_account_active(uuid)는 비로그인도 실행 가능 — 임의 사용자 번호의 활성 여부를 물어볼 수 있다(정지 계정 존재 여부 추측). 정책의 RLS 조건에서 쓰는 함수라 막으면 영향이 있어 별도 결정 항목(이 PR에서 바꾸지 않음)')
  }

  if (process.env.STRICT_DEFECTS === '1') assert.equal(defects.length, 0, `재현된 결함 ${defects.length}건`)
  console.log(`real_chain_structure.concurrent: 실제 migration ${c.applied.length}개 적용 구조에서 시험 통과 (대역·미적용 ${c.failed.length}개: ${c.failed.map((f) => f[0].split('_')[0]).join(',')}). 관찰 ${findings.length}건, 재현된 결함 ${defects.length}건`)
} finally {
  opened.forEach((s) => { try { s.close() } catch {} })
  c.drop()
}
process.exit(0)
