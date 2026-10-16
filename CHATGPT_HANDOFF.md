# CHATGPT_HANDOFF — 운영 모바일 검사
갱신: 2026-10-16 UTC

## 1. 현재 상태
- 기준 master eb36b53, 검사 전용 branch audit/mobile-production-20261016, Draft PR #101. 앱 코드 수정 없음.
- [직접 확인] 운영 검사 run 38833385035 success(수집 성공; 시각 결함 없음의 뜻은 아님), PNG/JSON/log artifact 12017638181.
- [직접 확인] 검토용 서버 변환 artifact 12018457848, 권한 granted/denied·지역·지도·목록·메뉴 캡처 대조.
- [직접 확인] 모바일 필터/지도 겹침, 메뉴 글자의 배너 비침, 첫 800/844px 내 위치/공고 미노출, viewport보다 문서 폭 +2px. PC는 첫 화면에 필터/지도/목록 표시.
- [직접 확인] 수집된 console/page/HTTP 오류 없음. SwiftShader ReadPixels 성능 경고는 별도 기록. 네이티브 권한 팝업·실기기 미검증.
- 상세: docs/mobile-production-audit-20261016.md. 이전 HANDOFF는 WORK_LOG.md에 보존.
- [기존 기록] status/STATUS.md 생성 2026-10-15 23:17 VN, master/운영 기준 eb36b53. 이번 운영 DB 직접 조회·변경 없음.

## 2. 다음 할 일 3개
1. 사용자가 원본 artifact/현황을 검토한다. 이 검사 PR을 병합하지 않는다.
2. 사용자 개편 지시가 오면 기존 위치 기능·VietMap·PC 지도/목록 구조를 보존하면서 별도 구현 범위를 확정한다.
3. 실기기/iOS 네이티브 권한 팝업·성능은 별도 검증한다.

## 3. 필수 규칙
- AGENTS.md/CLAUDE.md, 직접 확인/기존 기록/미검증 구분.
- 이번 지시: 앱 코드 수정·master 병합·운영 배포·운영 DB 변경 금지. 회사 PC 저장 금지, 서버에서만 작업.
- 지도/오류를 숨기거나 모의 지도로 통과 금지. 자동 기하 후보만으로 결함 확정 금지.
