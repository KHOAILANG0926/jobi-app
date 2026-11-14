# S1 — 기존 자동화·검사 전수 조사 (System Redesign)

- 작성: Claude (viecganban-bot 세션), 2026-11-14
- 기준 커밋: origin/master `1b99e6702cceb2259e0aa75a53eca2a836171569`
- 범위: `.github/workflows/*.yml` 66개, 개발 관리용 검사 스크립트(`scripts/check-*`, `scripts/*-gate.mjs`, `scripts/ci/*`)
- 이 문서는 **조사 기록**이다. 코드·워크플로·권한·보호 설정은 바꾸지 않았다. 이 PR은 병합하지 않는다(Codex 검토 요청용 Draft).
- 표시: **[직접 확인]** = 이번에 명령으로 조회함 / **[기존 기록]** = #728 등 이전 기록, 이번에 다시 조회하지 않음 / **[추정]**

## 0. 조사 방법 (재현 가능)

| 항목 | 방법 |
|---|---|
| 워크플로 트리거·비밀값·호출 스크립트 | 66개 yml을 YAML로 읽어 `on:`·`secrets.*`·`scripts/…` 추출 |
| 실행 상태 | `GET /repos/.../actions/workflows/<파일>/runs?per_page=30` — 전체 횟수, 최근 30회 성공·실패·건너뜀, 마지막 결과 |
| 등록 상태 | `GET /repos/.../actions/workflows` 2쪽 — 등록 114개: 지금 있는 파일을 가리키는 것 71개(66개 파일, 일부 이중 등록) + 파일이 지워진 옛 등록 43개. active 111 / disabled_manually 3 |
| 권한 | `GET /repos/KHOAILANG0926/jobi-app` (세션 계정 `viecganban-bot`) |

## 1. 사실 확인

| # | 사실 | 근거 |
|---|---|---|
| F1 | 세션 계정은 `viecganban-bot`이고 **원본 저장소에 push 권한이 있다**(admin 아님). | [직접 확인] `gh api user` → viecganban-bot / `permissions: push=true, admin=false, maintain=false` |
| F2 | 병합 봇 `bot-pr-automerge.yml`은 **꺼져 있다**(disabled_manually). 지금은 자동 병합 경로가 없다. | [직접 확인] workflows API state |
| F3 | 수집 `crawl.yml`(8월 이후 실패 10/28), `crawl-facebook-one.yml`도 꺼져 있다. | [직접 확인] |
| F4 | master 보호: 필수 `checks`·`guard`·`app-screen`, enforce_admins=true, 승인 수 0(코드 소유자 리뷰는 사실상 강제 안 됨). | [기존 기록] #728 2026-11-13 R3 점검·#803 답신. 봇은 admin이 아니라 이번에 보호 설정을 다시 읽지 못함. |
| F5 | 승인 범위 밖 변경 차단(`decision-approval-gate`)·Codex 대기(`codex-review-gate`)는 **병합 봇 안에서만** 실행된다 → 봇이 꺼진 지금, 수동 병합은 이 두 검사를 거치지 않는다. | [직접 확인] `bot-pr-automerge.yml`이 두 스크립트를 부름, `pr-checks.yml`에는 자체 시험(`*.test.mjs`)만 있음. [기존 기록] #728 R3 "새로 확인된 문제 1" |
| F6 | Codex는 **Lee 계정의 `@codex review` 댓글에만** 반응한다고 기록돼 있다. | [기존 기록] CLAUDE.md AI 팀 절, `claude-auto.yml:192`. 이 PR에서 봇 계정으로 다시 시험한다(5절). |
| F7 | Lee 로그인이 코드에 박혀 있다: `codex-review-gate.mjs:42`, `decision-approval-gate.mjs:6`, `bot-pr-automerge.yml:41,44,129`, `claude-auto.yml:112`, `ops-run-sql.yml:19`. | [직접 확인] grep |
| F8 | `crawl-guard.yml:103-108`은 `[자동수리]` PR을 **자체 tsc·test·build만 돌리고 `gh pr merge`로 병합**한다 — 병합 봇·Codex 대기·결정 승인 검사를 거치지 않는 두 번째 병합 경로. | [직접 확인] 코드. 보호 설정(필수 검사) 때문에 실제로 병합에 성공하는지는 **[확인 못 함]** |
| F9 | VPS(자체 러너) 워크플로 8개 중 `korea-fb-research`·`vps-diag`가 대기(queued) 또는 취소만 반복한다. | [직접 확인] 최근 실행 목록. 러너 상태 API는 이 세션 프록시에서 막힘(403) → 러너 꺼짐은 **[추정]** |
| F10 | 등록만 남고 파일이 지워진 워크플로 43개(probe-*, diag-* 등). 실행되지 않으므로 위험은 없고 목록만 지저분하다. | [직접 확인] |

## 2. 개발 관리 장치 분류 (핵심)

분류: **유지** / **수정** / **제거** / **중복 통합**. "실패 사례"는 최근 30회 기준.

| # | 장치 (파일) | 현재 역할 | 실행 상태 | 분류 | 이유·제거 시 영향 | 대체 필요 |
|---|---|---|---|---|---|---|
| G1 | `pr-checks.yml` → 잡 `checks` (필수) | tsc·npm test·build + 정책 검사 30여 단계 한 잡 | 2230회, 최근 ok26/fail4 | **수정** | 치명 검사(타입·시험·빌드·비밀)와 문서 형식 검사가 한 잡에 섞여, 형식 문제로도 필수 검사가 빨개진다. 빼면 모든 안전망이 사라지므로 잡은 유지하고 내용만 나눈다. | 아니요(분리만) |
| G2 | `scripts/check-pr-ready.mjs` | PR 본문 4개 제목·"요청/완료 조건/변경 파일" 줄·후속 과제 #번호·검증 SHA 형식 검사(Draft 제외) | `checks` 안 | **수정(완화)** | 거짓 완료 보고를 막는 목적은 유효. 그러나 본문 형식 누락만으로 필수 검사를 막는다. 완료 판정은 실제 검사 결과로 하고(F4 필수 검사), 본문 형식은 경고로. | 아니요 |
| G3 | `scripts/check-repository-policy.mjs` | STATUS 보호·비밀파일·파괴적 SQL·원문 URL 노출·회귀 시험 동반·**기대값 변경 근거(낱말 2개 겹침)**·**STRICT 경로 무조건 실패** | `checks` 안 | **수정** | 유지할 부분: STATUS·비밀·파괴적 SQL·원문 URL(실제 위험). 고칠 부분: ① `sourceProblems` 낱말 겹침 판정(뜻을 못 읽는 글자 검사 — 스스로 주석에 "의미는 Codex 몫"이라 적음) ② STRICT 경로(`src/*auth*` 등)는 **승인 경로 없이 실패만** 한다 → 정상 변경도 영원히 못 들어감. 고위험 표시로 바꿔 자동 병합에서만 빼야 함. | 고위험 표시(라벨) |
| G4 | `scripts/ci/ai-reader-guard.mjs` (잡 `publication-gate`) | 판독자 입력이 바뀐 PR은 원본 저장소에서 같은 head SHA로 교정 실행(workflow_dispatch) 성공 기록이 있어야 통과 | 1286회, 최근 ok18/**fail12** | **수정** | 키를 PR 코드에 주지 않는 보안 목적은 맞음. 포크 PR마다 원본에 임시 브랜치를 만들어 수동 실행해야 해서 #805 같은 병목. 필수 검사 목록에는 없어(F4) 병합을 기술적으로 막지는 않지만 봇 판정에는 걸린다. | 신뢰된 교정 실행을 자동으로 부르는 방식 검토(S2) |
| G5 | `status-guard.yml` 잡 `guard` (필수) | STATUS.md·status 생성기 보호 | 1448회, ok30 | **유지** | 거짓 보고 방지 핵심(2026-10-11). | — |
| G6 | `app-screen-check.yml` 잡 `app-screen` (필수) | PC·모바일 실제 화면 자동 검사 | 1612회, ok24 | **유지** | 승인 틀 보존 핵심. | — |
| G7 | `pr-checks.yml` 잡 `migration-postgres` | 바뀐 migration을 빈 PostgreSQL에 실제 적용 | `pr-checks` 안 | **유지** | DB 변경 안전망. | — |
| G8 | `bot-pr-automerge.yml` + `scripts/ci/fetch-check-runs.sh`·`required-checks-pass.jq` | 자체 병합 봇(15분마다·이벤트), Codex 대기·결정 승인·데모 적용 판정 후 병합 | **꺼짐**, 4716회 | **중복 통합** | GitHub 기본 자동 병합 + 필수 검사로 대체 가능. 봇 안에만 있는 판정(F5)은 필수 검사로 옮겨야 함 — 그냥 지우면 결정 승인 검사가 사라진다. | 예: G9·G10을 필수 검사로 |
| G9 | `scripts/decision-approval-gate.mjs` | 결정 문서 PR은 Lee 승인(head SHA) 있어야 병합 | 봇 안에서만 | **수정(위치 이동)** | 기능 유지, 봇이 아니라 필수 검사에서 돌게. `LEE-APPROVE` 댓글 인정은 AI가 Lee 계정에 닿을 수 있는 동안 위조 가능(#803 GPT 지적) → GitHub 리뷰 승인만 인정 검토. | 필수 검사 |
| G10 | `scripts/codex-review-gate.mjs` + `codex-wait-timer.yml` + `claude-auto.yml` fallback-review | Codex 12분 대기 → Claude 검토관 20분 → 일반 파일 진행 / 위험 파일은 재요청 | 봇 안에서만, timer 86회 ok15 | **수정** | 새 설계의 "검토 기다리다 없으면 후검토로 진행"이 **이미 이 안에 있다**(12분+20분). 새로 만들 필요 없음. 고칠 점: 봇이 꺼져 쓰이지 않음, Lee 로그인 하드코딩(F7). | 필수 검사로 이동 |
| G11 | `claude-auto.yml` (4개 잡) | ① 수동 작업 ② Codex 지적 자동 대응 ③ 대체 검토관 ④ 이슈 `@claude` 답 | 1763회, 최근 대부분 skipped | **수정** | ②는 Lee 열쇠 `CODEX_TRIGGER_TOKEN`으로 `@codex review`를 단다 — #803 권장안은 이 열쇠 제거. ④는 AI끼리 이슈 대화의 유일한 자동 경로라 유지. | 열쇠 방향은 R3 결정 따름 |
| G12 | `scripts/check-approval-scope.mjs` | CODEOWNERS에 결정 문서만 있는지, 결정 ko/en 짝 | `checks` 안 | **유지** | 14줄, Lee 불필요 승인 방지(결정 0003). | — |
| G13 | `scripts/approved-migrations.mjs` + `.github/approved-migrations.json` | 파괴적 migration 개별 승인 목록 | `checks` 안 | **유지** | 고위험 DB 변경 통로. | — |
| G14 | `rules-core-sync.yml` | CLAUDE.md를 고치면 RULES_CORE.md도 같이 고쳤는지 | 75회, ok22/**fail8** | **중복 통합** | 같은 규칙을 두 문서에 적어서 생긴 검사. 문서 하나로 합치거나 요약을 자동 생성하면 검사 자체가 필요 없다. | 자동 생성 |
| G15 | `merge-provenance.yml` + `scripts/ci/merge-provenance.mjs` | 매일 병합 출처(누가·필수 검사 초록) 기록 | 5회, ok5 | **유지** | R3 회귀 감시. | — |
| G16 | `unmerged-work-alert.yml` | 미병합 PR·master 직접 push 경고(DR4) | 152회, ok30 | **유지** | — | — |
| G17 | `deploy-verify.yml` | master 커밋 배포 READY·운영 화면 검사(DR2·DR3) | 386회, ok29/fail1 | **유지** | 완료 판정 기준. | — |
| G18 | `vercel-deploy.yml` | Vercel API 직접 배포(무료 한도 우회 결정 10-25) | 634회, ok30 | **유지** | — | — |
| G19 | `status-report.yml` | STATUS.md 자동 생성 | 221회, ok30 | **유지** | — | — |
| G20 | `crawl-guard.yml` ⑤ `[자동수리]` 병합 | 수집 수리 PR 자체 검사 후 `gh pr merge` | 101회, ok29 | **수정** | 두 번째 병합 경로(F8). 병합은 한 경로(GitHub 자동 병합)로. | 자동 병합 켜기로 대체 |
| G21 | PR 때 따로 도는 검사 9개: `job-policy-tests`·`r7-source-aware-unit`·`reprocess-queue-ci`·`crawler-cli-tests`·`multi-role-presentation`(817회)·`mobile-home-preview`(fail12/30)·`vn-admin-sync`·`occupation-publication-check`·`map-pin-fit-check`(skip29/30) | 기능별 회귀 시험 | 필수 아님 | **중복 통합 후보** | 필수가 아니라 빨개도 병합은 됨(봇만 봄). 필요한 것은 `checks`로 합치고, 계속 건너뛰는 것(map-pin-fit-check)은 원인 확인. 내용 중복 여부는 **[확인 못 함]** — S2에서 시험 파일 단위로 대조. | S2 |
| G22 | 규칙: 코드 PR마다 `CHATGPT_HANDOFF.md`·`WORK_LOG.md` 갱신 (CLAUDE.md 우선원칙 5) | 인수인계 | 문서 규칙 | **수정** | 병합 충돌 단골. 진행 기록은 이 설계 이슈·PR 본문으로, 두 문서는 라운드 끝에 한 번. | 이슈 기록 |

## 3. 업무용 워크플로 (개발 관리 장치 아님)

수집·위치·공고 처리·화면 증거·운영 SQL 등 45개(2절에 들어간 21개 파일 제외). 이번 개편 대상이 아니라 **유지**가 기본이며, 아래만 표시한다.

| 분류 | 대상 | 근거 |
|---|---|---|
| **제거 후보** (S2에서 참조 확인 후) | `crawl.yml` (꺼짐, 8월 이후 실패) | [직접 확인] 마지막 2026-08-28 failure |
| **수정** (러너 확인) | 자체 러너 8개: `crawl-facebook-one`·`korea-fb-research`·`korea-fb-survey`·`vps-diag`·`crawl-chotot-probe`·`crawl-guard`·`vps-clean-old-runner`·`vps-disk-report` | F9 |
| **점검** (1회용으로 보임) | `p0-foundation`·`admin-operations`(8월 이후 미실행), `local-jobs-privileges-apply`·`occupation-master-apply`(각 1회), `street-center-dryrun`·`job-repair-preview`·`crawl-chotot-probe` | [직접 확인] 실행 횟수. 지워도 되는지는 **[확인 못 함]** |
| 실패 반복 | `jobcard-integrity`(fail12/30), `job-rules-apply`(fail5/14), `administrative-pin-check`(fail13/26), `admin-location-confirm`(fail6/14) | [직접 확인]. 원인 조사는 이번 범위 밖 — 이슈로 분리 |
| 유지 | 나머지 | — |

## 4. 다음 단계(S2)로 넘길 것

1. G8·G9·G10: 봇 안에 있는 판정을 필수 검사로 옮기는 설계 (병합은 GitHub 기본 자동 병합 하나로).
2. G2·G3·G4: 형식 검사 → 경고, STRICT 경로 → 고위험 라벨, 교정 실행 자동화 방안.
3. G21: 9개 PR 검사의 시험 파일 단위 중복 대조.
4. G20: 두 번째 병합 경로 정리.
5. F4 보호 설정 현재값: 관리자 권한이 필요해 Lee 계정 세션 또는 Lee 화면 확인 필요.

## 5. S1 완료 조건과 검증 방법

| 조건 | 검증 |
|---|---|
| 66개 워크플로가 모두 분류에 들어 있다 | 2절 파일 21개 + 3절 45개 = 66 (아래 부록에 전체 목록) |
| 각 판정에 파일 근거가 있다 | 표의 파일·줄 번호 |
| 실행 상태 숫자가 실제와 같다 | 0절 API로 아무 행이나 다시 조회 |
| Codex가 이 PR을 실제로 검토했다 | 이 PR의 `chatgpt-codex-connector[bot]` 리뷰·댓글. 봇 계정 `@codex review`에 반응이 없으면 F6 확정으로 기록하고 원인을 이 PR에 남긴다 |

## 부록 — 66개 워크플로 실행 기록 (최근 30회)

| 파일 | 전체 | 마지막 실행 | 성공 | 실패 | 건너뜀 | 마지막 결과 |
|---|---|---|---|---|---|---|
| admin-line-pick-e2e.yml | 382 | 2026-11-13 | 29 | 1 | 0 | failure |
| admin-location-confirm.yml | 14 | 2026-11-11 | 8 | 6 | 0 | success |
| admin-location-evening-report.yml | 21 | 2026-11-13 | 20 | 1 | 0 | success |
| admin-location-review-e2e.yml | 378 | 2026-11-13 | 29 | 1 | 0 | failure |
| admin-operations.yml | 4 | 2026-08-22 | 4 | 0 | 0 | success |
| administrative-pin-check.yml | 26 | 2026-11-14 | 5 | 13 | 8 | success |
| ai-reader-calibration.yml | 2 | 2026-11-14 | 2 | 0 | 0 | success |
| android-twa-build.yml | 0 | - | 0 | 0 | 0 | - |
| android-upload-key-init.yml | 0 | - | 0 | 0 | 0 | - |
| app-screen-check.yml | 1612 | 2026-11-14 | 24 | 0 | 0 | success |
| auto-location.yml | 13 | 2026-10-18 | 11 | 2 | 0 | success |
| bot-pr-automerge.yml | 4716 | 2026-11-13 | 19 | 0 | 3 | success |
| brand-logo-watch.yml | 0 | - | 0 | 0 | 0 | - |
| brand-logo.yml | 3 | 2026-11-07 | 1 | 2 | 0 | failure |
| business-search-compare.yml | 41 | 2026-11-11 | 30 | 0 | 0 | success |
| claude-auto.yml | 1763 | 2026-11-14 | 4 | 0 | 26 | skipped |
| codex-wait-timer.yml | 86 | 2026-11-12 | 15 | 0 | 0 | success |
| company-code-assign.yml | 4 | 2026-11-06 | 4 | 0 | 0 | success |
| company-reread.yml | 5 | 2026-11-07 | 5 | 0 | 0 | success |
| crawl-chotot-probe.yml | 2 | 2026-11-06 | 1 | 1 | 0 | success |
| crawl-facebook-one.yml | 89 | 2026-11-12 | 26 | 0 | 0 | success |
| crawl-guard.yml | 101 | 2026-11-14 | 29 | 1 | 0 | success |
| crawl.yml | 28 | 2026-08-28 | 18 | 10 | 0 | failure |
| crawler-cli-tests.yml | 190 | 2026-11-14 | 30 | 0 | 0 | success |
| demo-capture.yml | 179 | 2026-11-13 | 29 | 1 | 0 | success |
| deploy-verify.yml | 386 | 2026-11-14 | 29 | 1 | 0 | success |
| desktop-header-proof.yml | 181 | 2026-11-14 | 30 | 0 | 0 | success |
| detail-read.yml | 51 | 2026-11-14 | 23 | 6 | 0 | success |
| dup-count.yml | 4 | 2026-11-07 | 4 | 0 | 0 | success |
| facebook-preview-read.yml | 4 | 2026-11-07 | 4 | 0 | 0 | success |
| fetch-occupation-source.yml | 3 | 2026-10-15 | 1 | 2 | 0 | success |
| job-ocr-check.yml | 1080 | 2026-11-14 | 30 | 0 | 0 | success |
| job-policy-tests.yml | 216 | 2026-11-14 | 30 | 0 | 0 | success |
| job-repair-preview.yml | 1 | 2026-11-01 | 1 | 0 | 0 | success |
| job-rules-apply.yml | 14 | 2026-11-13 | 9 | 5 | 0 | failure |
| jobcard-integrity.yml | 103 | 2026-11-11 | 18 | 12 | 0 | success |
| korea-fb-research.yml | 5 | 2026-11-14 | 0 | 0 | 0 | - |
| korea-fb-survey-read.yml | 1 | 2026-11-11 | 1 | 0 | 0 | success |
| korea-fb-survey.yml | 8 | 2026-11-12 | 5 | 3 | 0 | failure |
| local-jobs-privileges-apply.yml | 1 | 2026-10-13 | 1 | 0 | 0 | success |
| location-ladder-compare.yml | 10 | 2026-11-10 | 10 | 0 | 0 | success |
| map-pin-fit-check.yml | 116 | 2026-11-14 | 1 | 0 | 29 | skipped |
| merge-provenance.yml | 5 | 2026-11-14 | 5 | 0 | 0 | success |
| migrations-apply.yml | 59 | 2026-11-13 | 29 | 1 | 0 | success |
| mobile-home-preview.yml | 150 | 2026-11-13 | 18 | 12 | 0 | success |
| mobile-screens.yml | 22 | 2026-11-14 | 16 | 1 | 2 | success |
| multi-role-presentation.yml | 817 | 2026-11-14 | 30 | 0 | 0 | success |
| occupation-gazette-monthly-check.yml | 3 | 2026-11-01 | 2 | 1 | 0 | success |
| occupation-master-apply.yml | 1 | 2026-10-15 | 1 | 0 | 0 | success |
| occupation-publication-check.yml | 1286 | 2026-11-14 | 18 | 12 | 0 | failure |
| occupation-r8-apply.yml | 3 | 2026-11-02 | 3 | 0 | 0 | success |
| occupation-weekly-unclassified.yml | 5 | 2026-11-09 | 5 | 0 | 0 | success |
| ops-insert-job.yml | 19 | 2026-11-06 | 16 | 3 | 0 | success |
| ops-publish-jobs.yml | 3 | 2026-11-04 | 3 | 0 | 0 | success |
| ops-run-sql.yml | 18 | 2026-11-10 | 14 | 4 | 0 | success |
| p0-foundation.yml | 2 | 2026-08-21 | 1 | 1 | 0 | success |
| pr-checks.yml | 2230 | 2026-11-14 | 26 | 4 | 0 | success |
| r7-source-aware-unit.yml | 27 | 2026-11-14 | 27 | 0 | 0 | success |
| refresh-facebook-existing.yml | 67 | 2026-11-14 | 21 | 8 | 0 | success |
| reprocess-queue-ci.yml | 21 | 2026-11-14 | 21 | 0 | 0 | success |
| rules-core-sync.yml | 75 | 2026-11-13 | 22 | 8 | 0 | success |
| status-guard.yml | 1448 | 2026-11-14 | 30 | 0 | 0 | success |
| status-report.yml | 221 | 2026-11-14 | 30 | 0 | 0 | success |
| street-center-dryrun.yml | 2 | 2026-10-28 | 2 | 0 | 0 | success |
| supabase-keepalive.yml | 39 | 2026-11-14 | 30 | 0 | 0 | success |
| unmerged-work-alert.yml | 152 | 2026-11-14 | 30 | 0 | 0 | success |
| vercel-deploy.yml | 634 | 2026-11-14 | 30 | 0 | 0 | success |
| vn-admin-sync.yml | 6 | 2026-11-10 | 6 | 0 | 0 | success |
| vps-clean-old-runner.yml | 1 | 2026-11-07 | 1 | 0 | 0 | success |
| vps-diag.yml | 5 | 2026-11-14 | 3 | 0 | 0 | - |
| vps-disk-report.yml | 1 | 2026-11-07 | 1 | 0 | 0 | success |
