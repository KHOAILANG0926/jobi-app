# CHATGPT_HANDOFF — Highlands #5157 공통 추출·R7·상세 표시 (2026-10-31)

## 1. 현재 상태 (코드·배포·DB)
- 작업 브랜치 fix/highlands-full-pipeline-20261031, PR #368. 기존 master는 PR #365(#5157 Facebook 제목·회사·주소·급여 원문 추출 규칙)와 #367(관리자 R7 읽기)을 병합했고 Vercel 운영 반영까지 확인됨. 기존 #5157 운영 데이터 갱신과 공개는 아직 직접 확인되지 않았음.
- 이번 PR: Facebook 원문에서 모집 직무·Fulltime/Parttime을 구분해 기존 4영역에 표시하고 원문 전체 유지; 잘못된 빈 소제목 표시 억제; 복리후생의 값 없는 단독 'Xem thêm' 방지. KDA 레이아웃 유지 시험 추가.
- R7: 원문에 있는 연락처·회사·급여는 포스터에 반드시 반복될 필요 없게 출처별 대조; 보류 공고만 새로운 비교 버전으로 재검사. Facebook 기존 ID를 ingest_job으로 재처리한 뒤 R7을 즉시 실행하도록 GitHub Actions 수정.
- 운영 DB 직접 SQL 조회·수정 수행하지 않음. #5157 실제 데이터·OCR 판단·공개 여부는 작업 실행과 운영 앱 재검증 후에만 완료 판정.

## 2. 다음 할 일 3개
1. PR #368 최종 HEAD에서 checks·app-screen·KDA·R7 시험 통과, PR 본문에 HEAD 검증 기록 후 viecganban-bot 병합.
2. GitHub Actions에서 기존 #5157 재처리→R7 실제 실행 결과 확인. 불일치가 남으면 OCR/원문 증거로만 공통 규칙 추가 개선, 공개 기준 완화·개별 SQL 수정 금지.
3. Vercel Production 최신 master READY, deploy-verify 및 PC/모바일 #5157 제목·회사·급여·주소·직무·형태·빈라벨·공개 여부 실제 앱 확인. 미확인 시 완료 보고 금지.

## 3. 필수 규칙
- CLAUDE.md/AGENTS.md 최신 확정 4영역 및 KDA 기준 화면 보존. 기존 공개 공고/위치 승인 데이터 보호.
- 수집 원문·이미지 OCR 근거 외 값 추정 금지. 기존 ID 유지·관리자 확정 칸 보호·ingest_job 하나의 입구.
- 운영 DB 직접 접근 금지, 승인된 CI/Actions/마이그레이션만. 봇 병합, Vercel 무료 플랜 유지, 실제 운영 앱 링크·검증 결과만 완료 보고.
