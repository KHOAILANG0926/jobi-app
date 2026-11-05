# HANDOFF — 2026-11-06 위치 "구글을 따라" 적용 (Claude)

## 1. 현재 상태
- master 1e019d0: PR #471(Google 검색어=Google 버튼, Google 장소 좌표 사용)·#472(성 경계 2km 오차 허용) 운영 반영, deploy-verify 42130784784 성공 [직접 확인].
- #5438 NEW TEAM ROBOTICS: 관리자 위치 확정 완료 21.229440,106.003770(run 42131119321) [직접 확인]. 근거: 업체 검색 비교 run 42127983264에서 Google이 "CÔNG TY TNHH NEW TEAMROBOTICS VIETNAM", NX 2-2, KCN Yên Phong (khu mở rộng), Yên Trung, Bắc Ninh을 찾음.
- 공개 경계 검사 42131233126: #5438 원본·상세 일치·성 안. 메인 핀 읽기는 16/16 전 공고 실패(10-28부터 실패하던 검사 도구) — 별도 과제.
- 프로세스 문서 개정(CLAUDE.md "위치 못 찾을 때 Google 지도"·RULES_CORE). "Google도 모르는 공고 수집 안 함"은 규칙만, 자동 차단 미구현.
- Regal #5422 사진은 사용자 지시로 계속 보류.

## 2. 다음 할 일 3개
1. #5438 PC·모바일 실제 화면(메인 핀·상세 지도·Google 목적지) 직접 확인 — 이 Claude 환경은 운영 접속 403이라 미확인.
2. "Google도 모르는 공고 수집 안 함" 수집 경로 자동 차단 구현(Lee 지시 시).
3. 공개 경계 검사(administrative-pin-check) 메인 핀 읽기 실패 원인 조사(전 공고 공통).

## 3. 필수 규칙
- 운영 DB SQL 직접 접근·번호 지정 데이터 덮어쓰기 금지. 승인 틀·하단 사진·STATUS 보호.
- GitHub 연결(세션 연결 저장소)로 브랜치·PR, 필수 검사·봇 병합 우회 금지.
- 확인 범위와 미완료 구분, 한국어 최종 5줄 이내. Secret 출력 금지.
