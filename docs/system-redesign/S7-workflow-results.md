# S7 결과 — 71개 워크플로 1:1 처리 기록 (#808, S2 설계 #810 5절)

- 기준: S2 설계 5절 표(2026-11-14). 현재 워크플로 파일 66개(S7 전 69개 → S7에서 3개 제거).
- 제거 전 참조 확인: `grep -rn <파일 이름>`(워크플로·스크립트·시험·문서). 제거한 3개는 코드 참조 0, 남은 것은 옛 기록 문서뿐.
- 반복 오류 기록(4절 ⑦): 새 표를 만들지 않고 GitHub 이슈 라벨 `regression`을 재사용한다. check-pr-ready의 칸 강제는 자동 PR 경로(crawl-guard·codex-response)에 영향이 있어 보류.

- S2 표 이후 새로 생긴 워크플로(표에 없음, S7 대상 아님): `approval-checks.yml`, `review-signal.yml`

| # | 파일 | S2 계획 단계 | 지금 있음 | 처리 결과 |
|---|---|---|---|---|
| 1 | `admin-line-pick-e2e.yml` | S4 점검 | 있음 | S7 대상 아님 — S2 단계 S4 점검 소관(이번에 바꾸지 않음) |
| 2 | `admin-location-confirm.yml` | S7 | 있음 | 반복 실패 아님 — 최근 실패(run 44313087624, 11-18)는 입력 공고가 확정 대기 목록에 없다는 정상 거부(`#6255이 위치 확정 대기 목록에 없음`), 직전 6건 성공. 이슈 안 만듦 |
| 3 | `admin-location-evening-report.yml` | S4 점검 | 있음 | S7 대상 아님 — S2 단계 S4 점검 소관(이번에 바꾸지 않음) |
| 4 | `admin-location-review-e2e.yml` | S4 점검 | 있음 | S7 대상 아님 — S2 단계 S4 점검 소관(이번에 바꾸지 않음) |
| 5 | `admin-operations.yml` | S4 | 없음 | S7 대상 아님 — S2 단계 S4 소관(이번에 바꾸지 않음) |
| 6 | `administrative-pin-check.yml` | S7 | 있음 | 해소 — 최근 8건 모두 성공(11-16 workflow_run). 이슈 안 만듦 |
| 7 | `ai-reader-calibration.yml` | S4 | 있음 | S7 대상 아님 — S2 단계 S4 소관(이번에 바꾸지 않음) |
| 8 | `android-twa-build.yml` | S4 점검 | 있음 | S7 대상 아님 — S2 단계 S4 점검 소관(이번에 바꾸지 않음) |
| 9 | `android-upload-key-init.yml` | S4 점검 | 있음 | S7 대상 아님 — S2 단계 S4 점검 소관(이번에 바꾸지 않음) |
| 10 | `app-screen-check.yml` | — | 있음 | 변경 없음(유지) |
| 11 | `auto-location.yml` | S4 점검 | 있음 | S7 대상 아님 — S2 단계 S4 점검 소관(이번에 바꾸지 않음) |
| 12 | `bot-pr-automerge.yml` | S3(이전)→S3 끝(제거) | 있음 | S7 대상 아님 — S2 단계 S3(이전)→S3 끝(제거) 소관(이번에 바꾸지 않음) |
| 13 | `brand-logo-watch.yml` | S4 점검 | 있음 | S7 대상 아님 — S2 단계 S4 점검 소관(이번에 바꾸지 않음) |
| 14 | `brand-logo.yml` | S4 점검 | 있음 | S7 대상 아님 — S2 단계 S4 점검 소관(이번에 바꾸지 않음) |
| 15 | `business-search-compare.yml` | S4 점검 | 있음 | S7 대상 아님 — S2 단계 S4 점검 소관(이번에 바꾸지 않음) |
| 16 | `claude-auto.yml` | S3·S5 | 있음 | S7 대상 아님 — S2 단계 S3·S5 소관(이번에 바꾸지 않음) |
| 17 | `codex-wait-timer.yml` | S3 | 있음 | S7 대상 아님 — S2 단계 S3 소관(이번에 바꾸지 않음) |
| 18 | `company-code-assign.yml` | S4 | 있음 | S7 대상 아님 — S2 단계 S4 소관(이번에 바꾸지 않음) |
| 19 | `company-reread.yml` | S4 | 있음 | S7 대상 아님 — S2 단계 S4 소관(이번에 바꾸지 않음) |
| 20 | `crawl-chotot-probe.yml` | S6 | 있음 | S6에서 처리 — VPS 러너 crawler 정상(run 44277027923, #808 S6) |
| 21 | `crawl-facebook-one.yml` | S6 | 있음 | S6에서 처리 — VPS 러너 crawler 정상(run 44277027923, #808 S6) |
| 22 | `crawl-guard.yml` | S3 | 있음 | S7 대상 아님 — S2 단계 S3 소관(이번에 바꾸지 않음) |
| 23 | `crawl.yml` | S7 | 있음 | 유지 — 제거 후보였으나 지금 vieclam24h VPS 수집에 쓰임(11-18 수동 실행 3건 성공, #883·#886). 참조 다수(crawl-guard·vps-diag·시험 등) |
| 24 | `crawler-cli-tests.yml` | S7 | 있음 | 통합 — offline-cli 시험 7개를 필수 checks로 옮김. crawl-install(실제 패키지·크롬 설치 확인, ubuntu-22.04)은 무거워 그대로 이 파일에 남김 |
| 25 | `demo-capture.yml` | S4 점검 | 있음 | S7 대상 아님 — S2 단계 S4 점검 소관(이번에 바꾸지 않음) |
| 26 | `deploy-verify.yml` | — | 있음 | 변경 없음(유지) |
| 27 | `desktop-header-proof.yml` | S4 점검 | 있음 | S7 대상 아님 — S2 단계 S4 점검 소관(이번에 바꾸지 않음) |
| 28 | `detail-read.yml` | S4 점검 | 있음 | S7 대상 아님 — S2 단계 S4 점검 소관(이번에 바꾸지 않음) |
| 29 | `dup-count.yml` | S4 점검 | 있음 | S7 대상 아님 — S2 단계 S4 점검 소관(이번에 바꾸지 않음) |
| 30 | `facebook-preview-read.yml` | S4 점검 | 있음 | S7 대상 아님 — S2 단계 S4 점검 소관(이번에 바꾸지 않음) |
| 31 | `fetch-occupation-source.yml` | S4 점검 | 있음 | S7 대상 아님 — S2 단계 S4 점검 소관(이번에 바꾸지 않음) |
| 32 | `job-ocr-check.yml` | S4 점검 | 있음 | S7 대상 아님 — S2 단계 S4 점검 소관(이번에 바꾸지 않음) |
| 33 | `job-policy-tests.yml` | S7 | 없음 | 통합 후 제거 — 시험 2개·py_compile·node --check 전부 필수 checks로 옮김. 남은 참조: 옛 기록 문서 2개(docs/job-policy-*)만 |
| 34 | `job-repair-preview.yml` | S4 | 있음 | S7 대상 아님 — S2 단계 S4 소관(이번에 바꾸지 않음) |
| 35 | `job-rules-apply.yml` | S7 | 있음 | 해소 — 실패 3건(11-12·13·15)은 S4 열쇠 이전 전 SUPABASE_DB_URL 없음, 11-16 성공. 이슈 안 만듦 |
| 36 | `jobcard-integrity.yml` | S7 | 있음 | 해소 — 최근 8건 모두 성공. 이슈 안 만듦 |
| 37 | `korea-fb-research.yml` | S6 | 있음 | S6에서 처리 — VPS 러너 crawler 정상(run 44277027923, #808 S6) |
| 38 | `korea-fb-survey-read.yml` | S4 점검 | 있음 | S7 대상 아님 — S2 단계 S4 점검 소관(이번에 바꾸지 않음) |
| 39 | `korea-fb-survey.yml` | S6 | 있음 | S6에서 처리 — VPS 러너 crawler 정상(run 44277027923, #808 S6) |
| 40 | `local-jobs-privileges-apply.yml` | S7 | 없음 | 이미 제거됨(파일 없음, 마지막 실행 11-15). 참조 0 |
| 41 | `location-ladder-compare.yml` | S4 | 있음 | S7 대상 아님 — S2 단계 S4 소관(이번에 바꾸지 않음) |
| 42 | `map-pin-fit-check.yml` | S7 | 있음 | 고침 — 매 배포마다 #188 전용 조건 때문에 skipped만 쌓임(11-16 5건 skipped). PR·workflow_run 계기를 지우고 손으로 돌리는 검사로만 둠. 참조: location-test-policy.mjs(스크립트 경로만) |
| 43 | `merge-provenance.yml` | S6 | 있음 | S6에서 처리 — VPS 러너 crawler 정상(run 44277027923, #808 S6) |
| 44 | `migrations-apply.yml` | S4 | 있음 | S7 대상 아님 — S2 단계 S4 소관(이번에 바꾸지 않음) |
| 45 | `mobile-home-preview.yml` | S7 | 있음 | 유지 — tsc·npm test·build는 checks와 겹치지만 PC·모바일 미리보기 캡처를 만드는 데 빌드가 필요함(업무용 미리보기). 시험 단계 중복만, 제거 안 함 |
| 46 | `mobile-screens.yml` | S4 점검 | 있음 | S7 대상 아님 — S2 단계 S4 점검 소관(이번에 바꾸지 않음) |
| 47 | `multi-role-presentation.yml` | S7 | 있음 | 유지 — 실제 크롬으로 여러 직무 화면을 보는 시험(Playwright 설치 필요)이라 checks에 합치면 모든 PR이 무거워짐. 필수 아님 그대로 |
| 48 | `occupation-gazette-monthly-check.yml` | S4 점검 | 있음 | S7 대상 아님 — S2 단계 S4 점검 소관(이번에 바꾸지 않음) |
| 49 | `occupation-master-apply.yml` | S7 | 없음 | 이미 제거됨(파일 없음, 마지막 실행 11-15). 참조: scripts/occupations/build_seed_sql.py 주석 1줄 |
| 50 | `occupation-publication-check.yml` | S3 | 있음 | S7 대상 아님 — S2 단계 S3 소관(이번에 바꾸지 않음) |
| 51 | `occupation-r8-apply.yml` | S4 점검 | 있음 | S7 대상 아님 — S2 단계 S4 점검 소관(이번에 바꾸지 않음) |
| 52 | `occupation-weekly-unclassified.yml` | S4 점검 | 있음 | S7 대상 아님 — S2 단계 S4 점검 소관(이번에 바꾸지 않음) |
| 53 | `ops-insert-job.yml` | S4 | 있음 | S7 대상 아님 — S2 단계 S4 소관(이번에 바꾸지 않음) |
| 54 | `ops-publish-jobs.yml` | S4 | 있음 | S7 대상 아님 — S2 단계 S4 소관(이번에 바꾸지 않음) |
| 55 | `ops-run-sql.yml` | S4 | 있음 | S7 대상 아님 — S2 단계 S4 소관(이번에 바꾸지 않음) |
| 56 | `p0-foundation.yml` | S4 | 없음 | S7 대상 아님 — S2 단계 S4 소관(이번에 바꾸지 않음) |
| 57 | `pr-checks.yml` | S3 | 있음 | S7 대상 아님 — S2 단계 S3 소관(이번에 바꾸지 않음) |
| 58 | `r7-source-aware-unit.yml` | S7 | 없음 | 중복 제거 — 같은 ocr-compare.test를 publication-gate(occupation-publication-check, 모든 PR·master)가 이미 돌림. 참조 0(decision-approval-gate 목록에서도 뺌) |
| 59 | `refresh-facebook-existing.yml` | S4 점검 | 있음 | S7 대상 아님 — S2 단계 S4 점검 소관(이번에 바꾸지 않음) |
| 60 | `reprocess-queue-ci.yml` | S7 | 없음 | 통합 후 제거 — py_compile·node --check 전부 필수 checks로. 참조 0 |
| 61 | `rules-core-sync.yml` | S7 | 있음 | 보류 — CLAUDE.md에서 자동 생성하면 Lee가 정한 요약본(RULES_CORE) 문장이 바뀌어 규칙 훼손 위험. 지금 sync 검사(같은 PR에서 함께 고치기)는 그대로 유지 |
| 62 | `status-guard.yml` | S3 | 있음 | S7 대상 아님 — S2 단계 S3 소관(이번에 바꾸지 않음) |
| 63 | `status-report.yml` | — | 있음 | 변경 없음(유지) |
| 64 | `street-center-dryrun.yml` | S7 | 있음 | 유지 — CLAUDE.md·AGENTS.md 거리 가운데 규칙이 미리보기 도구로 지정(scripts/ops/street-center-dryrun.mjs). 손으로만 돌림 |
| 65 | `supabase-keepalive.yml` | S4 점검 | 있음 | S7 대상 아님 — S2 단계 S4 점검 소관(이번에 바꾸지 않음) |
| 66 | `unmerged-work-alert.yml` | — | 있음 | 변경 없음(유지) |
| 67 | `vercel-deploy.yml` | S4 | 있음 | S7 대상 아님 — S2 단계 S4 소관(이번에 바꾸지 않음) |
| 68 | `vn-admin-sync.yml` | S7 | 있음 | 유지 — vietnam-provinces 외부 패키지 설치가 필요해 checks에 합치지 않음. 필수 아님 그대로 |
| 69 | `vps-clean-old-runner.yml` | S6 | 있음 | S6에서 처리 — VPS 러너 crawler 정상(run 44277027923, #808 S6) |
| 70 | `vps-diag.yml` | S6 | 있음 | S6에서 처리 — VPS 러너 crawler 정상(run 44277027923, #808 S6) |
| 71 | `vps-disk-report.yml` | S6 | 있음 | S6에서 처리 — VPS 러너 crawler 정상(run 44277027923, #808 S6) |
