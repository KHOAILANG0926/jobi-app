# CHATGPT_HANDOFF — PC 상세 연락처 안내 폭 복구
갱신: 2026-10-17 Asia/Bangkok

## 1. 현재 상태
- 운영 master 930fdf57 유지. 사용자 캡처의 상세 화면 오류는 이전 smoke 검사에서 검출하지 못함.
- 직접 확인: src/index.css의 연락 버튼용 54px 고정 폭이 긴 안내·내부지원·메시지에도 적용됨.
- 사전 범위 PR #118 / 구현 PR #119. 실제 안내 컴포넌트와 운영 CSS로 PC·모바일 회귀 검사 준비. 원격 Chromium에서 기존 CSS의 missing 1366px: text squeezed to 54px 실패 확인(run 38994522246). 최소 PC CSS 적용, 최종 검사 대기.
- 모바일 틀·기존 54px 전화/Zalo 버튼·DB/Auth/RLS/좌표/STATUS 변경 없음. 운영 배포 없음.

## 2. 다음 할 일 3개
1. 회귀가 기존 CSS에서 54px 폭 오류로 실패하는지 확인 후 최소 PC CSS 적용.
2. 수정 SHA 필수 CI 및 미리보기 실제 화면 확인. 실패/미확인 상태를 완료로 보고하지 않음.
3. 사용자만 범위 PR #118 → 구현 PR #119 순서 병합. 이후 Production SHA·화면 검증.

## 3. 필수 규칙
- CTY KDA 승인 틀·모바일 보존. 임의 재설계 금지.
- 범위 문서와 구현은 별도 변경. 검사 생략·완료 위조 금지.
- 회사 PC 저장 안내·DB/Auth/RLS/STATUS 변경 금지. 사용자만 병합.
