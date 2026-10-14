# CHATGPT_HANDOFF — 메인 공고 카드
갱신: 2026-10-14

## 1. 현재 상태
- 기준 master a663c13, 작업 codex/main-job-cards-20261014. 메인 추천/목록은 공고 ID별 한 번 표시하며 급여 미확인 공고를 카드에서 제외. 검색·지도·상세의 공유 데이터는 유지.
- 실제 Storage 이미지·회사명·지역·제목·원문 급여 표시. 업종 이미지·카드 Zalo 제거. 실제 시급→일급→월급 우선, 지급 주기가 없으면 추측하지 않음. PC hover·모바일 펼치기로 확인된 근무조건 표시.
- [직접 확인] 운영 DB #4824 active=true/admin_hidden=false, 실제 이미지·일급 있음. DB 쓰기·삭제 없음.
- [직접 확인] tsc/build 성공, npm test 54/54. Production 배포·운영 브라우저 검증은 아직 완료되지 않음. 사이트 도메인은 환경 네트워크에서 403 차단.

## 2. 다음 할 일 3개
1. PR 최종 SHA의 checks/guard 확인 후 사용자 지시 범위에서 master 반영·Production 배포.
2. 운영 홈에서 #4824 한 번 표시·실제 이미지·급여·hover/mobile 펼치기 확인.
3. 상세 Zalo·검색·지도 회귀 확인 후 배포 SHA와 검증 결과 기록.

## 3. 필수 규칙
- AGENTS.md/CLAUDE.md 준수. 직접 확인·기존 기록·추정 구분. STATUS 검증 장치 수정 금지.
- #4824 포함 모든 공고 데이터 변경·삭제 금지. 메인 표시만 변경.
- 필수 검사 tsc/npm test/build, GitHub 보존·배포·실제 사이트 검증을 구분. Secret 출력 금지.
