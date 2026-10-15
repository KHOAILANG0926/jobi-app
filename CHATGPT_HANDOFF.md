# CHATGPT_HANDOFF — MAP-R1
갱신: 2026-10-15
PR: https://github.com/KHOAILANG0926/jobi-app/pull/99 (draft, 미병합)

- [직접 확인] 브랜치 feat/map-r1-auto-location-20261015, 기반 origin/master 1abb6a4. 최신 fetch 후 master 추가 변경 없음. 사용자 지시: PR까지만, 병합·운영 배포·운영 DB 변경 금지.
- [직접 확인] 지도 viewport/거리 원점 분리, 기본 무제한, GPS/한 번 탭, 정확·대표 핀, 화면 ID별 수, 선택 근무지 보존, 상세 휠 확대 구현.
- [직접 확인] 관리자/Actions 공통 resolver, 공고 평생 최대 2회 외부 검색, 캐시, 공유 일일 250회 예약, 임대·멱등 저장. 공개 상태·기존 정확 좌표 변경 안 함.
- [직접 확인] npm test 60/60, 타입·빌드, PC/모바일 Chromium 및 로컬 PostgreSQL 검사 통과. 실제 운영 위치 처리/API 호출 0회.
- [직접 확인] pending SQL만 작성·격리 DB 검증. 운영 적용 없음. MAP_R1_ENABLED는 GitHub 변수와 서버 환경에 각각 필요하며 현재 활성화하지 않음.
- [직접 확인] Yên Phong 1단지 누락 확인. Overpass CONNECT 403으로 입구·OSM ID 미검증, 좌표 추가 없음.
- 다음: PR 검토 → 사용자 승인 후 pending SQL 적용/활성화 및 운영 데이터 검증. 지도 타일 과금의 공급자 측 상한은 이번 작업으로 검증되지 않음.
- 상세 결과/재현 명령: docs/MAP-R1-report.md. 이전 기록은 WORK_LOG.md.
