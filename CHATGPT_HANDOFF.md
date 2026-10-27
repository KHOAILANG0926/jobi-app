# CHATGPT_HANDOFF — 위치 후속 E2E 수정 (2026-10-27)

## 1. 현재 상태 (코드·배포·DB)
- Lee 요청: 70fe1c6 운영 deploy-verify와 admin-location-review-e2e 실패2건 수정→PR/검사/봇→운영배포1회→실제 통과 확인. 운영 직접 DB 접근(읽기 포함) 영구 금지. migrations-apply 실패 시 원문 보고 후 멈춤.
- 직접 확인: 기존 migrations-apply 40421335438 성공, 공개 점 집합에서4824 원본/캐시21.1959873,106.0087454. deploy-verify40421605615는 모든 공개 공고 메인/상세/원본 대조 후 반경20km 입력 검사에서 actual400/expected20000 실패. 위치E2E40421468430은 공고 생성 단계에서 permission denied for function company_identity, 로그인 전 실패.
- 로컬 실제 PostGIS 재현: service_role 공고 INSERT가 동일 함수권한 오류. 새 forward migration20261027042533은 순수 정규화 함수 EXECUTE만 authenticated/service_role에 허용. private schema/단일writer/원본 직접쓰기 차단 유지. 기존 적용 SQL 수정·공고번호조건·데이터 삭제 없음.
- 실제 컴포넌트 DOM commit 회귀: 기존20:400 실패→수정20:20000 통과. SearchRadiusInput은 외부 반경 변경 시 편집값을 같은 렌더에서 맞춤. 기존 운영 map-summary-check 및 관리자E2E의 기대값/검사는 변경하지 않음.
- 로컬 새권한 적용 후 service_role 공고/후보 INSERT+UPDATE, authenticated INSERT, 보호권한, 전체 canonical integration/5동시성/무결성0건 통과. 별도 production ACL 검사 추가. tsc/build/npm81/81, 반경 commit 회귀, PC·모바일0/1/여러위치6경우 모두 통과. 기존 운영70fe1c6 이후 이번 수정 운영 적용은 아직 안 됨.

## 2. 다음 할 일 3개
1. 로컬 검증 완료. PR 생성→최종 HEAD 필수 검사 확인. app-screen에 동일 DOM commit 회귀 검사 추가, migration-postgres는 실제 기존+새 migration을 NOSUPERUSER로 검증.
2. 최종 HEAD 필수검사 증거를 PR에 기록→Ready→봇병합→migrations-apply 성공 확인. 실패하면 원문그대로 보고하고 중단. GitHub dispatch만500등이면1회 재시도 허용.
3. 운영 실제배포1회와 deploy-verify·위치E2E의 로그인/확정/재사용/원본캐시/삭제까지 확인. 필수단계 실패·건너뜀 없는지 읽고 직접확인/추정 구분 보고.

## 3. 필수 규칙
- 운영 DB 직접연결/SQL/조회 금지. 정상 migration+production_check PR/CI 경로만. 사용자 재승인 불필요.
- 특정공고 개별보정 금지, job_work_locations 원본·writer1개·캐시파생 유지. R7/R8/STATUS/공개범위/화면틀 유지.
- 로컬 합성 성공과 운영 실제 시험 통과를 구분. Secrets 출력 금지, 추가 운영배포 필요 시 멈춤.
