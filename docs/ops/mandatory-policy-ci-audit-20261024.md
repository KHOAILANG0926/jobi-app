# 확정 규정 ↔ CI 차단 연결 점검 (2026-10-24)

원천: `AGENTS.md`, `CLAUDE.md`. 이 표는 **자동 판정 가능 여부**를 구분한다. 문서 규정만으로 CI 차단을 주장하지 않는다.

| 규정 영역 | 실제 강제 수단 | 자동 검증 범위 / 한계 |
|---|---|---|
| STATUS 및 생성기 보호 | `check-repository-policy.mjs` + 기존 `guard` | 보호 경로 변경 CI 실패. 사용자 명시 허용은 별도 승인 필요 |
| DB 마이그레이션·인증·RLS·권한·배포 워크플로 | `check-repository-policy.mjs` + publication-gate | 변경 시 CI 실패(보수적 차단). 운영 환경 안전성은 별도 확인 |
| 비밀파일·로컬 환경 파일 금지 | `check-repository-policy.mjs` | 명명된 env/key/pem/certificate 파일 차단. 문자열 내 신규 토큰까지 탐지는 아님 |
| 원본 채용사이트 URL 비노출 | `check-repository-policy.mjs` | 변경된 브라우저 코드에서 URL 필드 노출 패턴 탐지. 의미론적 우회는 별도 코드 리뷰 |
| 공고 상세 분류·원문 보존 | `jobDetailSections.test.ts` 및 정책 게이트 | 분류 모듈 수정 시 정답표 테스트 동반 강제. 실제 모든 공고의 내용 정확성은 별도 검사 |
| CTY KDA 카드·상세 틀 보존 | `test-job-card-layout.mjs`, `app-screen-check.yml`, 정책 게이트 | 카드·상세 변경 시 회귀 검사. 승인된 수치 도면이 없는 항목은 완전한 동일성 자동 판정 불가 |
| PC·모바일 영향 범위 | `app-screen-check.yml` | 각 뷰포트 실행. 사용자 승인 범위 자체는 PR 설명만으로 증명 불가 |
| 지도·좌표·길찾기 | `jobCoords.test.ts`, `directionsPlan.test.ts`, `test-job-location-detail.mjs`, 정책 게이트 | 관련 코드 변경 시 회귀 검증 필수. 외부 지도 타일 장애와 실제 좌표 신뢰도는 독립 확인 |
| 한국 일자리 별도 모듈 | `check-repository-policy.mjs` | 한국 상세 코드 수정 시 별도 테스트 요구. DB/테이블 격리는 별도 DB·스키마 검증 |
| 직업코드·원문 근거·공개 제한 | `publication-gate` + `supabase/tests/occupation_publication.pglite.test.mjs` | 게이트 및 정해진 테스트 케이스. 실제 수집 원문 의미 분류는 자동 확증 불가 |
| PR 근거·현재 커밋 SHA | `check-pr-ready.mjs` | Ready PR의 증거 형식·SHA 확인. GitHub Actions API에서 실제 성공을 별도로 확인해야 함 |
| 실제 PC·모바일 화면 | `app-screen-check.yml` | CI Playwright 검사; 실제 서비스의 최종 운영 반영은 `deploy-verify.yml` 별도 검사 |
| PR 병합/Production 배포 및 기존 승인 | GitHub 권한·리뷰 절차 + `deploy-verify.yml` | CI 자체만으로 운영 승인 의사 및 브랜치 보호 설정 보장 불가 |
| 회사 PC 저장 금지, 중간 보고·사실 표기·HANDOFF 인계, 작업 반복 상한 | 작업 실행 절차 및 리뷰 | Git diff로 사용자 PC 저장/대화 보고 진실성/내부 판단을 검증할 수 없음. CI 통과=준수 완료라고 주장 금지 |

**안전 원칙:** 테스트 파일이 같이 수정된 것만으로 화면 기준을 지켰다고 단정하지 않으며, 자동으로 증명 불가능한 요구를 조용히 합격으로 처리하지 않는다.
