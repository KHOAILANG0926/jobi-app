// 20261126030000_job_duplicate_decide_admin_check.sql — 실제 PostgreSQL 역할별 시험(보안 결함 재현 → 수정 후 차단). 운영 DB 접속 없음.
// 함수는 운영 20261107070000 본문을 파일에서 그대로 올리고, 역할·요청 토큰(auth.uid·auth.role·관리자 토큰)은 Supabase와 같은 방식으로 설정한다.
import assert from 'node:assert/strict'
import { makeScratch, mig, grab, IDS, isErr, errText } from './lib/pg-race.mjs'

const db = await makeScratch()
const sess = []
try {
  const src = mig('20261107070000_job_duplicate_check.sql')
  db.admin(`
    alter table public.local_jobs add column duplicate_status text, add column duplicate_reason text;
    alter table public.local_jobs disable trigger trg_000_ingest_gateway_only; -- 시험 준비용 직접 INSERT만(시험 대상은 중복 확정 함수의 권한 — 입구 규칙과 무관)
    create or replace function auth.role() returns text language sql stable as $f$ select coalesce(nullif(current_setting('request.jwt.claim.role', true), ''), nullif(current_setting('request.jwt.claims', true), '')::jsonb ->> 'role') $f$;
    ${grab(src, /create function public\.job_duplicate_decide/, /grant execute on function public\.job_duplicate_decide[^\n]*;/)}
  `)
  let n = 0
  const suspectJob = () => Number(db.scalar(`insert into public.local_jobs(title, company, origin, active, duplicate_status) values ('t${++n}', 'c', 'crawler', true, 'suspect') returning id`))
  const call = async (role, sub, claims, decision = 'duplicate') => {
    const id = suspectJob()
    const S = db.sess('S' + n); sess.push(S)
    await S.begin(role, sub, claims)
    const out = await S.run(`select public.job_duplicate_decide(${id}, '${decision}');`)
    await S.run('rollback'); S.close()
    return { id, out, ok: !isErr(out) }
  }
  const ADMIN = { app_metadata: { role: 'admin' } }
  const suite = async (patched) => {
    const tag = patched ? '적용 후' : '적용 전(운영 현재)'
    const emp = await call('authenticated', IDS.E1, {})
    if (patched) assert.ok(!emp.ok && /관리자만/.test(emp.out), `${tag}: 일반 기업 계정 거부 (${errText(emp.out)})`)
    else assert.ok(emp.ok, `${tag}: 일반 기업 계정이 통과 — 결함 재현 (${errText(emp.out)})`)
    const seeker = await call('authenticated', IDS.S1, {})
    assert.equal(seeker.ok, !patched, `${tag}: 일반 구직자 계정 ${patched ? '거부' : '통과(결함 재현)'}`)
    const adm = await call('authenticated', IDS.ADM, ADMIN); assert.ok(adm.ok, `${tag}: 관리자 토큰 통과 (${errText(adm.out)})`)
    const svc = await call('service_role', null, { role: 'service_role' }); assert.ok(svc.ok, `${tag}: 서버 키(service_role 토큰) 통과 (${errText(svc.out)})`)
    const anon = await call('anon', null, null); assert.match(anon.out, /permission denied/, `${tag}: 비로그인은 실행 권한 없음`)
    // 직접 연결(마이그레이션·승인된 DB 작업) — 요청 토큰 없이 소유자 연결
    const id = suspectJob(); assert.equal(db.scalar(`select public.job_duplicate_decide(${id}, 'not_duplicate')`), 'cleared', `${tag}: 직접 연결(session_user=postgres) 통과`)
    // 통과한 경우 실제로 공고가 바뀐다(결함의 영향 확인): 일반 계정으로 '중복' 확정 → 비공개
    const eff = suspectJob(); const S = db.sess('E'); sess.push(S); await S.begin('authenticated', IDS.E1, {})
    await S.run(`select public.job_duplicate_decide(${eff}, 'duplicate');`); await S.run('commit'); S.close()
    assert.equal(db.scalar(`select coalesce(duplicate_status, '') from public.local_jobs where id = ${eff}`), patched ? 'suspect' : 'duplicate', `${tag}: 일반 계정 호출 뒤 중복 상태(공개 여부는 수집 공고 공개 판정이 따로 정함)`)
  }
  await suite(false)
  console.log('적용 전: 일반 계정이 중복 확정을 할 수 있는 결함 재현')
  db.admin(mig('20261126030000_job_duplicate_decide_admin_check.sql'))
  await suite(true)
  console.log('job_duplicate_decide_admin_check.concurrent: 역할별 시험 통과 (결함 재현 → 수정 후 일반 계정 차단, 관리자·서버 키·직접 연결은 그대로)')
} finally { sess.forEach((s) => { try { s.close() } catch {} }); db.drop() }
