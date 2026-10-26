# 위치 단일 원본 실행 기록 — 2026-10-27

Lee가 설계 및 2~5단계 실행을 확인했다. 이 기록은 운영 반영 완료 보고가 아니다.

## 직접 확인: 적용 전 예상 차이

`production/00-preview.sql`을 운영에서 읽기 전용으로 실행했다. 특정 공고 번호 조건 없이 전체 대상 7개 공고·10개 근무지를 산출했고 충돌/근거 누락은 0건이었다.

| 공고 | 원본/캐시 예상 차이 |
|---|---|
| 4824 | 원본 NULL → 기존 인간 확정 21.1959873,106.0087454, building/exact. 옛 근사 캐시 교체 |
| 4828 | 기존 캐시 21.156843910000077,106.12752774200004를 원본 근사로 이관 |
| 4878 | 기존 원본 21.1737775,106.0650338 유지, 미확정 area로 명시하고 캐시 정렬 |
| 4879 | 원본 행 생성, 기존 근거 있는 근사 21.14788,106.181135 이관 |
| 4825의 4곳·4826 | 좌표 NULL/미확인 유지 |
| 4827 | 좌표 없는 원본 근무지 행 생성 |

기존 원본/캐시는 비공개 이력에 보존한다. 공개 여부·검색 한도·기존 lease를 바꾸지 않는다. 실제 적용 시 같은 트랜잭션의 검사가 실패하면 전체를 원복한다.

## 직접 확인: 검증

- 최종 관련 PostgreSQL/PostGIS 스키마, RLS, NOSUPERUSER/CREATEROLE 운영자와 앱 역할로 이관·직접 쓰기 차단·RPC·재사용·취소/주소 변경·전체 점 집합·민감 근거 보호 통과.
- 근거 누락, 동시 확정 근거 충돌, DDL 이후 근거 누락의 3가지 전체 rollback 통과. 동시 실행 5가지 통과. 이관 중 공급자 호출 0건 확인.
- `npm test`: 81/81. `npx tsc --noEmit`, `npm run build` 통과.
- 로컬 실제 브라우저 합성 시험: 0개, 1개, 여러 공고/근무지 및 묶음 핀·상세 점 집합 통과. 실제 운영 시험과 구분한다.
- 코드/SQL 최종 검토 승인. SQL SHA-256: `c1c06a08032c667d8a5751bb242db1e46bc811bd970380c6953c3543b548a67b`.

## 직접 확인: 운영 적용 요청 취소

위 목록을 먼저 보고한 뒤 Supabase `apply_migration`을 요청했다. 이름은 `location_single_source_approved_20261027`, SQL은 위 해시의 운영 실행본이다. 도구가 `Migration was cancelled.` 및 `status: cancelled`를 반환했고 이유는 제공하지 않았다.

뒤이은 읽기 전용 조회에서 `location_private` 스키마 없음, 해당 이관 기록 없음, 4824 원본 lat/lng NULL을 확인했다. 다른 쓰기 경로로 우회하지 않았다. 병합·운영 배포·실제 운영 E2E·20시 알림 실행은 아직 확인하지 않았다.

## 추정

취소 응답이 나온 이유는 확인되지 않았다. 권한 부족이나 사용자의 취소라고 단정하지 않는다. 구조를 실제 적용하면 예상 좌표로 맞춰질지는 운영 적용 후 독립 조회와 브라우저 시험으로 확인해야 한다.

## Lee 지시로 정상 경로 전환

운영 Supabase 직접 도구 접근은 읽기 포함 금지한다. 이전 시도는 절차 실수였으며 재시도하지 않는다. 새 CLI 파일 `supabase/migrations/20261026231445_location_single_source.sql`은 기존 검토 본문에서 트랜잭션 wrapper를 제거해 `migrations-apply.yml`의 `psql -1`과 맞췄다. 직접 삭제를 막기 위해 TRUNCATE 권한도 회수했다. 최종 원문 SHA256은 `2e8928cbcf97919ec1ac37a1df0300379e6267fce8cf98597de6de9dda108aaa`다.

실제 새 파일로 로컬 이관/원복/권한/동시 실행을 다시 확인했다. `supabase/tests/location_single_source_production_check.sql`의 기억/원본/캐시/유효성/전체 불일치 5가지 모두 0건이었다. 운영 자동 적용 성공을 뜻하지 않는다.

기존 봇의 문구 차단을 없애지 않고, 이미 검토한 정확한 파일 경로와 원문 해시 1개만 trusted master에서 확인하는 준비 PR #276을 만든다. 준비 PR에는 앱이나 운영 SQL이 없다. 그 뒤 앱과 새 SQL·사후 점검을 같은 PR로 제출한다. 운영 `migrations-apply` 실패 시 원문 오류 그대로 보고하고 멈춘다. 정상 배포 뒤 실제 전수 원본/캐시/메인/상세 검증 전에는 완료라고 보고하지 않는다.

DB 전환 PR의 사전 화면 CI는 BASE의 기존 공개 데이터 화면과 HEAD의 격리 PC/모바일 canonical 화면을 구분한다. 운영 HEAD를 검증했다는 뜻이 아니다. 실제 운영 전수 검사는 변경하지 않은 deploy-verify에서 진행한다.


## 정상 경로 실행 결과: GitHub 시작 요청 실패로 중단

[직접 확인] 준비 PR #276과 앱+이관 PR #277은 필수 검사 성공 후 봇으로 병합됐다. #277 운영 소스는 `70fe1c60dd8092b595938c0160bd714fded2b227`. 준비 PR의 Vercel 업로드는 생략됐다.

이관 시작 요청은 봇 실행 [40420801113](https://github.com/KHOAILANG0926/jobi-app/actions/runs/40420801113)의 job121914436624에서 다음 원문 오류로 실패했다.

```text
could not create workflow dispatch event: HTTP 500: Failed to run workflow dispatch (https://api.github.com/repos/KHOAILANG0926/jobi-app/actions/workflows/388182152/dispatches)
```

[직접 확인] 해당 운영 SHA의 Actions 실행 목록 조회는 빈 배열이었다. `migrations-apply` 실행 자체가 생성되지 않았다. 운영 배포와 deploy-verify는 미실행이며 4824 원본/캐시의 정상 경로 사후 읽기 증거는 아직 없다. 직접 DB 접근·자동 재시도·다른 적용 경로 없이 중단했다.

[추정] HTTP500의 내부 원인은 확인되지 않았다. 운영 SQL 실패나 실제 운영 이관 성공으로 단정하지 않는다.
