# HANDOFF — unified reprocess queue and #5157 production verification (2026-10-31)

## 1. 실제 상태
- PR #370: `job_reprocess_queue`와 RLS, 기존 `ingest_job` 재처리 공통 runner, master push/schedule/dispatch 워크플로, 관리자 `POST /api/admin/reprocess-jobs` API.
- 작업 중 master 반영·운영 migration 적용·#5157 DB 재처리 실행 및 공개 상태는 **검증 전**. 실제 기록 없이 완료로 보고 금지.
- API는 `api/admin.js` 기존 단일 함수에 라우팅; 관리자 JWT 필수. Vercel 서버 전용 `GITHUB_REPROCESS_TOKEN`이 있다면 즉시 `workflow_dispatch`, 없으면 내구성 큐와 30분 간격 Actions가 처리한다.
- 직접 Supabase 운영 DB 조회/SQL 사용 금지. CI migration + production check 및 Actions runner만 사용.

## 2. 반드시 마칠 작업
1. PR #370 HEAD checks/app-screen/KDA/migration 검증, 봇 병합 및 migrations-apply의 운영 적용 확인.
2. `refresh-facebook-existing.yml` 실제 큐 처리·ingest·OCR/R7 최종화 로그 확인; #5157의 제목과 active 상태 검증, 실패하면 근본 이유를 수정하고 CI→봇→배포 반복.
3. Vercel Production READY·도메인 최신 버전과 PC/모바일 #5157 실제 공개 확인. 고정 ID 전용 예외·공개 게이트 우회·직접 운영 DB 변경 금지.

## 3. 변경 범위
- migration + production check; `crawler/reprocess_queue.py`, `crawler/finalize_reprocess_queue.py`, 기존 `refresh-facebook-existing.yml`, `api/_lib/admin-reprocess.js`, `api/admin.js`, `vercel.json`.
- `active=true` 임의 조작 금지. title/R7/public gate 모두 통과해야 큐 `success`.
