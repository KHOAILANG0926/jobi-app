// local_jobs 쓰기 직렬화 실측(대표 2026-11-26 지시 3번, #1105 관찰 후속). 운영 DB 접속 없음 — 같은 서버 안에 실제 migration 전체를 올린 시험 DB를 새로 만들고 지운다.
// 실행: PG_TEST_URL=postgresql://postgres@/postgres?host=/tmp&port=5499 node supabase/tests/local_jobs_write_lock.concurrent.mjs   (pgbench 필요 — postgresql-client에 포함)
// 이 시험은 새 migration이 없어 check-postgres-migrations.sh가 자동 호출하지 않는다. 잠금 구조는 바꾸지 않고 '측정과 병목 여부 판정'만 한다.
//  ① 원인 확정: 어떤 트리거·함수의 어떤 잠금인지 pg_locks로 확인  ② 처리량·지연: 클라이언트 수별, 잠금 있음(현재) 대 통제군(같은 시험 DB에서 그 트리거만 끈 것 — 비교용이며 운영 변경안이 아님)
//  ③ 긴 트랜잭션이 다른 쓰기에 주는 대기  ④ 교착·실패·재시도 영향
// 대역: 운영 이전 기반 표·열·pg_net/pg_cron/vault/storage(pg-chain.mjs BASE). 시험 서버는 로컬 한 대(CPU 4)라 절대 수치는 운영과 다르다 — 잠금 있음/없음의 '비율'과 '대기가 무엇에 비례하는가'를 본다.
import assert from 'node:assert/strict'
import { spawnSync } from 'node:child_process'
import { mkdtempSync, writeFileSync, readFileSync, readdirSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { makeChain } from './lib/pg-chain.mjs'
import { IDS, jobPayload, callSql, lastNum, isErr, settled, sleep } from './lib/pg-race.mjs'

const c = await makeChain()
const opened = []
const sess = (n) => { const s = c.sess(n); opened.push(s); return s }
const dir = mkdtempSync(join(tmpdir(), 'jobi-lockbench-'))
const results = []
let BASE_ID = 0
const rec = (label, o) => { results.push({ label, ...o }); console.log('MEASURE', JSON.stringify({ label, ...o })) }

// pgbench 한 번 실행: tps·평균 지연·p95·최대(트랜잭션별 로그에서 계산)
function bench({ label, clients, secs = 4, script, vars = {} }) {
  vars = { base: BASE_ID, ...vars }
  const f = join(dir, `${label.replace(/\W+/g, '_')}.sql`)
  writeFileSync(f, script)
  const prefix = join(dir, `log_${label.replace(/\W+/g, '_')}`)
  const args = ['-n', '-c', String(clients), '-j', String(Math.min(clients, 4)), '-T', String(secs), '-f', f, '-l', '--log-prefix', prefix, ...Object.entries(vars).flatMap(([k, v]) => ['-D', `${k}=${v}`]), c.url]
  const r = spawnSync('pgbench', args, { encoding: 'utf8' })
  assert.equal(r.status, 0, `pgbench 실패(${label}): ${r.stderr}`)
  const lat = []
  for (const lf of readdirSync(dir).filter((x) => x.startsWith(`log_${label.replace(/\W+/g, '_')}`))) {
    for (const line of readFileSync(join(dir, lf), 'utf8').split('\n')) { const p = line.trim().split(/\s+/); if (p.length >= 3 && /^\d+$/.test(p[2])) lat.push(Number(p[2]) / 1000) }
  }
  lat.sort((a, b) => a - b)
  const pick = (q) => (lat.length ? +lat[Math.min(lat.length - 1, Math.floor(lat.length * q))].toFixed(2) : null)
  const tps = Number((r.stdout.match(/tps = ([\d.]+)/) || [])[1])
  const failed = Number((r.stdout.match(/number of failed transactions: (\d+)/) || [])[1] || 0)
  return { clients, tps: Math.round(tps), avg_ms: +(lat.reduce((s, x) => s + x, 0) / Math.max(1, lat.length)).toFixed(2), p50_ms: pick(0.5), p95_ms: pick(0.95), max_ms: lat.length ? +lat[lat.length - 1].toFixed(2) : null, n: lat.length, failed }
}
const gate = (on) => c.admin(`alter table public.local_jobs ${on ? 'enable' : 'disable'} trigger trg_00_canonical_gate;`)
const deadlocks = () => Number(c.scalar(`select deadlocks from pg_stat_database where datname = current_database()`))

try {
  assert.ok(c.has(`exists (select 1 from pg_trigger where tgrelid = 'public.local_jobs'::regclass and tgname = 'trg_00_canonical_gate')`), '운영 정의의 트리거가 올라와 있어야 함')
  c.admin(`insert into auth.users(id) values ('${IDS.E1}'),('${IDS.E2}'),('${IDS.ADM}') on conflict do nothing;
    insert into public.account_statuses(user_id,status) values ('${IDS.E1}','active'),('${IDS.E2}','active'),('${IDS.ADM}','active') on conflict (user_id) do update set status='active';
    insert into public.account_roles(user_id,role) values ('${IDS.E1}','employer'),('${IDS.E2}','employer'),('${IDS.ADM}','seeker') on conflict (user_id) do update set role=excluded.role;`)
  // 시험 준비용 행(입구 규칙은 시험 대상이 아니라 준비 동안만 끈다): 기업 E1 300건 + 수집 300건, 모두 비공개(공개 판정 트리거 영향 없이 갱신만 측정)
  c.admin(`alter table public.local_jobs disable trigger trg_000_ingest_gateway_only;
    insert into public.local_jobs(title, company, origin, active, employer_id, salary, location, employer_phone, source_text, source_url)
      select 'job' || g, 'CTY' || g, case when g <= 300 then 'employer' else 'crawler' end, false, case when g <= 300 then '${IDS.E1}'::uuid end, 'v0', 'KCN Yên Phong', '0912345678', 'CTY' || g || ' tuyển công nhân KCN Yên Phong', 'https://src.example/seed/' || g from generate_series(1, 600) g;
    alter table public.local_jobs enable trigger trg_000_ingest_gateway_only;`)
  assert.equal(c.scalar(`select count(*) from public.local_jobs where title like 'job%'`), '600')
  BASE_ID = Number(c.scalar(`select min(id) - 1 from public.local_jobs where title like 'job%'`))   // 시험 행 번호 = BASE_ID+1 ~ BASE_ID+600

  // ── ① 원인 확정: 문장 단위 트리거 trg_00_canonical_gate → location_private.mutation_gate() → pg_advisory_xact_lock(20261026,27) ──
  const def = c.scalar(`select pg_get_functiondef('location_private.mutation_gate()'::regprocedure)`)
  assert.ok(/pg_advisory_xact_lock\(20261026,\s*27\)/.test(c.admin(`select pg_get_functiondef('location_private.mutation_gate()'::regprocedure);`)), '원인 함수 본문에 같은 어드바이저리 잠금(20261026,27)')
  assert.equal(c.scalar(`select tgtype & 1 from pg_trigger where tgrelid = 'public.local_jobs'::regclass and tgname = 'trg_00_canonical_gate'`), '0', '행 단위가 아니라 문장 단위 트리거(tgtype 행 비트 0)')
  assert.equal(c.scalar(`select count(*) from pg_trigger where tgname = 'trg_00_canonical_gate' and not tgisinternal`), '6', '같은 잠금을 거는 표 6개(local_jobs·위치 후보·확정 기억·근무지·위치 큐·검색 기록)')
  {
    const X = sess('x'), Y = sess('y'), P = sess('p')
    await X.begin('service_role'); await Y.begin('service_role')
    await X.run(`update public.local_jobs set salary = 'x' where id = ${BASE_ID + 1};`)
    const yPid = await Y.pid()
    const t0 = Date.now()
    const pY = Y.run(`update public.local_jobs set salary = 'y' where id = ${BASE_ID + 600};`)    // 다른 공고·다른 행
    assert.equal(await settled(pY, 800), null, '서로 다른 행의 쓰기도 기다림')
    const lk = c.admin(`\\pset tuples_only on\n\\pset format unaligned\nselect l.pid = ${yPid} as is_y, l.granted, l.locktype, l.classid, l.objid, l.objsubid from pg_locks l where l.locktype = 'advisory' and l.classid = 20261026 and l.objid = 27 order by l.granted desc;`).trim().split('\n')
    assert.ok(lk.some((x) => x.startsWith('f|t|advisory|20261026|27|2')), '잠금 보유자 1명(granted)')
    assert.ok(lk.some((x) => x.startsWith('t|f|advisory|20261026|27|2')), '대기자(not granted)가 그 잠금을 기다림')
    await X.run('commit'); await pY; const waited = Date.now() - t0; await Y.run('commit')
    rec('cause', { lock: 'pg_advisory_xact_lock(20261026,27)', trigger: 'trg_00_canonical_gate(문장 단위, 6개 표)', holder_until: 'commit/rollback(트랜잭션 끝까지)', other_row_wait_ms: waited })
    // 행 잠금은 별개: 같은 행이면 행 잠금까지 겹쳐 기다림(통제군 참고) — 여기서는 잠금 보유 시간 = 트랜잭션 길이임을 확인
  }

  // ── ② 단일 문장 자동 커밋 쓰기: 클라이언트 수별 처리량·지연(잠금 있음 vs 통제군) ──
  const oneRow = `\\set id :base + random(1, 300)\nUPDATE public.local_jobs SET salary = 'v' || :id WHERE id = :id;\n`                  // 일반 UPDATE(행 하나)
  const employerRow = `\\set id :base + random(1, 300)\nBEGIN;\nSET LOCAL ROLE authenticated;\nSELECT set_config('request.jwt.claim.sub', '${IDS.E1}', true);\nUPDATE public.local_jobs SET salary = 'e' || :id WHERE id = :id;\nCOMMIT;\n`  // 기업 계정 수정(RLS·역할 전환 포함)
  const ingest = `\\set n random(1, 1000000000)\nBEGIN;\nSELECT public.ingest_job(jsonb_build_object('channel','crawler_topcv','source_text','CTY bench ' || :n || ' tuyển công nhân KCN Yên Phong','company','CTY bench ' || :n,'employer_phone','09123' || (10000 + :n % 80000),'title','bench','location','KCN Yên Phong, Bắc Ninh','source_url','https://src.example/bench/' || :n,'active',false));\nROLLBACK;\n`  // 수집 등록 입구(트랜잭션 하나 = 잠금 보유 시간)
  const bulk = `UPDATE public.local_jobs SET salary = 'b' || id WHERE id > :base + 300;\n`                                            // 수집 일괄 갱신: 300행 한 문장
  // 실행 순서·표 부풀림(앞선 갱신이 남긴 죽은 행)이 결과를 왜곡하지 않게: 한 시험마다 VACUUM 뒤 [잠금 있음 → 통제군 → 통제군 → 잠금 있음] 순서로 4번 돌려 모드별 평균을 낸다.
  const abba = (label, opts) => {
    const runs = { true: [], false: [] }
    for (const on of [true, false, false, true]) { gate(on); c.admin('vacuum public.local_jobs;'); runs[on].push(bench({ ...opts, label: `${opts.label}_${on}_${runs[on].length}`, secs: 3 })) }
    gate(true)
    for (const [mode, on] of [['잠금 있음(현재)', true], ['통제군(트리거 끔)', false]]) {
      const r = runs[on], avg = (k) => +(r.reduce((x, y) => x + y[k], 0) / r.length).toFixed(2)
      rec(`${label} / ${mode}`, { clients: r[0].clients, tps: Math.round(avg('tps')), avg_ms: avg('avg_ms'), p95_ms: avg('p95_ms'), max_ms: Math.max(...r.map((x) => x.max_ms)), runs_tps: r.map((x) => x.tps), failed: r.reduce((x, y) => x + y.failed, 0) })
    }
  }
  for (const n of [1, 4, 8]) abba(`일반 UPDATE 1행 c=${n}`, { label: `one${n}`, clients: n, script: oneRow })
  for (const n of [1, 4]) abba(`기업 계정 수정(RLS) c=${n}`, { label: `emp${n}`, clients: n, script: employerRow })
  for (const n of [1, 4]) abba(`수집 등록 ingest_job(되돌림) c=${n}`, { label: `ing${n}`, clients: n, script: ingest })
  abba('수집 일괄 갱신 300행 1문장 c=1', { label: 'bulk1', clients: 1, script: bulk })
  abba('수집 일괄 갱신 300행 1문장 c=4', { label: 'bulk4', clients: 4, script: bulk })
  gate(true)

  // ── ③ 긴 트랜잭션이 다른 쓰기에 주는 대기: 수집 일괄 트랜잭션(300행 갱신 + 보유 H ms)이 계속 도는 동안 기업 계정 수정 4명의 지연 ──
  for (const holdMs of [50, 500, 2000]) {
    for (const [mode, on] of [['잠금 있음(현재)', true], ['통제군(트리거 끔)', false]]) {
      gate(on); c.admin('vacuum public.local_jobs;')
      const longTx = `BEGIN;\nUPDATE public.local_jobs SET salary = 'L' || id WHERE id > :base + 300;\nSELECT pg_sleep(${holdMs / 1000});\nCOMMIT;\n`
      // 긴 트랜잭션 1개 + 기업 수정 4개를 같은 시간 동안 함께 돌린다(pgbench를 둘 띄움)
      const f1 = join(dir, `long_${holdMs}_${on}.sql`); writeFileSync(f1, longTx)
      const f2 = join(dir, `empmix_${holdMs}_${on}.sql`); writeFileSync(f2, employerRow)
      const lp = join(dir, `log_mix_${holdMs}_${on}`)
      const longP = spawnSync('sh', ['-c', `pgbench -n -c 1 -j 1 -T 6 -D base=${BASE_ID} -f ${f1} '${c.url}' > ${dir}/long_${holdMs}_${on}.out 2>&1 & pgbench -n -c 4 -j 4 -T 6 -D base=${BASE_ID} -l --log-prefix ${lp} -f ${f2} '${c.url}' > ${dir}/mix_${holdMs}_${on}.out 2>&1; wait`], { encoding: 'utf8' })
      assert.equal(longP.status, 0, longP.stderr)
      const lat = []
      for (const lf of readdirSync(dir).filter((x) => x.startsWith(`log_mix_${holdMs}_${on}`))) for (const line of readFileSync(join(dir, lf), 'utf8').split('\n')) { const p = line.trim().split(/\s+/); if (p.length >= 3 && /^\d+$/.test(p[2])) lat.push(Number(p[2]) / 1000) }
      lat.sort((a, b) => a - b)
      const out = readFileSync(join(dir, `mix_${holdMs}_${on}.out`), 'utf8'); const lout = readFileSync(join(dir, `long_${holdMs}_${on}.out`), 'utf8')
      rec(`긴 트랜잭션 ${holdMs}ms + 기업 수정 c=4 / ${mode}`, { employer_tps: Math.round(Number((out.match(/tps = ([\d.]+)/) || [])[1])), employer_p50_ms: +lat[Math.floor(lat.length * 0.5)].toFixed(2), employer_p95_ms: +lat[Math.floor(lat.length * 0.95)].toFixed(2), employer_max_ms: +lat[lat.length - 1].toFixed(2), long_tx_per_s: +(Number((lout.match(/tps = ([\d.]+)/) || [])[1])).toFixed(2) })
    }
  }
  gate(true)

  // ── ④ 교착·실패·재시도: 실패한 트랜잭션은 잠금을 바로 놓는다 / 서로 다른 순서로 잠그는 두 트랜잭션도 교착 없음 ──
  const dl0 = deadlocks()
  {
    const A = sess('a'), B = sess('b')
    await A.begin('service_role'); await B.begin('service_role')
    await A.run(`update public.local_jobs set salary = 'a1' where id = ${BASE_ID + 1};`)
    const pB = B.run(`update public.local_jobs set salary = 'b1' where id = ${BASE_ID + 2};`)
    assert.equal(await settled(pB, 600), null)
    const t0 = Date.now()
    const failOut = await A.run(`select 1/0;`); assert.ok(isErr(failOut)); await A.run('rollback')        // 앞 트랜잭션 실패 → 되돌림 → 잠금 해제
    await pB; const wait = Date.now() - t0 + 600; await B.run('commit')
    rec('실패 뒤 대기자 풀림', { holder_failed_then_rollback: true, waiter_resumed_after_ms: Date.now() - t0 })
    // 교착: A는 (행1 → 행2), B는 (행2 → 행1) 순서로 갱신 — 전역 잠금을 문장마다 같은 키로 먼저 잡으므로 행 잠금 순서 역전이 생기기 전에 직렬화된다
    const C = sess('c'), D = sess('d'); await C.begin('service_role'); await D.begin('service_role')
    await C.run(`update public.local_jobs set salary = 'c1' where id = ${BASE_ID + 11};`)
    const pD = D.run(`update public.local_jobs set salary = 'd1' where id = ${BASE_ID + 12};`)
    const c2 = C.run(`update public.local_jobs set salary = 'c2' where id = ${BASE_ID + 12};`)
    await sleep(300)
    await C.run('commit'); await pD; await c2; await D.run(`update public.local_jobs set salary = 'd2' where id = ${BASE_ID + 11};`).catch(() => {}); await D.run('commit')
  }
  const dl1 = deadlocks()
  // pgbench 두 클라이언트가 서로 반대 순서로 두 행을 갱신하는 트랜잭션을 계속 돌린다(교착이 생기면 pg_stat_database.deadlocks가 오른다)
  const crossA = `BEGIN;\nUPDATE public.local_jobs SET salary = 'ca' WHERE id = :base + 21;\nUPDATE public.local_jobs SET salary = 'ca' WHERE id = :base + 22;\nCOMMIT;\n`
  const crossB = `BEGIN;\nUPDATE public.local_jobs SET salary = 'cb' WHERE id = :base + 22;\nUPDATE public.local_jobs SET salary = 'cb' WHERE id = :base + 21;\nCOMMIT;\n`
  writeFileSync(join(dir, 'crossA.sql'), crossA); writeFileSync(join(dir, 'crossB.sql'), crossB)
  const cr = spawnSync('pgbench', ['-n', '-c', '4', '-j', '4', '-T', '5', '-D', `base=${BASE_ID}`, '-f', join(dir, 'crossA.sql'), '-f', join(dir, 'crossB.sql'), c.url], { encoding: 'utf8' })
  assert.equal(cr.status, 0, cr.stderr)
  const dl2 = deadlocks()
  rec('교착(서로 반대 순서 갱신 5초, c=4)', { tps: Math.round(Number((cr.stdout.match(/tps = ([\d.]+)/) || [])[1])), failed: Number((cr.stdout.match(/number of failed transactions: (\d+)/) || [])[1] || 0), deadlocks_before: dl0, deadlocks_after_manual: dl1, deadlocks_after_bench: dl2 })
  // 통제군에서 같은 반대 순서 시험 — 잠금이 교착을 막는 쪽인지(= 직렬화가 안전 장치 역할을 하는지) 확인
  gate(false)
  const cr2 = spawnSync('pgbench', ['-n', '-c', '4', '-j', '4', '-T', '5', '-D', `base=${BASE_ID}`, '-f', join(dir, 'crossA.sql'), '-f', join(dir, 'crossB.sql'), c.url], { encoding: 'utf8' })
  const dl3 = deadlocks(); gate(true)
  rec('교착 통제군(트리거 끔, 같은 시험)', { tps: Math.round(Number((cr2.stdout.match(/tps = ([\d.]+)/) || [])[1])), deadlocks_added: dl3 - dl2 })
  // 재시도 영향: 실패하는 트랜잭션을 계속 재시도하는 클라이언트 4개(매번 잠금을 잡았다 놓는다) — 정상 쓰기 지연
  const failing = `BEGIN;\nUPDATE public.local_jobs SET salary = 'f' WHERE id = :base + 31;\nSELECT 1/0;\nCOMMIT;\n`
  writeFileSync(join(dir, 'failing.sql'), failing)
  const f2 = join(dir, 'ok_one.sql'); writeFileSync(f2, oneRow)
  const lp = join(dir, 'log_retry')
  const rt = spawnSync('sh', ['-c', `pgbench -n -c 4 -j 2 -T 5 --max-tries=1 -D base=${BASE_ID} -f ${join(dir, 'failing.sql')} '${c.url}' > ${dir}/retry_fail.out 2>&1 & pgbench -n -c 4 -j 2 -T 5 -D base=${BASE_ID} -l --log-prefix ${lp} -f ${f2} '${c.url}' > ${dir}/retry_ok.out 2>&1; wait`], { encoding: 'utf8' })
  assert.equal(rt.status, 0, rt.stderr)
  const lat = []
  for (const lf of readdirSync(dir).filter((x) => x.startsWith('log_retry'))) for (const line of readFileSync(join(dir, lf), 'utf8').split('\n')) { const p = line.trim().split(/\s+/); if (p.length >= 3 && /^\d+$/.test(p[2])) lat.push(Number(p[2]) / 1000) }
  lat.sort((a, b) => a - b)
  rec('실패 재시도 폭주(4개)와 정상 1행 쓰기(4개) 동시', { ok_tps: Math.round(Number((readFileSync(join(dir, 'retry_ok.out'), 'utf8').match(/tps = ([\d.]+)/) || [])[1])), ok_p95_ms: +lat[Math.floor(lat.length * 0.95)].toFixed(2), ok_max_ms: +lat[lat.length - 1].toFixed(2) })

  // ── 판정(수치 기준은 근거와 함께 출력) ──
  const get = (l) => results.find((r) => r.label === l)
  const one8 = get('일반 UPDATE 1행 c=8 / 잠금 있음(현재)'), one8c = get('일반 UPDATE 1행 c=8 / 통제군(트리거 끔)')
  const ing4 = get('수집 등록 ingest_job(되돌림) c=4 / 잠금 있음(현재)'), ing4c = get('수집 등록 ingest_job(되돌림) c=4 / 통제군(트리거 끔)')
  console.log('JUDGMENT_INPUT', JSON.stringify({ single_row_c8: { lock: one8.tps, control: one8c.tps }, ingest_c4: { lock: ing4.tps, control: ing4c.tps } }))
  // 무결성 단언: 교착 없음, 실패한 트랜잭션이 잠금을 쥐고 있지 않음, 측정 중 실패한 트랜잭션 없음
  assert.equal(dl2 - dl0, 0, '잠금 있는 현재 구조에서 반대 순서 갱신에도 교착 0')
  for (const r of results.filter((x) => typeof x.failed === 'number' && x.label.includes('잠금 있음'))) assert.equal(r.failed, 0, `${r.label}: 실패한 트랜잭션 0`)
  console.log('local_jobs_write_lock: 측정 완료 — 위 MEASURE 줄이 근거(판정은 PR 본문)')
} finally {
  opened.forEach((s) => { try { s.close() } catch {} })
  c.drop()
}
