# CHATGPT_HANDOFF — 관리자 URL 탭·확정 후 스크롤 유지 (2026-10-26)

## 1. 현재 상태 (코드·배포·DB)
- 기준 master 6840b46: #269 봇 병합·운영 배포 dpl_GSKFrFq6JHi6YJymG5Hpho5TSS6b READY, 운영 도메인 SHA 일치. 줄 선택 E2E 40245878808 attempt2 실제 로그인·section02/decided_by=lee·원문 상세 재생성·정리 PASS, 실패/skipped 없음.
- 작업 fix/admin-tab-scroll-20261026: AdminDashboard 탭을 URL searchParams에서 읽고 탭 변경마다 history push, 같은 탭은 중복 기록 안 함. 다른 쿼리는 보존하고 잘못된 tab은 dashboard로 처리.
- 위치 대기/후보 목록은 응답 직전 현재 스크롤을 기억해 목록 렌더 직후 복원. 스타일·장식·테두리 변경 없음. Google/근거/공고 상세 링크는 기존 target=_blank 유지 확인.
- 새 관리자 브라우저 회귀(PC1366·모바일390): 실제 앱 + 브라우저 내부 인증/API fixture(운영 DB 쓰기 없음). URL·reload·back/forward·Google popup·공고 링크·앞쪽 동일주소 자동재사용 삭제 후 스크롤 유지 검사. app-screen 필수 CI에 추가.
- 실제 관리자 위치 E2E에도 reload·history·Google popup·승인 후 탭/스크롤 검사 추가. 공개 시험 공고를 만들거나 운영 공개 좌표를 시험 승인하지 않음.
- [직접 확인] 수정 전 tab=locations에서 Dashboard, 동시 자동재사용 카드 삭제 시 스크롤2400→1949 재현. 수정 후 개발 브라우저 PC·모바일, 타입·빌드·npm test79/79 성공. 별도 리뷰 차단 문제 없음. PR CI/봇 병합/이번 운영 배포/실제 E2E는 아직 대기.

## 2. 다음 할 일 3개
1. 최종 빌드 브라우저·PR CI 성공 근거로 Ready 전환, 봇 병합 확인.
2. 이번 작업 운영 배포 1회 후 운영 도메인 새 SHA/READY와 실제 관리자 탭·스크롤 E2E 확인. 배포 전 자동시험은 구분해 필요시 시험만 재실행.
3. 실제 확인과 추정, 워크플로 성공과 실제 시험 통과 및 실패/skipped 단계를 구분해 보고.

## 3. 필수 규칙
- Lee 요청: URL 탭/뒤로가기, 확정 후 스크롤·탭 유지, 관리자 외부/공고 링크 새 탭. 새 장식·둥근 테두리 금지. 운영 배포 1회 허용.
- DB/Auth/RLS/Secrets/STATUS·승인 공고 틀 보호. 시험은 비공개·생성 ID로 정리. Secret 출력·저장 금지.
- PR→검사→봇 병합→배포→실제 확인. 미실행/skipped/실패를 통과로 보고하지 않음.
