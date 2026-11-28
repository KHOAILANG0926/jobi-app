// 시험 데이터 정리(대표 2026-11-28 지시 3): 고용주·구직자 운영 시험이 만든 데이터만 지우고 잔존 0건을 확인하는 한 곳.
// 새 표·함수·구조 없음 — 실행 안에서만 쓰는 임시 함수(pg_temp)와 읽기/삭제 SQL 한 묶음을 돌려준다(DB 구조 변경 아님).
// 지우는 대상 = 이번 실행의 표식(marker)에서 출발한 것뿐이다. 실제 공고·실제 이용자 데이터는 조건에 걸리지 않는다:
//  ① 계정: 이메일 vgb-e2e-<marker>-*@example.invalid 이면서 가입 정보 e2e_marker = marker
//  ② 공고: 회사 이름이 'VGB-E2E <marker>'로 시작
//  ③ ①②에서 외래키로 이어진 행(지원서·대화·메시지·면접·위치 원본·알림 등)은 외래키를 따라 자동으로 찾아 하위부터 지운다 — 손으로 쓴 표 목록이 아니다
//  ④ 외래키가 없는 표(위치 기억·보류함·감사 기록 등)는 marker 글자가 들어 있는 행만 지운다(marker는 실행마다 새로 만든 무작위 값). 계정 표(auth)는 이 단계에서 건드리지 않는다 — 계정은 ②의 이메일+가입 정보 조건으로만 지운다(이메일에 marker 글자가 있어도 가입 정보 표식이 없으면 보존)
// 어느 단계든 하나라도 실패하면 전체 취소(한 트랜잭션). 끝에 같은 marker 잔존 행 수를 모든 표에서 세어 0이어야 통과.
// 사용: psql 또는 pg 클라이언트로 cleanupSql(marker) 실행 → 마지막 SELECT가 residual 행 수. 운영 DB 직접 접속은 이 저장소 규정상 ops-keys 워크플로 안에서만.

export const SAFE_MARKER = /^[0-9a-f]{8,32}$/

export function cleanupSql(marker) {
  if (!SAFE_MARKER.test(marker)) throw new Error('marker 형식 오류(16진 8~32자)')
  return `
begin;
create or replace function pg_temp.vgb_del_tree(tbl regclass, cond text, depth int) returns bigint language plpgsql as $f$
declare fk record; n bigint := 0; c bigint; child_cond text; pcols text; ccols text;
begin
  if depth > 8 then raise exception 'vgb_cleanup: 외래키 깊이 초과(%)', tbl; end if;
  for fk in select conrelid, conkey, confkey, conname from pg_constraint where contype = 'f' and confrelid = tbl and conrelid <> confrelid loop
    select string_agg(format('%I', a.attname), ',' order by k.ord) into ccols from unnest(fk.conkey) with ordinality k(attnum, ord) join pg_attribute a on a.attrelid = fk.conrelid and a.attnum = k.attnum;
    select string_agg(format('%I', a.attname), ',' order by k.ord) into pcols from unnest(fk.confkey) with ordinality k(attnum, ord) join pg_attribute a on a.attrelid = tbl and a.attnum = k.attnum;
    child_cond := format('(%s) in (select %s from %s where %s)', ccols, pcols, tbl, cond);
    n := n + pg_temp.vgb_del_tree(fk.conrelid, child_cond, depth + 1);
  end loop;
  execute format('delete from %s where %s', tbl, cond);
  get diagnostics c = row_count;
  return n + c;
end $f$;

create or replace function pg_temp.vgb_sweep(marker text) returns bigint language plpgsql as $f$
declare t record; n bigint := 0; c bigint;
begin
  for t in select c.oid::regclass as reg from pg_class c join pg_namespace s on s.oid = c.relnamespace
    where c.relkind = 'r' and s.nspname in ('public', 'location_private', 'ingest_private') and c.relname <> 'schema_migrations' loop
    begin
      execute format('delete from %s x where x::text like %L', t.reg, '%' || marker || '%');
      get diagnostics c = row_count; n := n + c;
    exception when others then
      raise exception 'vgb_cleanup: % 정리 실패 — %', t.reg, sqlerrm;
    end;
  end loop;
  return n;
end $f$;

create or replace function pg_temp.vgb_residual(marker text) returns bigint language plpgsql as $f$
declare t record; n bigint := 0; c bigint;
begin
  for t in select c.oid::regclass as reg from pg_class c join pg_namespace s on s.oid = c.relnamespace
    where c.relkind = 'r' and s.nspname in ('public', 'location_private', 'ingest_private', 'auth') loop
    execute format('select count(*) from %s x where x::text like %L', t.reg, '%' || marker || '%') into c;
    n := n + c;
  end loop;
  return n;
end $f$;

-- ① 공고(표식 회사 이름)에서 출발해 외래키 하위부터
select 'jobs_deleted', pg_temp.vgb_del_tree('public.local_jobs'::regclass, $c$company like 'VGB-E2E ${marker}%'$c$, 0);
-- ② 계정(표식 이메일 + 가입 정보)에서 출발
select 'users_deleted', pg_temp.vgb_del_tree('auth.users'::regclass, $c$email like 'vgb-e2e-${marker}-%@example.invalid' and raw_user_meta_data->>'e2e_marker' = '${marker}'$c$, 0);
-- ④ 외래키 없는 표에 남은 marker 행
select 'sweep_deleted', pg_temp.vgb_sweep('${marker}');
select 'residual', pg_temp.vgb_residual('${marker}');
commit;
`
}

// 정리 전 영향 확인(읽기만): 지울 공고·계정 수. 표식에 걸리는 것이 기대(공고 n·계정 2)와 다르면 정리를 멈추는 데 쓴다.
export function countSql(marker) {
  if (!SAFE_MARKER.test(marker)) throw new Error('marker 형식 오류(16진 8~32자)')
  return `select (select count(*) from public.local_jobs where company like 'VGB-E2E ${marker}%') as jobs,
 (select count(*) from auth.users where email like 'vgb-e2e-${marker}-%@example.invalid' and raw_user_meta_data->>'e2e_marker' = '${marker}') as users;`
}
