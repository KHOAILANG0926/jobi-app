# S1 — 기존 자동화·검사 전수 조사 (System Redesign)

- 작성: Claude (viecganban-bot 세션), 2026-11-14
- 기준 커밋: origin/master `1b99e6702cceb2259e0aa75a53eca2a836171569`
- 범위: `.github/workflows/*.yml` 71개, 개발 관리용 검사 스크립트(`scripts/check-*`, `scripts/*-gate.mjs`, `scripts/ci/*`)
- 이 문서는 **조사 기록**이다. 코드·워크플로·권한·보호 설정은 바꾸지 않았다. 이 PR은 병합하지 않는다(Codex 검토 요청용 Draft).
- 표시: **[직접 확인]** = 이번에 명령으로 조회함 / **[기존 기록]** = #728 등 이전 기록, 이번에 다시 조회하지 않음 / **[추정]**

## 0. 조사 방법 (재현 가능)

| 항목 | 방법 |
|---|---|
| 워크플로 트리거·비밀값·호출 스크립트 | 71개 yml을 YAML로 읽어 `on:`·`secrets.*`·`scripts/…` 추출 |
| 실행 상태 | `GET /repos/.../actions/workflows/<파일>/runs?per_page=30` — 전체 횟수, 최근 30회 성공·실패·건너뜀, 마지막 결과 |
| 등록 상태 | `GET /repos/.../actions/workflows` 2쪽 — 등록 114개: 지금 있는 파일을 가리키는 것 71개(파일 71개와 1:1) + 파일이 지워진 옛 등록 43개. active 111 / disabled_manually 3 |
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
| F11 | Lee 계정 열쇠 `CODEX_TRIGGER_TOKEN`이 **지금도 Secrets에 있고 자동으로 쓰인다**. 이 PR에서 claude-auto codex-response(run 43602587543)가 대체 검토 지적을 고쳐 커밋(7f219c7)한 뒤 Lee 계정으로 `@codex review`를 달았다(14:02:50Z, 로그 "Codex 재검토 요청: 7f219c7"). #803 권장안(AI가 닿는 Lee 열쇠 제거)은 아직 적용되지 않았다. 이번 작업은 열쇠를 바꾸지 않았다. | [직접 확인] 실행 기록·로그 |
| F12 | Draft를 해제하자 문서 1개만 바꾼 PR도 필수 `checks`가 실패했다: `check-pr-ready.mjs` "READY FOR APPROVAL만 선택해야 함"(44894b0, 13:40:38Z). | [직접 확인] check-run 주석 |
| F13 | 과거 오류 자동 추적: ① `check-pr-ready.mjs repeatedFiles` — 같은 파일을 14일 안 '고침' PR 3번 이상이면 **경고만**(차단 아님) ② 수집 `crawl-guard` — 같은 원인 3건 연속 실패 시 그 소스 멈춤→자동수리 PR→재개(수집에만) ③ claude-auto — Codex↔Claude 왕복 5번 넘으면 멈추고 needs-lee. **수집 밖 오류를 원인별로 기록·재발 차단하는 공통 장치는 없다**(CLAUDE.md "같은 원인 2회 실패 멈춤"은 문서 규칙). | [직접 확인] `check-pr-ready.mjs:225-228,264-265`, `crawl-guard.yml:3,67`, `claude-auto.yml:97-115` |
| F14 | 자동 검증이 돌지 않는 경로: 운영 DB 열쇠를 쓰는 수동 실행 워크플로 중 `ops-insert-job`·`ops-publish-jobs`·`company-code-assign`·`company-reread`·`job-repair-preview`·`location-ladder-compare` 등은 **실행자·브랜치 제한이 없다**(`ops-run-sql`만 Lee+master 제한, `admin-location-confirm`·`auto-location`은 master 제한). 쓰기 권한 계정(봇 포함)은 PR 검토 없이 실행할 수 있고, 브랜치에서 실행하면 그 브랜치의 워크플로 파일이 쓰인다. 실제로 악용 가능한지는 시험하지 않았다(금지). | [직접 확인] `grep github.actor/github.ref` 결과. 브랜치 실행 시 Secrets 접근은 GitHub 동작 **[기존 지식, 이 저장소에서 미시험]** |

## 2. 개발 관리 장치 분류 (핵심)

분류: **유지** / **수정** / **제거** / **중복 통합**. "실패 사례"는 최근 30회 기준.

| # | 장치 (파일) | 현재 역할 | 실행 상태 | 분류 | 이유·제거 시 영향 | 대체 필요 |
|---|---|---|---|---|---|---|
| G1 | `pr-checks.yml` → 잡 `checks` (필수) | tsc·npm test·build + 정책 검사 30여 단계 한 잡 | 2230회, 최근 ok26/fail4 | **수정** | 치명 검사(타입·시험·빌드·비밀)와 문서 형식 검사가 한 잡에 섞여, 형식 문제로도 필수 검사가 빨개진다. 빼면 모든 안전망이 사라지므로 잡은 유지하고 내용만 나눈다. | 아니요(분리만) |
| G2 | `scripts/check-pr-ready.mjs` | (가) 본문 형식: 4개 제목·요청/완료 조건/변경 파일 줄·후속 과제 #번호·`READY FOR APPROVAL`·검증 SHA (나) 실제 정책 차단: `scopeProblems`(선언 안 한 파일 변경)·`mergeLineProblems`(지운 것/합친 것 보고와 실제 변경 대조)·`exceptionProblems`(근거 없는 공고 번호 예외)·`photoProcessPrProblems`(사진 완료 거짓 주장)·`recordProblems`(최근 같은 파일 PR 확인) (다) 반복 수정 경고(F13). Draft 제외 | `checks` 안, F12 실패 사례 | **수정(나눠서)** | (나)·(다)는 실제 규칙 위반을 막으므로 **유지**. (가) 형식만 완화(경고) 대상 — F12처럼 문서 PR도 형식 하나로 필수 검사가 막힌다. (가)를 내려도 (나)는 F4 타입·시험·빌드로 대체되지 않으니 남겨야 한다(Codex 지적 반영). | 아니요 |
| G3 | `scripts/check-repository-policy.mjs` | STATUS 보호·비밀파일·파괴적 SQL·원문 URL 노출·회귀 시험 동반·**기대값 변경 근거(낱말 2개 겹침)**·**STRICT 경로 무조건 실패** | `checks` 안 | **수정** | 유지할 부분: STATUS·비밀·파괴적 SQL·원문 URL(실제 위험). 고칠 부분: ① `sourceProblems` 낱말 겹침 판정(뜻을 못 읽는 글자 검사 — 스스로 주석에 "의미는 Codex 몫"이라 적음) ② STRICT 경로(`src/*auth*` 등)는 **승인 경로 없이 실패만** 한다 → 정상 변경도 영원히 못 들어감. 고위험 표시로 바꿔 자동 병합에서만 빼야 함. | 고위험 표시(라벨) |
| G4 | `scripts/ci/ai-reader-guard.mjs` (잡 `publication-gate`) | 판독자 입력이 바뀐 PR은 원본 저장소에서 같은 head SHA로 교정 실행(workflow_dispatch) 성공 기록이 있어야 통과 | 1286회, 최근 ok18/**fail12** | **수정** | 키를 PR 코드에 주지 않는 보안 목적은 맞음. 포크 PR마다 원본에 임시 브랜치를 만들어 수동 실행해야 해서 #805 같은 병목. 필수 검사 목록에는 없어(F4) 병합을 기술적으로 막지는 않지만 봇 판정에는 걸린다. | 신뢰된 교정 실행을 자동으로 부르는 방식 검토(S2) |
| G5 | `status-guard.yml` 잡 `guard` (필수) | ① status 브랜치에 봇 아닌 계정이 push하면 실패 ② PR이 STATUS.md를 바꾸면 실패 ③ PR이 `scripts/status/`·`status-*.yml`(검증 장치)을 바꾸면 실패 — 단 PR에 `검증장치-승인` 라벨이 있으면 통과 | 1448회, ok30 | **유지(+수정 1)** | 거짓 보고 방지 핵심(2026-10-11)이라 유지. 수정할 점: ③의 통과 조건이 **라벨**이라 쓰기 권한 계정(봇 포함, F1)이 붙일 수 있다 — 파일 주석도 '누가 붙였는지 구분 못 함'이라 적음(`status-guard.yml:48-50`). Lee가 판단할 수 없는 라벨 승인이기도 하다. G9와 같은 승인 방식으로 정리 대상. | G9와 통합 |
| G6 | `app-screen-check.yml` 잡 `app-screen` (필수) | PC·모바일 실제 화면 자동 검사 | 1612회, ok24 | **유지** | 승인 틀 보존 핵심. | — |
| G7 | `pr-checks.yml` 잡 `migration-postgres` | 바뀐 migration을 빈 PostgreSQL에 실제 적용 | `pr-checks` 안 | **유지** | DB 변경 안전망. | — |
| G8 | `bot-pr-automerge.yml` + `scripts/ci/fetch-check-runs.sh`·`required-checks-pass.jq` | 자체 병합 봇(15분마다·이벤트), Codex 대기·결정 승인·데모 적용 판정 후 병합 | **꺼짐**, 4716회 | **중복 통합** | GitHub 기본 자동 병합 + 필수 검사로 대체 가능. 봇 안에만 있는 판정(F5)은 필수 검사로 옮겨야 함 — 그냥 지우면 결정 승인 검사가 사라진다. | 예: G9·G10을 필수 검사로 |
| G9 | `scripts/decision-approval-gate.mjs` | 세 대상에 Lee 승인(현재 head SHA)이 있어야 봇이 병합: ① 결정 문서·CODEOWNERS — Lee 승인 리뷰 또는 `LEE-APPROVE <sha>`만 ② 승인된 PC 화면 틀(`scripts/test-desktop-baseline.mjs` 파일 목록) ③ `needs-lee` 라벨 PR — ②③은 `LEE-DEMO-APPLY <sha>`도 인정 | 봇 안에서만(`bot-pr-automerge.yml:117`) | **수정(위치 이동)** | 세 대상과 승인 방식 차이를 그대로 보존한 채 봇이 아니라 필수 검사에서 돌게. 화면 틀 보호(CLAUDE.md '승인된 공고 틀 보존')와 직접 연결. `LEE-APPROVE`·`LEE-DEMO-APPLY` 댓글 인정은 AI가 Lee 계정 열쇠에 닿는 동안 위조 가능(#803 GPT 지적, F11) → GitHub 리뷰 승인만 인정 검토. | 필수 검사 |
| G10 | `scripts/codex-review-gate.mjs` + `codex-wait-timer.yml` + `claude-auto.yml` fallback-review | Codex 12분 대기 → Claude 검토관 20분 → 일반 파일 **검토 없이 진행** / 위험 파일은 재요청 | 봇 안에서만, timer 86회 ok15. 대체 검토관은 이 PR에서 실제 작동 확인(run 43602509663, 50초) | **수정** | 있는 것: '시간 초과 시 검토 없이 진행'과 대체 검토관. **없는 것: 병합 후 검토(후검토)** — `codexGate()`는 진행만 허용하고 나중 검토를 예약·추적하지 않으며, fallback-review는 PR이 `open`이 아니면 멈춘다(`claude-auto.yml` 대상 확인). 후검토가 필요하면 S2 신규 항목. 고칠 점: 봇 꺼짐, Lee 로그인 하드코딩(F7). | 필수 검사로 이동 + 후검토는 S2 신규 |
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
| G21 | PR 때 따로 도는 검사 9개: `job-policy-tests`·`r7-source-aware-unit`·`reprocess-queue-ci`·`crawler-cli-tests`·`multi-role-presentation`(817회)·`mobile-home-preview`(fail12/30)·`vn-admin-sync`·`occupation-publication-check`·`map-pin-fit-check`(skip29/30) | 기능별 회귀 시험 | 차단 수준이 셋으로 갈림(아래) | **중복 통합 후보** | 차단 수준: ⓐ 브랜치 보호 필수(`checks`·`guard`·`app-screen`, F4 [기존 기록]) — 9개 중 없음 ⓑ 봇 필수(`scripts/ci/required-checks-pass.jq:4-9`: ⓐ + `publication-gate`) — 9개 중 `occupation-publication-check`의 `publication-gate` 1개 ⓒ 아무것도 막지 않음 — 나머지 8개(빨개도 봇·보호 모두 통과). ⓒ는 필요한 것을 `checks`로 합치고, 계속 건너뛰는 것(map-pin-fit-check)은 원인 확인. 내용 중복 여부는 **[확인 못 함]** — S2에서 시험 파일 단위로 대조. | S2 |
| G22 | 규칙: 코드 PR마다 `CHATGPT_HANDOFF.md`·`WORK_LOG.md` 갱신 (CLAUDE.md 우선원칙 5) | 인수인계 | 문서 규칙 | **수정** | 병합 충돌 단골. 진행 기록은 이 설계 이슈·PR 본문으로, 두 문서는 라운드 끝에 한 번. | 이슈 기록 |

## 3. 업무용 워크플로 (개발 관리 장치 아님)

수집·위치·공고 처리·화면 증거·운영 SQL 등 49개(2절에 들어간 22개 파일 제외). 이번 개편 대상이 아니라 **유지**가 기본이며, 아래만 표시한다.

| 분류 | 대상 | 근거 |
|---|---|---|
| **제거 후보** (S2에서 참조 확인 후) | `crawl.yml` (꺼짐, 8월 이후 실패) | [직접 확인] 마지막 2026-08-28 failure |
| **수정** (러너 확인) | 자체 러너 8개: `crawl-facebook-one`·`korea-fb-research`·`korea-fb-survey`·`vps-diag`·`crawl-chotot-probe`·`vps-clean-old-runner`·`vps-disk-report` (+`crawl-guard`, 2절 G20에서 셈) | F9 |
| **점검** (1회용으로 보임) | `p0-foundation`·`admin-operations`(8월 이후 미실행), `local-jobs-privileges-apply`·`occupation-master-apply`(각 1회), `street-center-dryrun` | [직접 확인] 실행 횟수. 지워도 되는지는 **[확인 못 함]** |
| **실패 반복** (원인 조사 분리) | `jobcard-integrity`(fail12/30), `job-rules-apply`(fail5/14), `administrative-pin-check`(fail13/26), `admin-location-confirm`(fail6/14) | [직접 확인]. 원인 조사는 이번 범위 밖 — 이슈로 분리 |
| **수정** (검증 없는 운영 쓰기, F14) | `ops-insert-job`·`ops-publish-jobs`·`company-code-assign`·`company-reread`·`job-repair-preview`·`location-ladder-compare` — 실행자·브랜치 제한 없음 | F14 |
| **유지** (개발 관리와 연결) | `ai-reader-calibration`(G4의 신뢰된 교정 실행), `migrations-apply`(운영 DB 유일한 적용 경로), `ops-run-sql`(Lee+master 전용, F7) | 코드 |
| **유지** (업무용) | `admin-line-pick-e2e`·`admin-location-evening-report`·`admin-location-review-e2e`·`android-twa-build`·`android-upload-key-init`·`auto-location`·`brand-logo-watch`·`brand-logo`·`business-search-compare`·`demo-capture`·`desktop-header-proof`·`detail-read`·`dup-count`·`facebook-preview-read`·`fetch-occupation-source`·`job-ocr-check`·`korea-fb-survey-read`·`mobile-screens`·`occupation-gazette-monthly-check`·`occupation-r8-apply`·`occupation-weekly-unclassified`·`refresh-facebook-existing`·`supabase-keepalive` | 실행 기록(부록). 공개 판정 흐름(`job-ocr-check`)의 내부 구조는 #728 범위 |

3절 합계: 제거 후보 1 + 러너 7(crawl-guard 제외) + 점검 5 + 실패 반복 4 + 검증 없는 운영 쓰기 6 + 개발 관리 연결 3 + 업무용 23 = 49. 2절 22 + 3절 49 = 71 (6절 대조).

## 4. 다음 단계(S2)로 넘길 것

1. G8·G9·G10: 봇 안에 있는 판정을 필수 검사로 옮기는 설계 (병합은 GitHub 기본 자동 병합 하나로).
2. G2·G3·G4: 형식 검사 → 경고, STRICT 경로 → 고위험 라벨, 교정 실행 자동화 방안.
3. G21: 9개 PR 검사의 시험 파일 단위 중복 대조.
4. G20: 두 번째 병합 경로 정리.
5. F4 보호 설정 현재값: 관리자 권한이 필요해 Lee 계정 세션 또는 Lee 화면 확인 필요.
6. F11 Lee 열쇠 자동 사용, F14 검증 없는 운영 쓰기 경로 — 권한·열쇠 변경이라 설계 승인 뒤 단계에서.
7. F13 수집 밖 반복 오류 공통 기록·재발 차단 장치(현재는 경고만).
8. G10 병합 후 검토(후검토)는 기존 기능에 없음 — 필요 여부 결정.

## 5. S1 완료 조건과 검증 방법

| 조건 | 검증 |
|---|---|
| 71개 워크플로가 모두 분류에 들어 있다 | 2절 파일 22개(G4 `publication-gate` 잡은 `occupation-publication-check.yml`, G21에 포함) + 3절 49개 = 71 (아래 부록 71줄에 전체 목록) |
| 각 판정에 파일 근거가 있다 | 표의 파일·줄 번호 |
| 실행 상태 숫자가 실제와 같다 | 0절 API로 아무 행이나 다시 조회 |
| Codex가 이 PR을 실제로 검토했다 | 이 PR의 `chatgpt-codex-connector[bot]` 리뷰·댓글. 봇 계정 `@codex review`에 반응이 없으면 F6 확정으로 기록하고 원인을 이 PR에 남긴다 |

## 6. 분류 대조 결과 (스크립트로 확인)

- 방법: `.github/workflows/*.yml` 71개 파일 이름을 2절 표와 3절 각 줄에서 찾아 센다(파일 이름 경계 일치).
- 결과 [직접 확인]: 2절 22개, 3절 49개, 2·3절 겹침 0(3절 러너 줄의 `crawl-guard`는 참고 표시일 뿐 49에 안 셈, 2절 G20에서만 셈), 3절 안 중복 0, 누락 0, 부록 71줄 = 파일 71개.

## 부록 — 71개 워크플로 실행 기록 (최근 30회)

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
