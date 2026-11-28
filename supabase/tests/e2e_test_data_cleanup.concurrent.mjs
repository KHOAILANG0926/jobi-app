// 시험 데이터 정리 경로 사전 검증(대표 2026-11-28 지시 3): scripts/ops/e2e-cleanup.mjs가 시험 표식에서 이어진 데이터만 지우고 실제 데이터는 그대로 두는지,
// 중간에 끊긴 실행(일부만 만들어진 상태)·정리 두 번 실행에서도 잔존 0건인지를 실제 migration 전체를 올린 시험용 DB에서 확인한다. 운영 DB 접속 없음.
// 실행: PG_TEST_URL=<폐기용 서버> node supabase/tests/e2e_test_data_cleanup.concurrent.mjs  (real_chain_structure.concurrent.mjs와 같은 방식 — migration 이름 규칙에 걸리지 않아 자동 호출되지 않음)
import assert from 'node:assert/strict'
import { randomBytes } from 'node:crypto'
import { makeChain } from './lib/pg-chain.mjs'
import { jobPayload, callSql } from './lib/pg-race.mjs'
import { cleanupSql, countSql } from '../../scripts/ops/e2e-cleanup.mjs'

const c = await makeChain()
const uid = () => c.scalar('select gen_random_uuid()')
const hex = () => randomBytes(5).toString('hex')
const marker = hex()
const real = hex() // 실제 데이터 역할(표식과 무관)
try {
  const user = (id, email, meta) => c.admin(`insert into auth.users (id, email, raw_user_meta_data) values ('${id}', '${email}', '${JSON.stringify(meta)}'::jsonb);`)
  const jobIdOf = (company) => Number(c.scalar(`select id from public.local_jobs where company like '${company}%' order by id desc limit 1`))
  // 실제 데이터 역할: 실제 계정 2·공고 1·지원·대화·면접
  const rE = uid(), rS = uid()
  user(rE, `real-${real}-e@example.com`, { role: 'employer' }); user(rS, `real-${real}-s@example.com`, { role: 'seeker' })
  c.admin(callSql(jobPayload(real, { company: `CTY Real ${real}` })))
  const rJob = jobIdOf(`CTY Real ${real}`)
  assert.ok(rJob > 0, '실제 역할 공고가 안 만들어짐')
  c.admin(`set session_replication_role = replica; -- 지원 열림 검사는 따로 시험됨(job_apply_and_contact_gate) — 여기선 정리 경로만 본다
    insert into public.applications (job_id, seeker_id, employer_id) values (${rJob}, '${rS}', '${rE}');
    insert into public.message_threads (job_id, seeker_id, employer_id) values (${rJob}, '${rS}', '${rE}');
    insert into public.interviews (job_id, seeker_id, employer_id, datetime) values (${rJob}, '${rS}', '${rE}', now());`)
  const snapshot = () => c.scalar(`select (select count(*) from public.local_jobs) || '/' || (select count(*) from auth.users) || '/' || (select count(*) from public.applications) || '/' || (select count(*) from public.message_threads) || '/' || (select count(*) from public.interviews) || '/' || (select count(*) from public.job_work_locations)`)
  const before = snapshot()

  // 시험 데이터: 계정 2·공고 1(표식 회사)·지원·대화·메시지·면접 + 외래키 없는 표(감사 기록)에 표식 글자
  const tE = uid(), tS = uid()
  user(tE, `vgb-e2e-${marker}-employer@example.invalid`, { role: 'employer', e2e_marker: marker }); user(tS, `vgb-e2e-${marker}-seeker@example.invalid`, { role: 'seeker', e2e_marker: marker })
  c.admin(callSql(jobPayload(marker, { company: `VGB-E2E ${marker}` })))
  const tJob = jobIdOf(`VGB-E2E ${marker}`)
  assert.ok(tJob > 0, '시험 공고가 안 만들어짐')
  c.admin(`set session_replication_role = replica; -- 지원 열림 검사는 따로 시험됨(job_apply_and_contact_gate) — 여기선 정리 경로만 본다
    insert into public.applications (job_id, seeker_id, employer_id) values (${tJob}, '${tS}', '${tE}');
    insert into public.message_threads (job_id, seeker_id, employer_id) values (${tJob}, '${tS}', '${tE}');
    insert into public.messages (thread_id, from_role, body) select id, 'seeker', 'e2e ${marker}' from public.message_threads where job_id = ${tJob};
    insert into public.interviews (job_id, seeker_id, employer_id, datetime) values (${tJob}, '${tS}', '${tE}', now());
    insert into public.admin_audit_logs (admin_user_id, action, target_type, target_id, metadata) values ('${tE}', 'e2e', 'job', '${tJob}', '{"m":"${marker}"}'::jsonb);`)
  const mid = snapshot()
  assert.notEqual(before, mid, '시험 데이터가 실제로 늘었어야 함')
  assert.equal(c.scalar(countSql(marker)).replace(/\s/g, ''), '1|2', '지울 대상은 공고 1·계정 2')
  console.log('시험 데이터 생성 후:', mid, '/ 실제 데이터만일 때:', before)

  // 정리 1회: 모든 시험 행 삭제, 실제 데이터 그대로, 잔존 0
  const out1 = c.admin(cleanupSql(marker))
  console.log(out1.split('\n').filter((l) => /_deleted|residual/.test(l)).map((l) => l.trim()).join(' / '))
  assert.equal(snapshot(), before, '정리 뒤 개수가 실제 데이터만 있을 때와 같아야 함(실제 데이터 불변)')
  assert.match(out1, /residual\s*\|\s*0/)
  assert.equal(c.scalar(`select count(*) from public.admin_audit_logs where metadata::text like '%${marker}%'`), '0', '외래키 없는 표의 표식 행도 정리')
  assert.equal(c.scalar(`select count(*) from public.local_jobs where id = ${rJob}`), '1', '실제 공고 보존')
  assert.equal(c.scalar(`select count(*) from public.applications where job_id = ${rJob}`), '1', '실제 지원 보존')

  // 정리 2회(이미 없음): 오류 없이 0. 끊긴 실행 시뮬레이션 — 계정만 만들어진 상태에서도 정리
  assert.match(c.admin(cleanupSql(marker)), /residual\s*\|\s*0/)
  const m2 = hex(), pE = uid()
  user(pE, `vgb-e2e-${m2}-employer@example.invalid`, { role: 'employer', e2e_marker: m2 })
  const out3 = c.admin(cleanupSql(m2)); assert.match(out3, /users_deleted\s*\|\s*[1-9]/); assert.match(out3, /residual\s*\|\s*0/)
  // 표식이 맞지 않는 계정(이메일만 같고 가입 정보 표식 없음)은 지우지 않는다
  const m3 = hex(), qE = uid()
  user(qE, `vgb-e2e-${m3}-employer@example.invalid`, { role: 'employer' })
  c.admin(cleanupSql(m3))
  assert.equal(c.scalar(`select count(*) from auth.users where id = '${qE}'`), '1', '가입 정보 표식 없는 계정은 보존')
  assert.throws(() => cleanupSql("x'; select 1;--"), /marker/)
  console.log('PASS: 시험 데이터 정리 경로 — 표식 데이터만 삭제·실제 데이터 불변·끊긴 실행·재실행·표식 없는 계정 보존·잔존 0')
} finally { c.drop() }
