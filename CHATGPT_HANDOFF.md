# CHATGPT_HANDOFF — MAP-R1
갱신: 2026-10-15 (Asia/Bangkok)

## 1. 현재 상태
- [직접 확인] 기존 Draft PR #99, branch feat/map-r1-auto-location-20261015. 검증 시작 SHA 9475d0c. 이번 수정은 동일 브랜치에서만 보존한다.
- [직접 확인] 9475d0c 원격 CI 3개 성공, 로그 60/60·타입·빌드·화면 검사 통과. 원격 CI checkout은 GitHub 테스트 병합 ea9211c이며 실제 master 병합이 아니다.
- [직접 확인] 관리자 검토가 SELECT FOR UPDATE 후 UPDATE 전일 때 자동 승인이 끼어드는 결함 재현·수정(EXCLUSIVE 잠금). 수정 SQL+실제 후보/RPC·캐시/quota·R4/R1-R7/R8 트리거 격리 검사, 주소 이력·거부/철회 회귀, before/after 경합 통과. 수정 소스 tsc/build·resolver/API 모의 검사 통과.
- [직접 확인] npm audit는 기존 취약점 4건(high 2)으로 실패. package/lock은 master 대비 변경 없음. 실제 악용/운영 영향 미검증.
- [미검증] 운영 schema/GRANT drift·키 등록·VietMap 실연동/계정 과금 상한·Yên Phong 1단지 입구. 이번 수정은 [skip ci]로 제출: 화면 CI가 운영 공개 API를 읽기 때문에 최종 수정 SHA 원격 CI 미검증.
- [직접 확인] 이번 세션 운영 DB/API·자동화 설정·master/운영 배포 변경 없음. 운영 활성화 상태는 이번에 직접 조회하지 않음.
- 상세: docs/MAP-R1-preflight.md (PASS/FAIL/미검증, 적용·롤백). 이전 검증: docs/MAP-R1-report.md. 이전 HANDOFF는 WORK_LOG.md에 보존.

## 2. 다음 할 일 3개
1. PR #99의 잠금 수정·격리 검증을 검토하고 기존 의존성 경고를 별도 보안 패치 범위로 판단.
2. 운영 조회 허용 후 최종 SHA 필수 CI 및 실제 schema/GRANT·키/공급자 비용 제한 확인. 기존 성공 검사를 이유 없이 반복하지 않음.
3. 별도 사용자 승인 이후에만 문서 순서대로 DB 적용·실연동·병합/배포·활성화. 롤백 시 flag=false만으로 기존 승인 핀이 제거되지 않음에 주의.

## 3. 필수 규칙
- AGENTS.md/CLAUDE.md 준수. 직접 확인·기존 기록·미검증 구분, secret 값 출력 금지.
- 이번 지시: 운영 DB 변경·실제 API 호출·자동화 활성화·master 병합·운영 배포 금지. 사용자 금지가 일반 배포 규칙보다 우선.
- 추정 좌표 추가·기존 수동 승인 덮어쓰기·공개 상태 변경·주소 이력/일일 카운터 초기화 금지. pending 폴더 일괄 적용 금지.
