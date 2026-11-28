// 시험 데이터 정리(대표 2026-11-28 지시 3, 독립 검토 반영): 고용주·구직자 운영 시험이 만든 데이터만 지우고 잔존 0건을 확인하는 한 곳.
// 새 표·함수·구조 없음 — 실행 안에서만 쓰는 임시 객체(pg_temp)와 SQL 한 묶음(한 트랜잭션, 하나라도 어긋나면 전체 취소 = fail-closed).
// 삭제 대상은 '글자 일치'가 아니라 **소유권(식별자)**으로만 정한다:
//  ① 뿌리: 계정 = 이메일 vgb-e2e-<marker>-*@example.invalid AND 가입 정보 e2e_marker = marker / 공고 = 회사 이름 'VGB-E2E <marker>'로 시작
//  ② 뿌리 개수가 기대 상한(maxJobs·maxUsers)을 넘으면 실행 중단(표식 충돌·잘못된 표식 방지)
//  ③ 영향 계획(읽기만): 뿌리에서 외래키로 이어진 모든 행을 표별로 세고, (a) 허용 표 목록 밖의 표에서 **행이 실제로 닿으면** 중단(구조만 이어진 빈 표는 무시) (b) 지원·대화·면접처럼 seeker_id·employer_id·user_id·owner_id가 있는 표는 그 값이 **모두 시험 계정**이 아니면 중단(실제 이용자 행이 시험 공고에 걸려 있는 경우 등)
//  ④ 계획이 통과한 뒤에만 하위부터 삭제하고 표별 삭제 건수를 돌려준다
//  ⑤ 외래키로 이어지지 않은 참조(공고 번호·계정 id를 값으로 가진 표)는 허용 목록(감사 기록)만 같은 소유권 조건으로 지우고, 그 밖의 표에 남은 참조가 있으면 중단 — 글자(LIKE) 일괄 삭제는 하지 않는다
// 허용 표 목록에 없는 표가 운영에서 닿으면 중단되므로, 새 표를 정리 대상에 넣으려면 이 목록을 승인된 PR로 늘린다(자동 확대 없음).
// 사용: cleanupSql(marker, {maxJobs, maxUsers}) 실행 → 마지막 SELECT들이 표별 삭제 건수. 운영 DB 접속은 이 저장소 규정상 ops-keys 워크플로 안에서만.

export const SAFE_MARKER = /^[0-9a-f]{8,32}$/
// 시험 흐름(게시→지원→대화→면접)이 만들 수 있는 표. auth 스키마(계정 부속 표)는 통째로 허용.
export const ALLOWED_TABLES = [
  'local_jobs', 'applications', 'message_threads', 'messages', 'interviews',
  'job_work_locations', 'job_location_candidates', 'job_ingest_raw', 'job_ingest_log', 'job_ai_suggestions', 'job_reprocess_queue',
  'map_r1_location_jobs', 'map_r1_unlocated', 'map_r1_search_history',
  'job_alert_notifications', 'job_alert_preferences', 'job_alert_home_locations', 'job_alert_region_keywords',
  'account_roles', 'account_statuses', 'user_profiles', 'user_cvs', 'admin_audit_logs',
]
// 외래키가 없어도 같은 소유권 조건으로 지우는 표(표·열). 그 밖의 표에 남은 참조는 정리하지 않고 중단한다.
const NON_FK_DELETE = [['admin_audit_logs', 'admin_user_id', 'user']]

const q = (s) => `'${String(s).replace(/'/g, "''")}'`

export function cleanupSql(marker, { maxJobs = 1, maxUsers = 2 } = {}) {
  if (!SAFE_MARKER.test(marker)) throw new Error('marker 형식 오류(16진 8~32자)')
  if (!Number.isInteger(maxJobs) || !Number.isInteger(maxUsers) || maxJobs < 0 || maxUsers < 0) throw new Error('maxJobs·maxUsers는 0 이상 정수')
  const allowed = ALLOWED_TABLES.map(q).join(',')
  return `
begin;
create temp table vgb_jobs on commit drop as select id from public.local_jobs where company like 'VGB-E2E ${marker}%';
create temp table vgb_users on commit drop as select id from auth.users where email like 'vgb-e2e-${marker}-%@example.invalid' and raw_user_meta_data->>'e2e_marker' = '${marker}';
create temp table vgb_log (phase text, tbl text, n bigint) on commit drop;

do $g$ begin
  if (select count(*) from vgb_jobs) > ${maxJobs} then raise exception 'vgb_cleanup: 시험 공고 % > 상한 ${maxJobs} — 표식 충돌 의심, 중단', (select count(*) from vgb_jobs); end if;
  if (select count(*) from vgb_users) > ${maxUsers} then raise exception 'vgb_cleanup: 시험 계정 % > 상한 ${maxUsers} — 표식 충돌 의심, 중단', (select count(*) from vgb_users); end if;
end $g$;

create or replace function pg_temp.vgb_walk(tbl regclass, cond text, depth int, mode text) returns void language plpgsql as $f$
declare fk record; c bigint; ccols text; pcols text; child_cond text; col text; sch text; nm text; bad bigint;
begin
  if depth > 8 then raise exception 'vgb_cleanup: 외래키 깊이 초과(%)', tbl; end if;
  -- 닿는 행이 하나도 없는 표(구조상 이어져 있어도 비어 있음)는 건너뛴다 — 부모 행이 없으면 자식 행도 없다
  execute format('select count(*) from %s where %s', tbl, cond) into c;
  if c = 0 then return; end if;
  select s.nspname, r.relname into sch, nm from pg_class r join pg_namespace s on s.oid = r.relnamespace where r.oid = tbl;
  if sch <> 'auth' and not (sch = 'public' and nm = any(array[${allowed}])) then
    raise exception 'vgb_cleanup: 허용 목록에 없는 표에 닿음 — %.% (정리하지 않고 중단)', sch, nm;
  end if;
  for fk in select conrelid, conkey, confkey from pg_constraint where contype = 'f' and confrelid = tbl and conrelid <> confrelid loop
    select string_agg(format('%I', a.attname), ',' order by k.ord) into ccols from unnest(fk.conkey) with ordinality k(attnum, ord) join pg_attribute a on a.attrelid = fk.conrelid and a.attnum = k.attnum;
    select string_agg(format('%I', a.attname), ',' order by k.ord) into pcols from unnest(fk.confkey) with ordinality k(attnum, ord) join pg_attribute a on a.attrelid = tbl and a.attnum = k.attnum;
    child_cond := format('(%s) in (select %s from %s where %s)', ccols, pcols, tbl, cond);
    perform pg_temp.vgb_walk(fk.conrelid, child_cond, depth + 1, mode);
  end loop;
  -- 소유권: 이 표 행의 이용자 칸은 모두 시험 계정이어야 한다
  for col in select a.attname from pg_attribute a where a.attrelid = tbl and a.attname in ('seeker_id', 'employer_id', 'user_id', 'owner_id') and not a.attisdropped loop
    execute format('select count(*) from %s where (%s) and %I is not null and %I not in (select id from vgb_users)', tbl, cond, col, col) into bad;
    if bad > 0 then raise exception 'vgb_cleanup: %.%에 시험 계정이 아닌 이용자 행 % 건 — 실제 데이터 보호를 위해 중단', tbl, col, bad; end if;
  end loop;
  if mode = 'plan' then
    insert into vgb_log values ('plan', tbl::text, c);
  else
    execute format('delete from %s where %s', tbl, cond);
    get diagnostics c = row_count;
    insert into vgb_log values ('deleted', tbl::text, c);
  end if;
end $f$;

-- ③ 영향 계획(읽기만) → 허용·소유권 검사가 여기서 실패하면 아무것도 지우지 않는다
select pg_temp.vgb_walk('public.local_jobs'::regclass, 'id in (select id from vgb_jobs)', 0, 'plan');
select pg_temp.vgb_walk('auth.users'::regclass, 'id in (select id from vgb_users)', 0, 'plan');
-- ④ 삭제
select pg_temp.vgb_walk('public.local_jobs'::regclass, 'id in (select id from vgb_jobs)', 0, 'delete');
select pg_temp.vgb_walk('auth.users'::regclass, 'id in (select id from vgb_users)', 0, 'delete');
-- ⑤ 외래키 없는 참조: 허용 목록은 같은 소유권 조건으로 삭제, 나머지는 남아 있으면 중단
${NON_FK_DELETE.map(([t, col]) => `delete from public.${t} where ${col} in (select id from vgb_users);`).join('\n')}
do $r$
declare t record; c bigint; left_total bigint := 0;
begin
  for t in select c.oid::regclass as reg, a.attname as col, format_type(a.atttypid, null) as typ
    from pg_class c join pg_namespace s on s.oid = c.relnamespace join pg_attribute a on a.attrelid = c.oid
    where c.relkind = 'r' and s.nspname = 'public' and not a.attisdropped
      and a.attname in ('job_id', 'seeker_id', 'employer_id', 'user_id', 'owner_id', 'created_by', 'admin_user_id') loop
    execute format('select count(*) from %s where %I::text in (select id::text from %s as ids)', t.reg, t.col, case when t.col = 'job_id' then 'vgb_jobs' else 'vgb_users' end) into c;
    if c > 0 then left_total := left_total + c; raise warning 'vgb_cleanup 남은 참조: %.% % 건', t.reg, t.col, c; end if;
  end loop;
  if left_total > 0 then raise exception 'vgb_cleanup: 외래키 없는 참조가 허용 목록 밖에 % 건 남음 — 전체 취소', left_total; end if;
end $r$;

select 'plan' as phase, tbl, n from vgb_log where phase = 'plan' order by tbl;
select 'deleted' as phase, tbl, n from vgb_log where phase = 'deleted' order by tbl;
select 'residual', (select count(*) from vgb_jobs j where exists (select 1 from public.local_jobs l where l.id = j.id)) + (select count(*) from vgb_users u where exists (select 1 from auth.users a where a.id = u.id)) as roots_left;
commit;
`
}

// 정리 전 영향 확인(읽기만): 뿌리 공고·계정 수
export function countSql(marker) {
  if (!SAFE_MARKER.test(marker)) throw new Error('marker 형식 오류(16진 8~32자)')
  return `select (select count(*) from public.local_jobs where company like 'VGB-E2E ${marker}%') as jobs,
 (select count(*) from auth.users where email like 'vgb-e2e-${marker}-%@example.invalid' and raw_user_meta_data->>'e2e_marker' = '${marker}') as users;`
}
