// 비로그인(anon)·로그인(authenticated) 함수 노출 전수 조사(대표 2026-11-26 지시 4번). 운영 DB 접속 없음 — 같은 서버 안에 실제 migration 전체를 올린 시험 DB를 새로 만들고 지운다.
// 실행: PG_TEST_URL=postgresql://postgres@/postgres?host=/tmp&port=5499 node supabase/tests/function_exposure.concurrent.mjs   (이 시험은 새 migration이 없어 CI가 자동 호출하지 않는다)
// 하는 일: ① 함수 EXECUTE 권한·스키마 USAGE 표(확장이 만든 함수는 제외 — Supabase는 extensions 스키마에 설치) ② anon·로그인 일반 계정으로 실제 호출(인자는 형식별 기본값)해 반환·오류·쓰기 부수효과(pg_stat_xact_*) 기록
//  ③ '이 권한을 걷으면 정상 비로그인 기능이 깨지는가'를 후보마다 같은 트랜잭션 안에서 REVOKE 뒤 정상 경로 9개를 돌려 확인(모두 ROLLBACK, 데이터 변경 없음) — 호출 가능하다는 이유만으로 걷지 않는다.
// 한계: PostgREST 노출 스키마 설정은 이 환경에서 확인할 수 없다(Supabase 기본 public만 노출로 가정 — 미확인). map_r1_snapshot·map_r1_public_points는 운영 이전 함수라 시험용 대역(pg-chain.mjs BASE) — 결론에서 제외.
import assert from 'node:assert/strict'
import { makeChain } from './lib/pg-chain.mjs'
import { IDS, jobPayload, callSql, lastNum, isErr, errText } from './lib/pg-race.mjs'

const c = await makeChain()
const opened = []
const sess = (n) => { const s = c.sess(n); opened.push(s); return s }
const rows = []
const out = (label, o) => { rows.push({ label, ...o }); console.log('ROW', JSON.stringify({ label, ...o })) }
const TOKEN = 'g'.repeat(24)

// Supabase와 같은 요청 구조: authenticator로 들어와 요청 역할로 바뀐다
const beginReq = (S, role, sub, claims) => {
  let q = `begin; set local session authorization authenticator; set local role ${role};`
  if (sub) q += ` select set_config('request.jwt.claim.sub', '${sub}', true) as x \\gset\n`
  if (claims) q += ` select set_config('request.jwt.claims', '${JSON.stringify(claims)}', true) as y \\gset\n`
  return S.run(q)
}
const asRole = async (role, sub, claims, sql) => { const S = sess('r'); await beginReq(S, role, sub, claims); const o = await S.run(sql); await S.run('rollback'); S.close(); return o }

try {
  c.admin(`do $r$ begin if not exists (select from pg_roles where rolname = 'authenticator') then create role authenticator nologin; end if; end $r$;
    grant anon, authenticated, service_role to authenticator;
    -- Supabase 기본 설정과 같게(시험용 storage 대역이 빠뜨린 것): storage 스키마 사용·객체 조회는 anon에게도 열려 있고 행은 RLS 정책이 거른다
    grant usage on schema storage to anon, authenticated, service_role; grant select on storage.objects to anon, authenticated;
    insert into auth.users(id) values ('${IDS.E1}'),('${IDS.E2}'),('${IDS.S1}'),('${IDS.ADM}') on conflict do nothing;
    insert into public.account_statuses(user_id,status) values ('${IDS.E1}','active'),('${IDS.E2}','suspended'),('${IDS.S1}','active'),('${IDS.ADM}','active') on conflict (user_id) do update set status=excluded.status;
    insert into public.account_roles(user_id,role) values ('${IDS.E1}','employer'),('${IDS.E2}','employer'),('${IDS.S1}','seeker'),('${IDS.ADM}','seeker') on conflict (user_id) do update set role=excluded.role;`)

  // ── ① 노출 표 ──
  const ext = `not exists (select 1 from pg_depend d where d.objid = p.oid and d.deptype = 'e')`   // 확장 소유 함수 제외
  const table = c.admin(`\\pset format unaligned\n\\pset fieldsep '|'
    select n.nspname, count(*) filter (where ${ext}) as own_funcs,
      count(*) filter (where ${ext} and has_function_privilege('anon', p.oid, 'execute')) as anon_exec,
      count(*) filter (where ${ext} and has_function_privilege('authenticated', p.oid, 'execute')) as auth_exec,
      bool_or(has_schema_privilege('anon', n.oid, 'usage')) as anon_schema_usage
    from pg_proc p join pg_namespace n on n.oid = p.pronamespace
    where n.nspname in ('public','ingest_private','location_private','dedupe_private','map_private') group by n.nspname order by 1;`)
  console.log('EXPOSURE_TABLE\n' + table)
  const schemaUsage = (s) => c.scalar(`select has_schema_privilege('anon', '${s}', 'usage')`)
  out('스키마 USAGE(anon)', { public: schemaUsage('public'), ingest_private: schemaUsage('ingest_private'), location_private: schemaUsage('location_private'), dedupe_private: schemaUsage('dedupe_private') })
  assert.equal(schemaUsage('location_private'), 'f', 'location_private 함수는 anon이 스키마 단계에서 못 부름')
  assert.equal(schemaUsage('dedupe_private'), 'f', 'dedupe_private 함수는 anon이 스키마 단계에서 못 부름')
  assert.equal(schemaUsage('ingest_private'), 't', 'ingest_private는 anon에게 USAGE가 열려 있음(입구가 호출자 권한으로 도우미를 부름)')

  // ── 시험 자료: 게스트 공고·기업 공고·커뮤니티 글 ──
  const reg = async (role, sub, p) => { const S = sess('reg'); await beginReq(S, role, sub, {}); const o = await S.run(callSql(p)); await S.run(isErr(o) ? 'rollback' : 'commit'); S.close(); return o }
  const guestJob = lastNum(await reg('anon', null, jobPayload('exp-guest', { guest_manage_token: TOKEN })))
  const empJob = lastNum(await reg('authenticated', IDS.E1, jobPayload('exp-emp', { employer_id: IDS.E1 })))
  assert.ok(guestJob > 0 && empJob > 0, '자료 준비')
  const post = c.scalar(`insert into public.community_posts(author_id, author_name, category, title, body) values ('${IDS.S1}', 'n', 'tip', 't', 'b') returning id`)

  // ── ② 실제 호출 표(anon·일반 로그인 계정) ──
  const fnList = c.admin(`\\pset format unaligned\n\\pset tuples_only on\n\\pset fieldsep '|'
    select p.oid, n.nspname || '.' || p.proname, pg_get_function_identity_arguments(p.oid), p.prosecdef
    from pg_proc p join pg_namespace n on n.oid = p.pronamespace
    where n.nspname in ('public','ingest_private') and ${ext} and p.prokind = 'f' and p.prorettype <> 'trigger'::regtype and p.prorettype <> 'event_trigger'::regtype
      and (has_function_privilege('anon', p.oid, 'execute') or has_function_privilege('authenticated', p.oid, 'execute')) order by 2, 3;`).trim().split('\n').filter(Boolean).map((l) => l.split('|'))
  const argFor = (t) => {
    t = t.trim()
    if (/^bigint$/.test(t)) return '1'; if (/^bigint\[\]$/.test(t)) return `'{1}'::bigint[]`; if (/^integer$/.test(t)) return '1'; if (/^uuid$/.test(t)) return `'${IDS.E1}'::uuid`
    if (/^text$/.test(t)) return `'x'`; if (/^boolean$/.test(t)) return 'false'; if (/^jsonb$/.test(t)) return `'{}'::jsonb`; if (/^double precision$/.test(t)) return '1'; if (/^date$/.test(t)) return 'current_date'
    return null
  }
  const callable = []
  for (const [oid, name, args, definer] of fnList) {
    const params = args.split(/,(?![^(]*\))/).map((x) => x.trim()).filter(Boolean).filter((x) => !/^OUT /.test(x))
    const types = params.map((x) => x.replace(/^(IN |INOUT |VARIADIC )?\S+ /, ''))   // "p_id bigint" → "bigint"
    const lits = types.map(argFor)
    if (lits.some((x) => x === null)) { out(`${name}(${args})`, { skipped: '인자 형식을 만들 수 없음(행 형식·내부 형식)', definer }); continue }
    callable.push({ name, args, definer, call: `select ${name}(${lits.join(', ')});` })
  }
  const SIDE = `select coalesce(sum(n_tup_ins + n_tup_upd + n_tup_del), 0) from pg_stat_xact_user_tables;`
  const callAs = async (role, sub, claims, f) => {
    const S = sess('c'); await beginReq(S, role, sub, claims)
    await S.run('savepoint s;')
    const o = await S.run(f.call)
    const failed = isErr(o)
    if (failed) await S.run('rollback to savepoint s;')
    const w = (await S.run(SIDE)).trim().split('\n').pop()
    await S.run('rollback'); S.close()
    return { failed, text: failed ? errText(o).slice(0, 90) : o.trim().split('\n')[0].slice(0, 80), wrote: Number(w) }
  }
  for (const f of callable) {
    for (const [lab, role, sub, claims] of [['anon', 'anon', null, null], ['로그인(일반 기업)', 'authenticated', IDS.E1, {}]]) {
      const r = await callAs(role, sub, claims, f)
      out(`${f.name}(${f.args}) [${lab}]`, { definer: f.definer, ...(r.failed ? { error: r.text } : { returns: r.text }), wrote_tuples: r.wrote })
    }
  }

  // ── ③ 사실 확인(실제 호출로) ──
  // (가) 계정 상태 열거: 임의 uuid의 상태를 true/false로 구분해 돌려줌(uuid를 알아야 함)
  const act = async (id) => (await asRole('anon', null, null, `select public.is_account_active('${id}'::uuid);`)).trim().split('\n').pop()
  const enumeration = { active: await act(IDS.E1), suspended: await act(IDS.E2), unknown: await act('99999999-9999-9999-9999-999999999999') }
  out('is_account_active 열거(anon)', enumeration)
  // (나) 입구 비공개 도우미를 anon이 DB 수준에서 직접 부를 수 있다(REST 노출 스키마가 아니면 이 경로로는 못 들어옴 — 노출 설정은 이 환경에서 확인 불가 = 미확인). 실제 효과를 같은 트랜잭션 안에서 확인하고 모두 롤백한다.
  const rawId = Number(c.scalar(`select id from public.job_ingest_raw order by id limit 1`))
  const peek = async (sql, check) => {
    const S = sess('p'); await beginReq(S, 'anon', null, null)
    const o = await S.run(sql); const failed = isErr(o)
    await S.run('reset role; reset session authorization;')
    const after = failed ? null : (await S.run(check)).trim().split('\n').pop()
    await S.run('rollback'); S.close()
    return { failed, err: failed ? errText(o) : null, after }
  }
  const w1 = await peek(`select ingest_private.open_raw('employer', null, null, 'direct text', '[]'::jsonb, '{}'::jsonb, 'directhash');`, `select count(*) from public.job_ingest_raw where content_hash = 'directhash';`)
  out('anon이 ingest_private.open_raw 직접 호출(롤백됨)', { succeeded: !w1.failed, raw_rows_created_in_tx: w1.after, err: w1.err })
  assert.equal(w1.after, '1', '입구를 거치지 않고 anon이 원문 기록 행을 만들 수 있음(DB 수준)')
  const before = c.scalar(`select coalesce(job_id::text, 'null') from public.job_ingest_raw where id = ${rawId}`)
  const w2 = await peek(`select ingest_private.link(${rawId}, ${empJob});`, `select coalesce(job_id::text, 'null') from public.job_ingest_raw where id = ${rawId};`)
  out('anon이 ingest_private.link 직접 호출(롤백됨)', { raw_id: rawId, job_id_before: before, job_id_after_in_tx: w2.after, succeeded: !w2.failed })
  assert.notEqual(w2.after, before, '입구를 거치지 않고 anon이 원문 기록의 공고 연결을 바꿀 수 있음(DB 수준)')
  const w3 = await peek(`select ingest_private.log(${rawId}, 'dedup', 'anon_direct');`, `select outcome from public.job_ingest_log where raw_id = ${rawId} and step = 'dedup';`)
  out('anon이 ingest_private.log 직접 호출(롤백됨)', { succeeded: !w3.failed, outcome_in_tx: w3.after })
  // 내부 정보: 공개되지 않는 공고(관리자 숨김)의 상태를 anon이 번호만 알면 읽는다 — 공고 표 자체는 RLS가 막는다
  c.admin(`update public.local_jobs set admin_hidden = true where id = ${guestJob};`)
  const hiddenRows = (await asRole('anon', null, null, `select count(*) from public.local_jobs where id = ${guestJob};`)).trim().split('\n').pop()
  const hiddenState = (await asRole('anon', null, null, `select ingest_private.job_state(${guestJob});`)).trim().split('\n').pop()
  c.admin(`update public.local_jobs set admin_hidden = false where id = ${guestJob};`)
  out('숨김 공고: anon의 공고 표 조회 vs job_state', { local_jobs_rows_visible_to_anon: hiddenRows, job_state_returns: hiddenState })
  assert.equal(hiddenRows, '0', '숨김 공고는 anon이 표로 못 읽음')
  assert.match(hiddenState, /,t,/, 'job_state는 같은 숨김 공고의 admin_hidden=true를 돌려줌 — 내부 상태 노출(DB 수준)')
  // (다) 토큰으로 지키는 게스트 함수: 토큰 없이·틀린 토큰으로는 아무것도 안 나온다
  const g1 = await asRole('anon', null, null, `select count(*) from public.get_guest_job(${guestJob}, 'wrong-token-wrong-token');`)
  assert.equal(g1.trim().split('\n').pop(), '0', '틀린 토큰으로는 게스트 공고가 안 나옴')
  const g2 = await asRole('anon', null, null, `select count(*) from public.get_guest_job(${guestJob}, '${TOKEN}');`)
  assert.equal(g2.trim().split('\n').pop(), '1', '맞는 토큰은 나옴')
  const g3 = await asRole('anon', null, null, `select count(*) from public.get_guest_job(${empJob}, '${TOKEN}');`)
  assert.equal(g3.trim().split('\n').pop(), '0', '기업 공고는 게스트 토큰으로 안 나옴')

  // ── ④ 후보 권한을 걷으면 정상 비로그인 기능이 깨지는가(같은 트랜잭션 안에서 REVOKE → 정상 경로 9개 → ROLLBACK) ──
  const flows = [
    ['F1 게스트 등록(ingest_job)', (n) => `select public.ingest_job(${`$j$${JSON.stringify({ ...jobPayload('flow' + n), guest_manage_token: 'f'.repeat(24) })}$j$::jsonb`});`],
    ['F2 get_guest_job', () => `select count(*) from public.get_guest_job(${guestJob}, '${TOKEN}');`],
    ['F3 update_guest_job', () => `select count(*) from public.update_guest_job(${guestJob}, '${TOKEN}', 'new title');`],
    ['F4 공개 공고 조회', () => `select count(*) from public.local_jobs;`],
    ['F5 storage.objects 조회(정책에 is_account_active)', () => `select count(*) from storage.objects;`],
    ['F6 applications 비로그인 삽입(RLS가 막아야 함)', () => `insert into public.applications(job_id, seeker_id, employer_id, status) values (${empJob}, '${IDS.S1}', '${IDS.E1}', 'submitted');`],
    ['F7 job_brands 조회(정책에 is_admin)', () => `select count(*) from public.job_brands;`],
    ['F8 커뮤니티 조회수 증가', () => `select public.community_increment_views('${post}'::uuid);`],
    ['F9 지도 공개 점(대역 함수)', () => `select count(*) from public.map_r1_public_points('{1}'::bigint[]);`],
  ]
  const runFlows = async (revokeSql) => {
    const S = sess('f'); await S.run('begin;'); if (revokeSql) assert.ok(!isErr(await S.run(revokeSql)), `REVOKE 실패: ${revokeSql}`)
    const res = {}
    let n = 0
    for (const [lab, mk] of flows) {
      await S.run('savepoint f;'); await S.run('set local session authorization authenticator; set local role anon;')
      const o = await S.run(mk(++n)); const bad = isErr(o)
      res[lab] = bad ? errText(o).slice(0, 70) : 'ok'
      await S.run('rollback to savepoint f;'); await S.run('reset role; reset session authorization;')
    }
    await S.run('rollback'); S.close()
    return res
  }
  const baseline = await runFlows(null)
  out('정상 경로 9개(변경 없음, 기준)', baseline)
  // 기준에서 이미 오류인 흐름(예: 비로그인 삽입은 RLS 거부가 정상)은 '기준과 같은 오류'인지로 비교한다
  const candidates = [
    'public.is_account_active(uuid)', 'public.is_admin()', 'public.require_admin()', 'public.crawl_source_allowed(text)', 'public.crawl_source_key(text)',
    'public.job_signal_record_status()', 'public.community_increment_views(uuid)', 'public.map_r1_reserve_call(bigint,uuid)', 'public.job_policy_rules()', 'public.job_policy_decision(text,text,text,text,text)',
    'ingest_private.open_raw(text,text,text,text,jsonb,jsonb,text)', 'ingest_private.link(bigint,bigint)', 'ingest_private.log(bigint,text,text)', 'ingest_private.audit_admin_create(bigint,text)',
    'ingest_private.find_existing(bigint,text,text,text,text,text,text)', 'ingest_private.job_state(bigint)', 'ingest_private.branch_key(text)',
  ]
  const impact = {}
  for (const f of candidates) {
    if (!c.has(`to_regprocedure('${f}') is not null`)) { impact[f] = '함수 없음'; continue }
    const r = await runFlows(`revoke execute on function ${f} from public, anon;`)
    const broken = Object.entries(r).filter(([k, v]) => v !== baseline[k]).map(([k, v]) => `${k.split(' ')[0]}:${v}`)
    impact[f] = broken.length ? broken.join(' / ') : '정상 경로 변화 없음'
    out(`REVOKE from public, anon → ${f}`, { broken_flows: broken.length ? broken : [] })
  }
  console.log('IMPACT_SUMMARY', JSON.stringify(impact))
  // 단언(사실): 기준 흐름이 정상이다 / 정책이 쓰는 함수·입구 도우미를 걷으면 정상 경로가 깨진다(= 일괄 회수가 위험한 이유)
  assert.equal(baseline['F1 게스트 등록(ingest_job)'], 'ok', '기준: 게스트 등록 정상')
  // is_account_active는 PUBLIC 정책(applications·storage.objects)이 쓰지만, 시험 DB에서 anon의 그 표 권한이 이미 없어 F5·F6은 기준에서도 같은 권한 오류다 → 이 정책 경로가 걷기에 깨지는지는 이 환경에서 검증할 수 없다(미검증, 걷지 않음)
  assert.match(baseline['F5 storage.objects 조회(정책에 is_account_active)'] + baseline['F6 applications 비로그인 삽입(RLS가 막아야 함)'], /permission denied for table applications/, '기준: 이 두 흐름은 표 권한 단계에서 이미 거부(정책 함수 의존을 가리는 한계)')
  assert.notEqual(impact['ingest_private.open_raw(text,text,text,text,jsonb,jsonb,text)'], '정상 경로 변화 없음', '입구 도우미는 호출자 권한으로 불려서 걷으면 게스트 등록이 깨져야 함')
  console.log('function_exposure: 조사 완료 — ROW·IMPACT_SUMMARY 줄이 근거')
} finally {
  opened.forEach((s) => { try { s.close() } catch {} })
  c.drop()
}
