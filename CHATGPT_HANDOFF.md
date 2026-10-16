# CHATGPT_HANDOFF — PC 모바일 변경 직전 소스 그대로 복원
갱신: 2026-10-16 (Asia/Bangkok)

## 1. 현재 상태
- [직접 확인] 사용자 재지시: 항목별 수정이 아니라 모바일 변경 직전 PC로 복원. 이전 PR #105 부분 복원은 완료 조건 미달. 기준 eb36b53443e1a9a3a2077d18447c490921baa5bb.
- [직접 확인] HomeDesktop/LayoutDesktop/DesktopHomeMapExplorer/DesktopHomeMapCanvas/DesktopGeoapifyMapCanvas는 기준 원본을 사용, 분리 파일로 연결하는 import 경로만 변경. 원본 SHA256 대조 검사 5개 및 기존 JobDetail/index.css/apply.css 3개 추가.
- [직접 확인] Home/Layout은 기존 760px 기준으로 PC 원본 또는 현재 모바일 버전을 선택. 모바일 전용 스타일 전체를 media 블록에 제한해 PC 적용 차단. 모바일 데이터/배너/필터 유지.
- [직접 확인] 상세페이지와 기존 CSS는 원본 그대로, 새로운 디자인·부분 수정·임의 버전 선택 없음. DB/Auth/RLS/좌표/데이터 변경 없음.
- [기존 기록] 운영 b2bfe48는 이전 부분 복원. 이번 exact 복원은 새 브랜치 fix/exact-desktop-baseline-20261016, 최종 CI/운영 증거는 새 PR 기록 참조.

## 2. 다음 할 일 3개
1. 원본 8파일 일치·tsc/build·PC/mobile 기존 회귀와 캡처 검증.
2. 사용자 복원 지시에 따라 PR 병합, 같은 SHA Production READY 및 운영 PC/mobile 검사 확인.
3. 실제 앱 링크와 확인 결과만 보고. 새 디자인 변경·사용자 GitHub 링크 이동 금지.

## 3. 필수 규칙
- AGENTS.md/CLAUDE.md 준수. PC 부분 복원을 전체 원복으로 보고하지 않음. 원본 내용 비교 증거 필수.
- 모바일 보존, 운영 DB/Auth/보안/좌표 승인 변경 금지. 회사 PC 보관·현장 확인 안내 금지.
- STATUS와 기존 검증 장치 보호. 동일 성공 SHA 재검사 금지, 같은 원인 수정검증 2회 실패 시 중단.
