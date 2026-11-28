// 시험 데이터 정리(대표 2026-11-28 지시 3·#1192 안전성 수정): 고용주·구직자 운영 시험이 만든 데이터만 지우고 잔존 0건을 확인하는 한 곳.
// 새 표·함수·구조 없음 — 실행 안에서만 쓰는 임시 객체(pg_temp)와 SQL 한 묶음. **하나의 트랜잭션**에서 식별 → 소유권 확인 → 삭제 → 결과 검증을 하고,
// 어느 단계든 어긋나면 RAISE로 전체 ROLLBACK(fail-closed)한다.
// 삭제 방식(글자 일괄 삭제·외래키 따라 재귀 삭제 없음):
//  ① 뿌리: 계정 = 이메일 vgb-e2e-<marker>-*@example.invalid AND 가입 정보 e2e_marker = marker / 공고 = 회사 이름 'VGB-E2E <marker>'로 시작.
//     뿌리 개수가 상한(maxJobs·maxUsers)을 넘으면 중단(표식 충돌).
//  ② 정확한 id 목록: 지원서·대화·면접은 id(uuid) 목록으로, 메시지는 그 대화 id로, 공고·계정 하위 표는 아래 **명시 표·열 목록**(TABLES)에서 뿌리 id로만 고른다.
//  ③ 소유권: 지원서·대화·면접 행은 공고·구직자·고용주가 **모두 시험 뿌리**여야 한다(실제 이용자·실제 공고가 하나라도 섞이면 중단). 시험 공고의 고용주 칸도 시험 계정(또는 비어 있음)이어야 한다.
//  ④ 표마다 `DELETE … RETURNING`으로 지운 행 수를 세어 미리 센 예상 수와 다르면 중단. 명시 목록에 없는 표가 외래키로 이 행들을 붙잡고 있으면 DB가 삭제를 거부 → 전체 취소.
//  ⑤ 마지막으로 공고 번호·계정 id를 값으로 가진 모든 표(외래키 유무 무관)에 남은 참조를 읽기로 확인해, 있으면 중단.
//  ⑥ 뿌리가 모두 사라졌는지 확인(잔존 0).
// 목록(TABLES)에 없는 표를 정리하려면 이 목록을 승인된 PR로 늘린다(자동 확대 없음).
// 사용: cleanupSql(marker, {maxJobs, maxUsers}) → 마지막 SELECT들이 표별 삭제 건수와 잔존. 운영 DB 접속은 이 저장소 규정상 ops-keys 워크플로 안에서만.

export const SAFE_MARKER = /^[0-9a-f]{8,32}$/
// 명시 표·열 목록(지운 순서). byJob = 시험 공고 id를 값으로 가진 칸, byUser = 시험 계정 id를 값으로 가진 칸.
export const TABLES = {
  byJob: [
    ['public.job_work_locations', 'job_id'], ['public.job_location_candidates', 'job_id'], ['public.job_ai_suggestions', 'job_id'],
    ['public.job_alert_notifications', 'job_id'], ['public.job_reprocess_queue', 'job_id'], ['public.map_r1_location_jobs', 'job_id'],
    ['public.map_r1_search_history', 'job_id'], ['public.map_r1_unlocated', 'job_id'],
  ],
  byUser: [
    ['public.job_alert_notifications', 'seeker_id'], ['public.job_alert_preferences', 'seeker_id'], ['public.job_alert_home_locations', 'seeker_id'],
    ['public.account_roles', 'user_id'], ['public.account_statuses', 'user_id'], ['public.user_profiles', 'user_id'], ['public.user_cvs', 'user_id'],
  ],
}

export function cleanupSql(marker, { maxJobs = 1, maxUsers = 2 } = {}) {
  if (!SAFE_MARKER.test(marker)) throw new Error('marker 형식 오류(16진 8~32자)')
  if (!Number.isInteger(maxJobs) || !Number.isInteger(maxUsers) || maxJobs < 0 || maxUsers < 0) throw new Error('maxJobs·maxUsers는 0 이상 정수')
  const del = ([t, col], src) => `select pg_temp.vgb_del('${t}.${col}', $c$select count(*) from ${t} where ${col} in (select id from ${src})$c$, $d$delete from ${t} where ${col} in (select id from ${src}) returning 1$d$);`
  return `
begin;
create temp table vgb_jobs on commit drop as select id from public.local_jobs where company = 'VGB-E2E ${marker}' or company like 'VGB-E2E ${marker} %';
create temp table vgb_users on commit drop as select id from auth.users where email like 'vgb-e2e-${marker}-%@example.invalid' and raw_user_meta_data->>'e2e_marker' = '${marker}';
create temp table vgb_log (tbl text, n bigint) on commit drop;
-- 식별 뒤 삭제까지 뿌리 행을 잠가, 그 사이 실제 이용자가 시험 공고·계정에 새 행(지원 등)을 붙이지 못하게 한다(자식 행 삽입은 부모 행 잠금을 기다리다 부모가 지워지면 외래키 오류)
select id from public.local_jobs where id in (select id from vgb_jobs) for update;
select id from auth.users where id in (select id from vgb_users) for update;

-- ① 뿌리 상한
do $g$ begin
  if (select count(*) from vgb_jobs) > ${maxJobs} then raise exception 'vgb_cleanup: 시험 공고 % > 상한 ${maxJobs} — 표식 충돌 의심, 중단', (select count(*) from vgb_jobs); end if;
  if (select count(*) from vgb_users) > ${maxUsers} then raise exception 'vgb_cleanup: 시험 계정 % > 상한 ${maxUsers} — 표식 충돌 의심, 중단', (select count(*) from vgb_users); end if;
end $g$;

-- ② 정확한 id 목록(지원서·대화·면접) + 메시지
create temp table vgb_apps on commit drop as select id, job_id, seeker_id, employer_id from public.applications
  where job_id in (select id from vgb_jobs) or seeker_id in (select id from vgb_users) or employer_id in (select id from vgb_users);
create temp table vgb_threads on commit drop as select id, job_id, seeker_id, employer_id from public.message_threads
  where job_id in (select id from vgb_jobs) or seeker_id in (select id from vgb_users) or employer_id in (select id from vgb_users);
create temp table vgb_ivs on commit drop as select id, job_id, seeker_id, employer_id from public.interviews
  where job_id in (select id from vgb_jobs) or seeker_id in (select id from vgb_users) or employer_id in (select id from vgb_users);
create temp table vgb_msgs on commit drop as select id from public.messages where thread_id in (select id from vgb_threads);
create temp table vgb_raw on commit drop as select id from public.job_ingest_raw where job_id in (select id from vgb_jobs);

-- ③ 소유권: 공고·구직자·고용주가 모두 시험 뿌리여야 한다
do $o$
declare bad bigint; nm text;
begin
  for nm in select unnest(array['vgb_apps', 'vgb_threads', 'vgb_ivs']) loop
    execute format('select count(*) from %I where coalesce(job_id in (select id from vgb_jobs) and seeker_id in (select id from vgb_users) and employer_id in (select id from vgb_users), false) is not true', nm) into bad;
    if bad > 0 then raise exception 'vgb_cleanup: % 에 시험 뿌리가 아닌 공고·이용자가 섞인 행 % 건 — 실제 데이터 보호를 위해 중단', nm, bad; end if;
  end loop;
  select count(*) into bad from public.job_alert_notifications where job_id in (select id from vgb_jobs) and seeker_id not in (select id from vgb_users);
  if bad > 0 then raise exception 'vgb_cleanup: 시험 공고에 걸린 알림 중 구독자가 시험 계정이 아님 % 건 — 중단', bad; end if;
  select count(*) into bad from public.local_jobs where id in (select id from vgb_jobs) and employer_id is not null and employer_id not in (select id from vgb_users);
  if bad > 0 then raise exception 'vgb_cleanup: 시험 공고의 고용주 칸이 시험 계정이 아님 % 건 — 중단', bad; end if;
end $o$;

-- ③-2 삭제 전 읽기 점검: 공고·계정을 외래키로 참조하는 모든 표(모든 스키마, auth 내부 표 제외) 중 아래 명시 처리 목록에 없는 표에 시험 뿌리를 가리키는 행이 있으면 중단
-- (공고·계정 삭제의 ON DELETE CASCADE로 실제 이용자 행이 조용히 따라 지워지는 일을 막는다)
do $p$
declare fk record; c bigint; src text; handled text[] := array[${[
    'public.applications', 'public.message_threads', 'public.interviews', 'public.local_jobs', 'public.job_ingest_raw', 'public.admin_audit_logs',
    ...TABLES.byJob.map((t) => t[0]), ...TABLES.byUser.map((t) => t[0]),
  ].filter((v, i, a) => a.indexOf(v) === i).map((v) => `'${v}'`).join(', ')}];
begin
  for fk in select (select n.nspname || '.' || r.relname from pg_class r join pg_namespace n on n.oid = r.relnamespace where r.oid = k.conrelid) as tbl, a.attname as col,
      case when k.confrelid = 'public.local_jobs'::regclass then 'public.local_jobs' else 'auth.users' end as parent
    from pg_constraint k join pg_attribute a on a.attrelid = k.conrelid and a.attnum = k.conkey[1]
    where k.contype = 'f' and array_length(k.conkey, 1) = 1 and k.confrelid in ('public.local_jobs'::regclass, 'auth.users'::regclass)
      loop
    continue when fk.tbl = any (handled) or fk.tbl like 'auth.%';
    src := case when fk.parent = 'public.local_jobs' then 'vgb_jobs' else 'vgb_users' end;
    execute format('select count(*) from %s where %I in (select id from %s)', fk.tbl, fk.col, src) into c;
    if c > 0 then raise exception 'vgb_cleanup: 명시 처리 목록에 없는 표 %.% 가 시험 뿌리를 참조(% 건) — 실제 데이터가 연쇄 삭제될 수 있어 중단', fk.tbl, fk.col, c; end if;
  end loop;
end $p$;

-- ④ 표별 DELETE … RETURNING 수 = 예상 수
create or replace function pg_temp.vgb_del(label text, count_sql text, delete_sql text) returns void language plpgsql as $f$
declare e bigint; n bigint;
begin
  execute count_sql into e;
  execute format('with d as (%s) select count(*) from d', delete_sql) into n;
  if n <> e then raise exception 'vgb_cleanup: % 삭제 % 건 ≠ 예상 % 건 — 전체 취소', label, n, e; end if;
  insert into vgb_log values (label, n);
end $f$;

select pg_temp.vgb_del('public.messages', 'select count(*) from public.messages where id in (select id from vgb_msgs)', 'delete from public.messages where id in (select id from vgb_msgs) returning 1');
select pg_temp.vgb_del('public.interviews', 'select count(*) from public.interviews where id in (select id from vgb_ivs)', 'delete from public.interviews where id in (select id from vgb_ivs) returning 1');
select pg_temp.vgb_del('public.message_threads', 'select count(*) from public.message_threads where id in (select id from vgb_threads)', 'delete from public.message_threads where id in (select id from vgb_threads) returning 1');
select pg_temp.vgb_del('public.applications', 'select count(*) from public.applications where id in (select id from vgb_apps)', 'delete from public.applications where id in (select id from vgb_apps) returning 1');
select pg_temp.vgb_del('public.job_ingest_log(raw_id)', 'select count(*) from public.job_ingest_log where raw_id in (select id from vgb_raw)', 'delete from public.job_ingest_log where raw_id in (select id from vgb_raw) returning 1');
select pg_temp.vgb_del('public.job_ingest_raw', 'select count(*) from public.job_ingest_raw where id in (select id from vgb_raw)', 'delete from public.job_ingest_raw where id in (select id from vgb_raw) returning 1');
${TABLES.byJob.map((t) => del(t, 'vgb_jobs')).join('\n')}
select pg_temp.vgb_del('public.local_jobs', 'select count(*) from public.local_jobs where id in (select id from vgb_jobs)', 'delete from public.local_jobs where id in (select id from vgb_jobs) returning 1');
${TABLES.byUser.map((t) => del(t, 'vgb_users')).join('\n')}
-- 감사 기록: 시험 계정이 시험 공고에 한 것만 지운다(시험 계정이 실제 대상에 한 기록이 있으면 아래 ⑤가 남은 참조로 보고 중단)
select pg_temp.vgb_del('public.admin_audit_logs(시험 공고 대상)', $c$select count(*) from public.admin_audit_logs where admin_user_id in (select id from vgb_users) and target_type = 'job' and target_id in (select id::text from vgb_jobs)$c$, $d$delete from public.admin_audit_logs where admin_user_id in (select id from vgb_users) and target_type = 'job' and target_id in (select id::text from vgb_jobs) returning 1$d$);

-- ⑤ 남은 참조(외래키 유무 무관, 읽기만): 공고 번호·계정 id를 값으로 가진 모든 표
do $r$
declare t record; c bigint; left_total bigint := 0;
begin
  for t in select c.oid::regclass as reg, a.attname as col
    from pg_class c join pg_namespace s on s.oid = c.relnamespace join pg_attribute a on a.attrelid = c.oid
    where c.relkind = 'r' and s.nspname = 'public' and not a.attisdropped
      and a.attname in ('job_id', 'seeker_id', 'employer_id', 'user_id', 'owner_id', 'created_by', 'admin_user_id', 'reporter_id', 'handled_by', 'reviewed_by', 'suspended_by', 'dismissed_by') loop
    execute format('select count(*) from %s where %I::text in (select id::text from %s as ids)', t.reg, t.col, case when t.col = 'job_id' then 'vgb_jobs' else 'vgb_users' end) into c;
    if c > 0 then left_total := left_total + c; raise warning 'vgb_cleanup 남은 참조: %.% % 건', t.reg, t.col, c; end if;
  end loop;
  if left_total > 0 then raise exception 'vgb_cleanup: 명시 목록 밖에 남은 참조 % 건 — 전체 취소', left_total; end if;
end $r$;

-- 계정 삭제(부속 표는 Supabase 기본 설정의 ON DELETE CASCADE, 그 밖에 붙잡는 행이 있으면 DB가 거부 → 전체 취소)
select pg_temp.vgb_del('auth.users', 'select count(*) from auth.users where id in (select id from vgb_users)', 'delete from auth.users where id in (select id from vgb_users) returning 1');

-- ⑥ 결과 검증: 뿌리 잔존 0
do $z$ begin
  if exists (select 1 from public.local_jobs where id in (select id from vgb_jobs)) or exists (select 1 from auth.users where id in (select id from vgb_users)) then
    raise exception 'vgb_cleanup: 삭제 뒤에도 뿌리가 남음 — 전체 취소'; end if;
end $z$;

select tbl, n as deleted from vgb_log order by tbl;
select 'residual' as what, (select count(*) from public.local_jobs where id in (select id from vgb_jobs)) + (select count(*) from auth.users where id in (select id from vgb_users)) as roots_left;
commit;
`
}

// 정리 전 영향 확인(읽기만): 뿌리 공고·계정 수
export function countSql(marker) {
  if (!SAFE_MARKER.test(marker)) throw new Error('marker 형식 오류(16진 8~32자)')
  return `select (select count(*) from public.local_jobs where company = 'VGB-E2E ${marker}' or company like 'VGB-E2E ${marker} %') as jobs,
 (select count(*) from auth.users where email like 'vgb-e2e-${marker}-%@example.invalid' and raw_user_meta_data->>'e2e_marker' = '${marker}') as users;`
}
