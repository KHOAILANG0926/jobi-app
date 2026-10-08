# DDL dry-run — 비공개 연구 저장소 + VietMap 호출 카운터 (2026-10-08)

상태: **미적용 — 사용자 승인 대기.** Production DB에는 아무것도 적용하지 않았다.
SQL 전문: `supabase/pending/20261008000000_private_research_store.sql` (순수 additive, 기존 객체 변경 없음)

## 무엇이 생기나

| 객체 | 용도 | 접근 |
|---|---|---|
| 테이블 `research_artifacts` (kind, name, payload jsonb, meta jsonb, created_by, created_at, unique(kind,name)) | 수집·검토 데이터, 백업, 검색 캐시를 PC 파일 대신 저장 | RLS 켬 + 정책 없음 + anon/authenticated 권한 회수 → 직접 접근 불가 |
| 테이블 `vietmap_usage_daily` (day, calls) | VietMap Search/Place 하루 호출 수(베트남 날짜) | 위와 동일 |
| 함수 `admin_save_research_artifact` / `admin_get_research_artifact` / `admin_list_research_artifacts` | 관리자 로그인 세션만 저장·조회(`require_admin()`) | authenticated 실행 권한이지만 함수 안에서 admin 아니면 거부 |
| 함수 `vietmap_usage_take(day, limit)` | 서버가 호출 1회를 원자적으로 예약(상한이면 거부) | service_role만 실행 |

## 검증한 것(dry-run)

- 인메모리 Postgres(PGlite, auth 스키마·`require_admin` 스텁)에 SQL 전체를 적용: 오류 없음.
- `vietmap_usage_take('2026-10-08', 3)` 4회 호출 → ok,1 / ok,2 / ok,3 / **거부(ok=false, used=3)**, 테이블 값 3 유지.
- 관리자 JWT로 save → 같은 kind/name 재저장 시 덮어쓰기, get·list 정상. admin 아닌 JWT는 `admin access required`로 거부.
- 이 확인은 Production이 아니라 로컬 임시 DB에서 한 것이다.

## 적용하지 않은 동안의 동작

- `/api/admin-vietmap`은 카운터가 없으면 VietMap을 **호출하지 않고** 503(`usage_counter_unavailable`)을 돌려준다(fail closed).
- `scripts/research/lib/privateStore.mjs` 저장·읽기는 RPC 없음 오류로 멈춘다(로컬 파일로 되돌아가지 않는다).

## 승인 후 순서

1. SQL 적용(Supabase SQL Editor 또는 기존 절차) → 파일을 `supabase/migrations/<적용 시각>_private_research_store.sql`로 옮겨 master에 반영.
2. Vercel 환경변수 `VIETMAP_SERVICE_KEY`(사용자가 직접), `SUPABASE_SERVICE_ROLE_KEY`(이미 있음) 확인.
3. `node scripts/research/migrate_out_to_private_store.mjs` → 일치 확인 후 `--delete-local`.
