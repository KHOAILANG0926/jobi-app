# HANDOFF — 2026-11-04 대표 사진 공통 규칙 수정 (Codex)

## 1. 현재 상태
- [직접 확인] GitHub 연결 도구로 master 750ebcf에서 fix/card-photo-images-first 생성. 로컬 push 사용 금지.
- 공통 대표 이미지 함수: 브랜드 로고 → companyLogoUrl(imageUrl) → jobImagePublicUrl(images[0]) → industryPhotoUrl. JobCard와 JobDetail의 상단/기업정보에서 사용. CSS·하단 Hình ảnh tuyển dụng·DB·#5438 좌표 변경 없음.
- [직접 확인] 대표 이미지·companyLogo 단위 시험 통과, desktop baseline 8/8. 전체 시험은 84/109(의존성 누락/환경 제약), 상세 회귀도 의존성 누락. 로컬 build는 tsc: not found. PR의 필수 CI로 대체하도록 Lee가 명시 허용.
- 커밋·PR·필수 CI·봇 병합·배포·운영 화면 검증은 아직 미완료. 이전 상세 기록은 WORK_LOG.md로 보존.

## 2. 다음 할 일 3개
1. 연결 도구로 변경 파일 커밋·양식 PR 생성 → 필수 검사 → 기존 봇 병합. 실패 시 원문 보고·수정, 강제 병합 금지.
2. deploy-verify 결과 확인 후 #5437 DOOKKI·#5438 NEW TEAM ROBOTICS의 PC/모바일 카드·상세 상단·하단 사진·깨짐/잘림 확인. 브라우저 미확인 시 사실대로 보고.
3. 상세 항목 정리안 및 알바몬 데모는 Lee 지시로 보류. FB 수집기 연결은 기존 미완료 사항이며 이번 범위 밖.

## 3. 필수 규칙
- 이번 작업은 대표 이미지 순서만. 디자인·크기·위치·간격·하단 사진 영역·DB 데이터·#5438 좌표 변경 금지.
- 로컬 push 금지. GitHub 연결 도구로만 커밋·PR. 필수 검사 및 기존 병합 보호 유지, 사람 승인이 필요하면 승인 대기 보고.
- 운영 DB 직접 조회/SQL 금지. 기존 승인 틀 유지. 비밀값 출력 금지. 사실만 한국어로, 최종 보고 5줄 이내.
