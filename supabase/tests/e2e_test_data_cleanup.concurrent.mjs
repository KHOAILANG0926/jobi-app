// 시험 데이터 정리 경로 사전 검증(대표 2026-11-28 지시 3, 독립 검토 반영): scripts/ops/e2e-cleanup.mjs가 소유권(식별자)으로만 지우고
// 어긋나면 아무것도 지우지 않는(fail-closed) 것을 실제 migration 전체를 올린 시험용 DB에서 확인한다. 운영 DB 접속 없음.
// 실행: PG_TEST_URL=<폐기용 서버> node supabase/tests/e2e_test_data_cleanup.concurrent.mjs  (real_chain_structure.concurrent.mjs와 같은 방식 — migration 이름 규칙에 걸리지 않아 자동 호출되지 않음)
//  A 정상: 시험 공고·계정·지원·대화·메시지·면접 삭제, 실제 데이터 불변, 표별 삭제 건수 표, 뿌리 잔존 0
//  B 반례: 실제 데이터 글자에 같은 marker가 들어 있어도 지우지 않음(글자 일괄 삭제 없음)
//  C 중단(fail-closed, 삭제 0건·전체 취소): 실제 이용자가 시험 공고에 지원 / 시험 계정이 실제 공고에 지원 / 뿌리 개수가 상한 초과 /
//     명시 목록 밖 표가 외래키로 붙잡음 / 명시 목록 밖 표에 외래키 없는 참조 / DELETE RETURNING 수 ≠ 예상 수
//  D 끊긴 실행(계정만)·재실행·표식 없는 계정 보존
import assert from 'node:assert/strict'
import { randomBytes } from 'node:crypto'
import { makeChain } from './lib/pg-chain.mjs'
import { jobPayload, callSql } from './lib/pg-race.mjs'
import { cleanupSql, countSql } from '../../scripts/ops/e2e-cleanup.mjs'

const c = await makeChain()
const hex = () => randomBytes(5).toString('hex')
const uid = () => c.scalar('select gen_random_uuid()')
const run = (sql) => { try { return { ok: true, out: c.admin(sql) } } catch (e) { return { ok: false, out: String(e.message) } } }
const marker = hex(), real = hex()
const user = (id, email, meta) => c.admin(`insert into auth.users (id, email, raw_user_meta_data) values ('${id}', '${email}', '${JSON.stringify(meta)}'::jsonb);`)
const jobIdOf = (company) => Number(c.scalar(`select id from public.local_jobs where company like '${company}%' order by id desc limit 1`))
const newJob = (company, extra = {}) => { c.admin(callSql(jobPayload(hex(), { company, ...extra }))); return jobIdOf(company) }
const raw = (sql) => c.admin(`set session_replication_role = replica; -- 지원 열림 검사 등은 따로 시험됨(job_apply_and_contact_gate) — 여기선 정리 경로만 본다\n${sql}`)
const snapshot = () => c.scalar(`select (select count(*) from public.local_jobs) || '/' || (select count(*) from auth.users) || '/' || (select count(*) from public.applications) || '/' || (select count(*) from public.message_threads) || '/' || (select count(*) from public.interviews) || '/' || (select count(*) from public.job_work_locations) || '/' || (select count(*) from public.admin_audit_logs) || '/' || (select count(*) from public.messages) || '/' || (select count(*) from public.job_alert_notifications) || '/' || (select count(*) from public.reports)`)
try {
  // 실제 데이터 역할: 실제 계정 2·공고 1(원문에 같은 marker 글자 포함)·지원·대화·면접·감사 기록(메타에 marker 글자)
  const rE = uid(), rS = uid(); user(rE, `real-${real}-e@example.com`, { role: 'employer' }); user(rS, `real-${real}-s@example.com`, { role: 'seeker' })
  c.admin(callSql(jobPayload(real, { company: `CTY Real ${real}`, source_text: `원문 ${real} 우연히 ${marker} 글자 포함` })))
  const rJob = jobIdOf(`CTY Real ${real}`); assert.ok(rJob > 0)
  raw(`insert into public.applications (job_id, seeker_id, employer_id) values (${rJob}, '${rS}', '${rE}');
    insert into public.message_threads (job_id, seeker_id, employer_id) values (${rJob}, '${rS}', '${rE}');
    insert into public.interviews (job_id, seeker_id, employer_id, datetime) values (${rJob}, '${rS}', '${rE}', now());
    insert into public.admin_audit_logs (admin_user_id, action, target_type, target_id, metadata) values ('${rE}', 'real', 'job', '${rJob}', '{"note":"${marker}"}'::jsonb);`)
  const rJob2 = newJob(`CTY Real2 ${real}`)
  const rJobPrefix = newJob(`VGB-E2E ${marker}zz`) // 같은 접두 글자지만 경계가 달라 시험 공고가 아님(실제 공고 역할)
  raw(`insert into public.messages (thread_id, from_role, body) select id, 'seeker', 'real' from public.message_threads where job_id = ${rJob};`)
  const before = snapshot()

  // 시험 데이터
  const tE = uid(), tS = uid()
  user(tE, `vgb-e2e-${marker}-employer@example.invalid`, { role: 'employer', e2e_marker: marker }); user(tS, `vgb-e2e-${marker}-seeker@example.invalid`, { role: 'seeker', e2e_marker: marker })
  const tJob = newJob(`VGB-E2E ${marker}`); assert.ok(tJob > 0)
  raw(`insert into public.applications (job_id, seeker_id, employer_id) values (${tJob}, '${tS}', '${tE}');
    insert into public.message_threads (job_id, seeker_id, employer_id) values (${tJob}, '${tS}', '${tE}');
    insert into public.messages (thread_id, from_role, body) select id, 'seeker', 'e2e ${marker}' from public.message_threads where job_id = ${tJob};
    insert into public.interviews (job_id, seeker_id, employer_id, datetime) values (${tJob}, '${tS}', '${tE}', now());
    insert into public.admin_audit_logs (admin_user_id, action, target_type, target_id, metadata) values ('${tE}', 'e2e', 'job', '${tJob}', '{"m":"x"}'::jsonb);`)
  const mid = snapshot(); assert.notEqual(before, mid)
  assert.equal(c.scalar(countSql(marker)).replace(/\s/g, ''), '1|2')

  // ── C 중단 사례(삭제 0건·전체 취소). 각 사례 뒤 개수가 그대로여야 하고, 원인을 치우면 정리가 통과해야 한다.
  const mustAbort = (label, sql, re, opts) => {
    const snap = snapshot(); const r = run(sql ?? cleanupSql(marker, opts))
    assert.equal(r.ok, false, `${label}: 중단됐어야 함`); assert.match(r.out, re, `${label}: 중단 사유 — ${r.out.slice(0, 200)}`)
    assert.equal(snapshot(), snap, `${label}: 중단 뒤 데이터 불변(전체 취소)`)
    console.log(`PASS(중단): ${label}`)
  }
  // C1 실제 이용자가 시험 공고에 지원
  raw(`insert into public.applications (job_id, seeker_id, employer_id) values (${tJob}, '${rS}', '${tE}');`)
  mustAbort('실제 이용자가 시험 공고에 지원', null, /시험 뿌리가 아닌/)
  raw(`delete from public.applications where seeker_id = '${rS}' and job_id = ${tJob};`)
  // C2 시험 계정이 실제 공고에 지원 → 시험 계정 쪽 행이라도 실제 공고에 걸린 건 정리 대상이지만, 실제 고용주(employer_id) 칸이 시험 계정이 아니므로 중단
  raw(`insert into public.applications (job_id, seeker_id, employer_id) values (${rJob2}, '${tS}', '${rE}');`)
  mustAbort('시험 계정이 실제 공고에 지원(실제 고용주 칸)', null, /시험 뿌리가 아닌/)
  raw(`delete from public.applications where job_id = ${rJob2};`)
  // C3 뿌리 개수 상한 초과(표식 충돌 시뮬레이션)
  const extraJob = newJob(`VGB-E2E ${marker} extra`)
  mustAbort('시험 공고 뿌리가 상한 초과', null, /상한 1/)
  raw(`delete from public.local_jobs where id = ${extraJob};`)
  // C4 허용 목록 밖 표가 외래키로 닿음
  c.admin(`create table public.zz_unexpected (id serial primary key, job_id bigint references public.local_jobs(id)); insert into public.zz_unexpected (job_id) values (${tJob});`)
  mustAbort('명시 목록 밖 표가 외래키로 붙잡음(삭제 전 점검)', null, /명시 처리 목록에 없는 표/)
  c.admin('drop table public.zz_unexpected;')
  // C5 허용 목록 밖 표에 외래키 없는 참조
  c.admin(`create table public.zz_nofk (job_id bigint); insert into public.zz_nofk values (${tJob});`)
  mustAbort('외래키 없는 참조가 명시 목록 밖에 남음', null, /남은 참조/)
  c.admin('drop table public.zz_nofk;')

  // C7 실제 구직자가 시험 공고에 대화·면접
  raw(`insert into public.message_threads (job_id, seeker_id, employer_id) values (${tJob}, '${rS}', '${tE}');`)
  mustAbort('실제 구직자가 시험 공고에 대화(소유권)', null, /시험 뿌리가 아닌/)
  raw(`delete from public.message_threads where seeker_id = '${rS}' and job_id = ${tJob};`)
  raw(`insert into public.interviews (job_id, seeker_id, employer_id, datetime) values (${tJob}, '${rS}', '${tE}', now());`)
  mustAbort('실제 구직자가 시험 공고에 면접(소유권)', null, /시험 뿌리가 아닌/)
  raw(`delete from public.interviews where seeker_id = '${rS}' and job_id = ${tJob};`)
  // C8 시험 계정이 실제 대상에 한 관리 기록 → 남은 참조로 중단(지우지 않음)
  c.admin(`insert into public.admin_audit_logs (admin_user_id, action, target_type, target_id, metadata) values ('${tE}', 'e2e-real-target', 'job', '${rJob}', '{}'::jsonb);`)
  mustAbort('시험 계정의 실제 대상 관리 기록은 지우지 않고 중단', null, /남은 참조/)
  c.admin(`delete from public.admin_audit_logs where action = 'e2e-real-target';`)
  // C9 명시 처리 목록 밖 표(reports)가 시험 계정을 참조 → 연쇄 삭제 전에 중단
  c.admin(`insert into public.reports (reporter_id, target_type, target_id, category) values ('${tS}', 'job', '${rJob}', 'x');`)
  mustAbort('명시 목록 밖 표(reports)가 시험 계정을 참조(삭제 전 점검)', null, /명시 처리 목록에 없는 표/)
  c.admin(`delete from public.reports where reporter_id = '${tS}';`)
  // C10 실제 구독자의 알림이 시험 공고에 걸림
  c.admin(`insert into public.job_alert_preferences (seeker_id, region_importance, region_ids) values ('${rS}', 'required', array['bac-ninh']);
    insert into public.job_alert_notifications (seeker_id, preference_id, job_id, result) select '${rS}', id, ${tJob}, '{}'::jsonb from public.job_alert_preferences where seeker_id = '${rS}';`)
  mustAbort('실제 구독자의 알림이 시험 공고에 걸림(소유권)', null, /시험 공고에 걸린 알림/)
  c.admin(`delete from public.job_alert_notifications where seeker_id = '${rS}'; delete from public.job_alert_preferences where seeker_id = '${rS}';`)
  // C6 DELETE … RETURNING 수가 예상과 다름(트리거가 삭제를 가로채는 경우) → 전체 취소
  c.admin(`create function public.zz_skip_del() returns trigger language plpgsql as $$ begin return null; end $$;
    create trigger zz_skip before delete on public.interviews for each row execute function public.zz_skip_del();`)
  mustAbort('DELETE RETURNING 수 ≠ 예상 수', null, /삭제 0 건 ≠ 예상 1 건/)
  c.admin('drop trigger zz_skip on public.interviews; drop function public.zz_skip_del();')

  // ── A 정상 + B 반례
  const out1 = c.admin(cleanupSql(marker))
  console.log(out1.split('\n').filter((l) => /\|/.test(l)).map((l) => l.replace(/\s+/g, ' ').trim()).join('\n'))
  const after = snapshot()
  assert.equal(after, before, '정리 뒤 모든 개수가 시험 데이터 생성 전(실제 데이터만)과 정확히 같아야 함')
  assert.equal(c.scalar(`select count(*) from public.local_jobs where id = ${rJobPrefix}`), '1', '접두 글자만 같은 공고는 시험 공고가 아니므로 보존')
  assert.equal(c.scalar(`select count(*) from auth.users where id in ('${rE}', '${rS}')`), '2', '실제 계정 2개 보존')
  // 시험 데이터가 만든 행만큼 줄었고, 실제 역할(공고 2: rJob·rJob2, 계정 2, 지원 1, 대화 1, 면접 1, 감사 1)만 남는다
  assert.equal(c.scalar(`select count(*) from public.local_jobs where id in (${rJob}, ${rJob2})`), '2', '실제 공고 보존')
  assert.equal(c.scalar(`select count(*) from public.local_jobs where company = 'VGB-E2E ${marker}' or company like 'VGB-E2E ${marker} %'`), '0')
  assert.equal(c.scalar(`select count(*) from auth.users where raw_user_meta_data->>'e2e_marker' = '${marker}'`), '0')
  assert.equal(c.scalar(`select count(*) from public.applications where job_id = ${rJob}`), '1', '실제 지원 보존')
  assert.equal(c.scalar(`select count(*) from public.message_threads where job_id = ${rJob}`), '1')
  assert.equal(c.scalar(`select count(*) from public.interviews where job_id = ${rJob}`), '1')
  assert.equal(c.scalar(`select count(*) from public.admin_audit_logs where metadata->>'note' = '${marker}'`), '1', 'B: marker 글자가 든 실제 감사 기록 보존')
  assert.equal(c.scalar(`select count(*) from public.local_jobs where source_text like '%${marker}%'`), '1', 'B: marker 글자가 든 실제 공고 원문 보존')
  assert.match(out1, /residual\s*\|\s*0/)
  assert.ok(out1.split('\n').some((l) => /^\s*public\.applications\s*\|\s*1\s*$/.test(l)), '지원서 1건 삭제 표')
  assert.equal(c.scalar(`select count(*) from public.messages where body like '%${marker}%'`), '0', '시험 메시지 0')
  console.log('PASS(정상·반례): 표식 소유 데이터만 삭제, marker 글자가 든 실제 데이터 보존, 뿌리 잔존 0 /', after)

  // ── D 재실행·끊긴 실행·표식 없는 계정
  assert.match(c.admin(cleanupSql(marker)), /residual\s*\|\s*0/)
  const m2 = hex(), pE = uid(); user(pE, `vgb-e2e-${m2}-employer@example.invalid`, { role: 'employer', e2e_marker: m2 })
  assert.match(c.admin(cleanupSql(m2)), /residual\s*\|\s*0/)
  assert.equal(c.scalar(`select count(*) from auth.users where id = '${pE}'`), '0', '끊긴 실행(계정만)도 정리')
  const m3 = hex(), qE = uid(); user(qE, `vgb-e2e-${m3}-employer@example.invalid`, { role: 'employer' })
  c.admin(cleanupSql(m3))
  assert.equal(c.scalar(`select count(*) from auth.users where id = '${qE}'`), '1', '가입 정보 표식 없는 계정은 보존')
  assert.throws(() => cleanupSql("x'; select 1;--"), /marker/)
  assert.throws(() => cleanupSql(marker, { maxJobs: -1 }), /maxJobs/)
  console.log('PASS: 시험 데이터 정리 경로 전 사례 — 소유권 기준 삭제·fail-closed 6종·반례·재실행·끊긴 실행·표식 없는 계정 보존')
} finally { c.drop() }
