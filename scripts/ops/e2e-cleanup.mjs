// 시험 데이터 정리(대표 2026-11-28 지시 3·#1192 안전성 수정): 고용주·구직자 운영 시험이 만든 데이터만 지우고 잔존 0건을 확인하는 한 곳.
// 새 표·함수·구조 없음 — 실행 안에서만 쓰는 임시 객체(pg_temp)와 SQL 한 묶음. **하나의 트랜잭션**에서 식별 → 소유권 확인 → 삭제 → 결과 검증을 하고,
// 어느 단계든 어긋나면 RAISE로 전체 ROLLBACK(fail-closed)한다.
// 삭제 방식(글자 일괄 삭제·외래키 따라 재귀 삭제 없음):
//  ① 뿌리: 계정 = 이메일 vgb-e2e-<marker>-*@example.invalid AND 앱 메타데이터(raw_app_meta_data — 서비스 롤 관리자 API만 쓸 수 있고 가입자가 못 씀) e2e_marker = marker / 공고 = 회사 이름 'VGB-E2E <marker>'로 시작.
//     뿌리 개수가 상한(maxJobs·maxUsers)을 넘으면 중단(표식 충돌).
//  ② 정확한 id 목록: 지원서·대화·면접은 id(uuid) 목록으로, 메시지는 그 대화 id로, 공고·계정 하위 표는 아래 **명시 표·열 목록**(TABLES)에서 뿌리 id로만 고른다.
//  ③ 소유권: 지원서·대화·면접 행은 **구직자와 고용주가 모두 시험 계정**이어야 한다(실제 이용자가 한쪽이라도 섞이면 중단). 공고는 시험 공고일 수도, **시험 계정(고용주 포함)이 상호작용한 실제 공고**일 수도 있다 — 실제 공고는 지우거나 바꾸지 않고, 그 공고에 걸린 시험 계정 소유 지원·대화·면접·메시지만 지운다. 고용주 계정이 없는 크롤링 공고에는 지원 행(employer_id NOT NULL)이 만들어지지 않으므로 해당 경로는 격리 시험 공고로 검증한다. 시험 공고의 고용주 칸은 시험 계정 또는 비어 있어야 한다.
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

// 삭제 전 점검(③-2)에서 '이 SQL이 직접 처리하는 열'. 여기 없는 외래키 열에 시험 뿌리 참조 행이 있으면 중단한다.
const HANDLED_PAIRS = [
  'public.applications.job_id', 'public.applications.seeker_id', 'public.applications.employer_id',
  'public.message_threads.job_id', 'public.message_threads.seeker_id', 'public.message_threads.employer_id',
  'public.interviews.job_id', 'public.interviews.seeker_id', 'public.interviews.employer_id',
  'public.messages.thread_id', 'public.job_ingest_log.raw_id', 'public.job_ingest_raw.job_id', 'public.local_jobs.employer_id',
  ...TABLES.byJob.map(([t, c]) => `${t}.${c}`), ...TABLES.byUser.map(([t, c]) => `${t}.${c}`),
]

export function cleanupSql(marker, { maxJobs = 1, maxUsers = 2, deleteUsers = true } = {}) {
  if (!SAFE_MARKER.test(marker)) throw new Error('marker 형식 오류(16진 8~32자)')
  if (!Number.isInteger(maxJobs) || !Number.isInteger(maxUsers) || maxJobs < 0 || maxUsers < 0) throw new Error('maxJobs·maxUsers는 0 이상 정수')
  const del = ([t, col], src) => `select pg_temp.vgb_del('${t}.${col}', $c$select count(*) from ${t} where ${col} in (select id from ${src})$c$, $d$delete from ${t} where ${col} in (select id from ${src}) returning 1$d$);`
  return `
begin;
create temp table vgb_jobs on commit drop as select id from public.local_jobs where company = 'VGB-E2E ${marker}' or company like 'VGB-E2E ${marker} %';
create temp table vgb_users on commit drop as select id from auth.users where email like 'vgb-e2e-${marker}-%@example.invalid' and raw_app_meta_data->>'e2e_marker' = '${marker}';
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

-- ③ 소유권: 구직자·고용주가 모두 시험 계정이어야 한다(공고는 시험 공고 또는 시험 계정이 상호작용한 실제 공고)
do $o$
declare bad bigint; nm text;
begin
  for nm in select unnest(array['vgb_apps', 'vgb_threads', 'vgb_ivs']) loop
    execute format('select count(*) from %I where coalesce(seeker_id in (select id from vgb_users) and employer_id in (select id from vgb_users), false) is not true', nm) into bad;
    if bad > 0 then raise exception 'vgb_cleanup: % 에 시험 계정이 아닌 이용자가 섞인 행 % 건 — 실제 데이터 보호를 위해 중단', nm, bad; end if;
  end loop;
  select count(*) into bad from public.job_alert_notifications where job_id in (select id from vgb_jobs) and seeker_id not in (select id from vgb_users);
  if bad > 0 then raise exception 'vgb_cleanup: 시험 공고에 걸린 알림 중 구독자가 시험 계정이 아님 % 건 — 중단', bad; end if;
  select count(*) into bad from public.local_jobs where id in (select id from vgb_jobs) and employer_id is not null and employer_id not in (select id from vgb_users);
  if bad > 0 then raise exception 'vgb_cleanup: 시험 공고의 고용주 칸이 시험 계정이 아님 % 건 — 중단', bad; end if;
end $o$;

-- ③-2 삭제 전 읽기 점검(열 단위): 공고·계정·지원서·대화·면접·원문을 외래키로 참조하는 모든 열(모든 스키마, auth 내부 표 제외) 중
-- 아래 '명시 처리 열'이 아닌 열에 시험 뿌리를 가리키는 행이 있으면 중단 — 삭제의 ON DELETE CASCADE/SET NULL로 실제 행이 조용히 지워지거나 바뀌는 일을 막는다.
-- 복합(여러 열) 외래키가 이 부모들을 참조하면 열 비교가 불가능하므로 무조건 중단한다.
do $p$
declare fk record; c bigint; src text; handled text[] := array[${HANDLED_PAIRS.map((v) => `'${v}'`).join(', ')}];
begin
  for fk in select (select n.nspname || '.' || r.relname from pg_class r join pg_namespace n on n.oid = r.relnamespace where r.oid = k.conrelid) as tbl,
      (select string_agg(a.attname, ',' order by x.ord) from unnest(k.conkey) with ordinality x(attnum, ord) join pg_attribute a on a.attrelid = k.conrelid and a.attnum = x.attnum) as cols,
      array_length(k.conkey, 1) as ncols,
      case k.confrelid when 'public.local_jobs'::regclass then 'vgb_jobs' when 'auth.users'::regclass then 'vgb_users' when 'public.applications'::regclass then 'vgb_apps'
        when 'public.message_threads'::regclass then 'vgb_threads' when 'public.interviews'::regclass then 'vgb_ivs' when 'public.job_ingest_raw'::regclass then 'vgb_raw' end as src
    from pg_constraint k
    where k.contype = 'f' and k.confrelid in ('public.local_jobs'::regclass, 'auth.users'::regclass, 'public.applications'::regclass, 'public.message_threads'::regclass, 'public.interviews'::regclass, 'public.job_ingest_raw'::regclass)
  loop
    continue when fk.tbl like 'auth.%';
    if fk.ncols > 1 then raise exception 'vgb_cleanup: 복합 외래키 %(%)가 삭제 대상 표를 참조 — 열 비교 불가, 중단', fk.tbl, fk.cols; end if;
    continue when (fk.tbl || '.' || fk.cols) = any (handled);
    execute format('select count(*) from %s where %I in (select id from %s)', fk.tbl, fk.cols, fk.src) into c;
    if c > 0 then raise exception 'vgb_cleanup: 명시 처리 열이 아닌 %.% 가 시험 뿌리를 참조(% 건) — 실제 데이터가 연쇄 삭제·변경될 수 있어 중단', fk.tbl, fk.cols, c; end if;
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
-- 감사 기록(admin_audit_logs)은 보존 정책상 지우지 않는다: 시험 계정은 관리자가 아니라 기록을 만들지 못하며, 있으면 아래 ③-2·⑤가 중단시킨다

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

${deleteUsers ? `-- 계정 삭제(부속 표는 Supabase 기본 설정의 ON DELETE CASCADE, 그 밖에 붙잡는 행이 있으면 DB가 거부 → 전체 취소)
select pg_temp.vgb_del('auth.users', 'select count(*) from auth.users where id in (select id from vgb_users)', 'delete from auth.users where id in (select id from vgb_users) returning 1');` : `-- deleteUsers=false: 계정은 GoTrue 관리자 API(auth.admin.deleteUser)로 지운다 — 인증 내부 표(identities·sessions·refresh_tokens 등)를 GoTrue가 직접 정리하는 지원 경로. 이 SQL은 공개 데이터까지만.`}

-- ⑥ 결과 검증: 뿌리 잔존 0
do $z$ begin
  if exists (select 1 from public.local_jobs where id in (select id from vgb_jobs)) ${deleteUsers ? 'or exists (select 1 from auth.users where id in (select id from vgb_users))' : ''} then
    raise exception 'vgb_cleanup: 삭제 뒤에도 뿌리가 남음 — 전체 취소'; end if;
end $z$;

select tbl, n as deleted from vgb_log order by tbl;
select 'residual' as what, (select count(*) from public.local_jobs where id in (select id from vgb_jobs)) + ${deleteUsers ? '(select count(*) from auth.users where id in (select id from vgb_users))' : '0'} as roots_left;
commit;
`
}

// 정리 전 영향 확인(읽기만): 뿌리 공고·계정 수
export function countSql(marker) {
  if (!SAFE_MARKER.test(marker)) throw new Error('marker 형식 오류(16진 8~32자)')
  return `select (select count(*) from public.local_jobs where company = 'VGB-E2E ${marker}' or company like 'VGB-E2E ${marker} %') as jobs,
 (select count(*) from auth.users where email like 'vgb-e2e-${marker}-%@example.invalid' and raw_app_meta_data->>'e2e_marker' = '${marker}') as users;`
}

// 저장소(Storage) 파일: 지원 시점 CV 사진 스냅샷(applications.cv_photo_snapshot_path = `applications/<공고>/<구직자>/photo.*`),
// 계정의 CV 사진(user_cvs.photo_path), 시험 공고가 올린 사진(local_jobs.images, 버킷 job-images)은 DB 행이 아니라 **파일**이다.
// Supabase는 storage 표 직접 삭제를 막으므로(파일이 남음) SQL로 지우지 않고 Storage API(서비스 롤)로 **정확한 경로**만 지운다.
// 순서: ① storagePlanSql로 경로 목록을 먼저 읽는다(정리 SQL이 지원서 행을 지우기 **전**) ② cleanupSql ③ removeStorageObjects ④ 잔존 확인.
export function storagePlanSql(marker) {
  if (!SAFE_MARKER.test(marker)) throw new Error('marker 형식 오류(16진 8~32자)')
  // 각 경로는 ① 시험 소유 접두를 지키고(applications/<시험 공고 또는 어느 공고>/<시험 계정>/…, <시험 계정>/…, job-images는 marker 포함)
  // ② 시험 밖 행이 같은 경로를 참조하지 않을 때만 ok = true. ok = false 가 하나라도 있으면 실행기는 아무것도 지우지 않고 중단해야 한다(removeStorageObjects가 강제).
  return `with u as (select id from auth.users where email like 'vgb-e2e-${marker}-%@example.invalid' and raw_app_meta_data->>'e2e_marker' = '${marker}'),
 j as (select id, images from public.local_jobs where company = 'VGB-E2E ${marker}' or company like 'VGB-E2E ${marker} %'),
 p as (
   select 'cv-photos' as bucket, a.cv_photo_snapshot_path as name,
     a.cv_photo_snapshot_path like 'applications/%/' || a.seeker_id::text || '/%' as prefix_ok
     from public.applications a where a.seeker_id in (select id from u) and a.cv_photo_snapshot_path is not null
   union all select 'cv-photos', c.photo_path, c.photo_path like c.user_id::text || '/%' from public.user_cvs c where c.user_id in (select id from u) and c.photo_path is not null
   union all select 'job-images', x.name, x.name like '%${marker}%' from j, jsonb_array_elements_text(case when jsonb_typeof(j.images) = 'array' then j.images else '[]'::jsonb end) as x(name)
 )
 select p.bucket, p.name,
   (p.prefix_ok
    and not exists (select 1 from public.applications a2 where a2.cv_photo_snapshot_path = p.name and a2.seeker_id not in (select id from u))
    and not exists (select 1 from public.user_cvs c2 where c2.photo_path = p.name and c2.user_id not in (select id from u))
    and not exists (select 1 from public.local_jobs l2 where l2.id not in (select id from j) and jsonb_typeof(l2.images) = 'array' and l2.images ? p.name)) as ok
 from p order by 1, 2;`
}

// 경로 목록(rows: [{bucket, name, ok}])을 Storage API로 지우고 **목록 조회**로 잔존 0을 확인한다. admin = service-role supabase 클라이언트.
// ok=false 행이 하나라도 있으면 아무것도 지우지 않고 중단한다(storagePlanSql의 소유 검증). 순서: 저장소 파일 삭제(되풀이해도 안전) → cleanupSql → 계정 삭제.
// 파일을 먼저 지우므로 SQL이 중단돼도 파일이 DB 행 없이 고아로 남는 일이 없고, 재실행하면 계획이 다시 만들어진다(이미 지운 파일은 건너뜀).
export async function removeStorageObjects(admin, rows) {
  const bad = rows.filter((r) => r.ok !== true)
  if (bad.length) throw new Error(`저장소 경로 소유 검증 실패 ${bad.length}건(${bad.map((r) => `${r.bucket}/${r.name}`).join(', ')}) — 아무것도 지우지 않고 중단`)
  const byBucket = new Map()
  for (const { bucket, name } of rows) { if (!byBucket.has(bucket)) byBucket.set(bucket, []); byBucket.get(bucket).push(name) }
  for (const [bucket, names] of byBucket) {
    const { error } = await admin.storage.from(bucket).remove(names)
    if (error) throw new Error(`storage 삭제 실패 ${bucket}: ${error.message}`)
    for (const name of names) {
      const i = name.lastIndexOf('/'), dir = i < 0 ? '' : name.slice(0, i), file = name.slice(i + 1)
      const { data, error: le } = await admin.storage.from(bucket).list(dir, { search: file })
      if (le) throw new Error(`storage 잔존 확인 실패 ${bucket}/${name}: ${le.message}`)
      if ((data ?? []).some((o) => o.name === file)) throw new Error(`storage 잔존: ${bucket}/${name}`)
    }
  }
  return rows.length
}

// 계정 삭제(운영 실행기 경로, cleanupSql(..., {deleteUsers:false}) 뒤): GoTrue 관리자 API로 지운다. 이미 없는 계정은 건너뛰고(재실행 안전),
// 한 명이 실패해도 나머지를 시도한 뒤 실패를 모아 던지고, 끝에 조회로 잔존 0을 확인한다.
export async function removeTestUsers(admin, ids) {
  const errors = []
  for (const id of ids) {
    const { error } = await admin.auth.admin.deleteUser(id)
    if (error && !/not.?found/i.test(error.message)) errors.push(`${id}: ${error.message}`)
  }
  for (const id of ids) {
    const { data } = await admin.auth.admin.getUserById(id)
    if (data?.user) errors.push(`${id}: 삭제 뒤에도 남음`)
  }
  if (errors.length) throw new Error(`계정 삭제 실패/잔존 ${errors.length}건 — ${errors.join('; ')}`)
  return ids.length
}
