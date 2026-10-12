# 신규 공고 정책 — PR #46 구현

기준: master `9157ced`, PR #46 `docs/policy-audit-2026-10.md`. 조사 재수행 없이 해당 보고서의 경로를 구현했다. PR #47은 포함하지 않는다.

## 판정과 범위

`policy/job-posting-v1.json`은 JS/TypeScript·Python의 공통 규칙이다. 결과는 `allow/exclude/review`, 사유 코드, 버전뿐이며 원문·연락처를 반환하지 않는다. 급여 액수·회사명만으로 제외하지 않는다. 금융/추심 전담 제목·대출 판매 업무, 명시적인 B2B/대리점 전담 업무를 제외한다. 일반 매장·마트·생산·QC는 허용하고 전문 영업의 고소득·인센티브 또는 불분명한 업무는 검토 대상으로 차단한다. 정규식은 의미 이해를 완전히 대체하지 못한다.

크롤러 upsert, Facebook 최종 저장, Chợ Tốt REST 저장, 수동 등록 스크립트에서 비허용 공고를 쓰기 전에 거부한다. 기업/게스트 생성·수정, 게스트 재공개, 관리자 생성·숨김 해제도 검사한다. 수정은 저장된 최신 내용에 실제 변경 필드를 합쳐 평가한다. 조회/판정 실패 시 공개 요청을 보내지 않는다. 비공개 검토 저장 기능은 구현하지 않았다.

공개 목록과 공개 기업 공고 수는 `active=true AND admin_hidden=false`를 명시한다. 소유자 관리 목록은 비공개 공고를 관리해야 하므로 별도다. 기존 행을 숨기거나 삭제하는 DB 작업은 없다.

## 남은 DB 경계

앱 검사는 신뢰 경계가 아니다. 직접 REST/SQL, service-role, RPC 직접 호출, 검사 후 동시 수정은 우회 가능하다. Production의 현재 함수·RLS·권한·트리거는 이 작업에서 조회하지 않았다. 완료된 DB 강제 정책이라고 보고하면 안 된다.

`supabase/pending/20261012090000_job_publication_policy.sql`은 evaluator와 INSERT/UPDATE trigger 초안이다. 자동 migration 밖에 있으며 BEGIN/ROLLBACK으로 끝난다. 사용자 DDL 승인 전 적용 금지. JSON 규칙 스냅샷을 포함하므로 정책 변경 시 재생성·공유 fixture 동등성 검증이 필요하다. SQL 실행/DB 권한 검증 결과는 별도로 명시한다.

승인 전 설계 검토: UTF8/PostgreSQL 정규화·정규식 호환, trusted non-login 함수 소유자, 고정 search_path, runtime 역할의 함수 교체·trigger 해제·session_replication_role 변경 금지, service-role의 실제 권한, 기존 RPC 동작을 격리 DB에서 확인한다. SECURITY DEFINER trigger가 소유자 권한으로 순수 evaluator를 호출하고 PUBLIC 실행 권한은 회수한다. table owner/superuser가 trigger를 해제하는 것은 방지 범위 밖이다. 판정 RPC 공개가 필요하면 별도 승인 후 필요한 역할에만 reason/version 반환 권한을 부여한다.

롤백 초안(별도 승인 후 단일 transaction): `DROP TRIGGER IF EXISTS job_publication_policy_v1 ON public.local_jobs; DROP FUNCTION IF EXISTS public.guard_job_publication_v1(); DROP FUNCTION IF EXISTS public.evaluate_job_policy_v1(jsonb); DROP FUNCTION IF EXISTS public.job_policy_normalize_v1(text);` 기존 정책·RLS·데이터·위치 승인은 변경하지 않는다. 롤백은 직접 쓰기 우회 위험을 다시 연다.

## 비공개 검토 저장 — 설계만

현재 모호한 기업/관리자 입력은 사유를 보여주고 저장/공개를 중단한다. 향후 승인 시 별도 review 테이블에 소유자·관리자만 접근하는 RLS, 최소 원문 보관 기간, 정책 버전/사유, 명시적 재검사 후 공개 전환을 설계한다. local_jobs에 임의 비공개 저장하거나 새 테이블·RPC·RLS를 만드는 것은 이번 범위에 없다.

## 검증 한계

공유 합성 fixture, 실제 writer 함수의 AST 격리 실행, 가짜 Supabase 응답으로 관리자 재공개·공개 조회를 검증한다. 실제 크롤링·Production 쓰기·유료 API·배포는 실행하지 않는다. UI 전체 E2E와 Production RPC 원자성은 이 테스트가 증명하지 않는다.

## 이 작업의 직접 검증

- 공유 fixture 24개: JS/Python 허용·제외·검토 일치. Python 기존 품질 테스트 21/21, 신규 unittest 5/5 통과.
- `@electric-sql/pglite@0.5.8` 메모리 DB에서 SQL fixture 24개, INSERT/수정/재공개/함수 실패의 원자적 차단 통과. 실행: `npm ci --ignore-scripts` 후 `node scripts/test-job-policy-sql.mjs`. 재현 가능한 격리 CI를 위해 PGlite 0.5.8을 devDependency에 고정했다. 운영 PostgreSQL·역할 권한 검증을 대체하지 않는다.
- 최초 debt fixture는 review/exclude 불일치로 실패한 뒤 수정 후 통과. 기존 Python 테스트는 Windows 출력 인코딩 오류 후 `-X utf8`로 실행했고, 오류 문구 호환을 수정하여 21/21 통과했다. 매장 보너스 오차단 fixture도 실패를 확인 후 수정했다.
- Facebook 전체 기존 suite는 credential 초기화 및 파일 백업 테스트를 포함하므로 실행하지 않았다. 최종 저장 함수는 AST로 추출해 외부 의존성 없는 격리 테스트로 실행했다. 실제 브라우저 UI E2E·Production RPC·기존 데이터는 미확인.
- Vercel 자동 배포 방지: `vercel.json`의 `git.deploymentEnabled`에서 이번 `codex/job-posting-policy-implementation-20261012` 브랜치만 false. [공식 문서](https://vercel.com/docs/project-configuration/git-configuration). 다른 브랜치 설정은 변경하지 않았다.

- 독립 코드 리뷰의 generic 역할·본문 전담 추심·매장 고객 언급 3건을 실패 fixture로 재현 후 수정했고 재검토로 확인했다. 패키지 설치의 일시적 ENOTFOUND는 네트워크 권한 승인 후 해결했다.
