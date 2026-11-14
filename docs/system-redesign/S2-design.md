# S2 — JOBI 개발·검증·배포 시스템 개선 설계안

- 작성: Claude (viecganban-bot 세션), 2026-11-14 / 기준 master `1b99e67`
- 근거: S1 조사(#809 최신 `e79e464`, `docs/system-redesign/S1-inventory.md`), #807·#808 S2 실행 지시
- **이 문서는 설계안이다.** 코드·워크플로·권한·토큰·보호 설정·운영 DB를 바꾸지 않았고, 이 PR은 병합하지 않는다. 구현은 설계 승인 뒤 S3~S8에서 한다.
- 표시: [직접 확인] 이번에 조회·실행함 / [기존 기록] / [추정] / **미확인**(확인 경로를 함께 적음)

## 0. 설계 원칙 (S2 지시 + Lee 기존 결정을 함께 만족시키는 방식)

| 요구 | 충돌 | 이 설계의 답 |
|---|---|---|
| "시간이 지나면 검토 없이 병합"은 기본 금지 (#808 S2 지시 3) | Lee 2026-11-11 "Codex가 없다고 멈추지 않게", 2026-11-14 멈춤 시간 최소화 | **검토 없는 병합 경로는 없앤다.** 대신 검토자가 항상 있게 한다: Codex → 없으면 Claude 별도 세션 검토(자동, 이미 작동 확인 — #809에서 6회, 첫 실행 run 43602509663). 검토 결과가 없는 PR만 기다리고 다른 작업은 계속한다. |
| Codex는 승인자가 아니라 의견 (Lee 2026-11-11) | 독립 검증 필수 (#807) | 검토는 **필수 단계**(결과 댓글이 최신 커밋에 있어야 함), 지적 처리는 Claude가 근거를 남겨 판단. "Codex 승인"은 요구하지 않는다. |
| Lee는 판단할 수 없는 승인을 하지 않는다 (결정 0003, Lee 선호) | 고위험 변경 통제 | Lee 승인은 결정 문서·화면 틀·needs-lee(사업 판단)만. 기술 안전은 기계 검사와 독립 검토가 맡는다. |
| 새 장치를 덧붙이지 않는다 (CLAUDE.md 원칙 8) | 우회 경로 차단 | 새 판정 코드를 만들지 않고, 봇 안에만 있던 기존 판정(`codex-review-gate.mjs`·`decision-approval-gate.mjs`)을 **필수 검사 한 잡으로 옮긴다.** 커스텀 병합 봇·두 번째 병합 경로는 지운다. |

## 1. 우회 병합·DB 쓰기·검증 미실행 경로 전체 표

| # | 경로 | 현재 증거 | 차단·통합 위치 | 실패 시 안전 상태 | 기존 기능 영향 | 시험 |
|---|---|---|---|---|---|---|
| P1 | 사람·AI 계정 수동 병합이 결정 승인·검토 판정을 거치지 않음 | F5: 두 판정이 `bot-pr-automerge.yml:117,132`에만 있음 [직접 확인] | 두 판정을 필수 검사 **`merge-gate`** 잡으로 이동(master의 판정 코드로만 실행 — 3절), 브랜치 보호 필수 목록에 추가 | `merge-gate` 실패·미실행 = 병합 버튼 잠김 | 봇 판정과 같은 규칙, 위치만 바뀜 | 결정 문서 PR·needs-lee PR·검토 없는 PR이 `merge-gate` 실패로 막히는지(시험용 Draft PR, 병합 시도 없음) + **판정 코드를 '항상 통과'로 고친 PR이 그 PR에서 통과하지 못하는지**(기준 커밋 사본 실행 확인) + 기존 `*.test.mjs` 유지 |
| P2 | `crawl-guard` ⑤가 `[자동수리]` PR을 자체 검사 후 `gh pr merge` | F8, `crawl-guard.yml:103-108` [직접 확인]. 주석은 "Claude 수리 PR은 자동 검사가 안 돈다"고 하나, 같은 claude-code-action(claude[bot])이 #809에 올린 커밋 7f219c7·6ff8865·9723209에서는 pr-checks·app-screen·guard가 실제로 돌았다 [직접 확인 check-runs] → 주석이 옛 상태일 가능성 [추정] | ① S3에서 `[자동수리]` PR 하나로 필수 검사가 도는지 먼저 확인 ② 돌면 ⑤를 "GitHub 자동 병합 켜기"로 교체 ③ 안 돌면 crawl-guard가 그 PR에 필수 검사를 `workflow_dispatch`로 부른 뒤 자동 병합(병합은 여전히 보호 설정이 결정) | 필수 검사 실패·미실행이면 PR 대기 + 기존 '수집 멈춤' 이슈 알림(영원히 대기하지 않게 6시간 뒤 이슈에 표시 — 기존 재시도 주기) | 수리 병합이 검토 시간만큼 늦어짐 | 시험: "자동수리 PR이 필수 검사를 받고 `merge-gate` 통과 뒤 병합되는지"(Draft로 검사 실행만 확인, 병합 시험은 S3 승인 뒤) |
| P3 | 커스텀 병합 봇 자체(꺼짐) | F2 [직접 확인] | P1 완료 후 제거, GitHub 기본 자동 병합 하나로 | 봇이 없으면 아무것도 자동 병합 안 됨(현재와 같음) | 15분 주기·데모 적용 판정은 `merge-gate`로 이동 | 이동 전후 같은 PR 집합에 같은 판정이 나오는지 비교 실행 |
| P4 | 검토 시간 초과 시 일반 파일 **검토 없이** 진행 | G10, `codex-review-gate.mjs` 12분+20분 [직접 확인] | `merge-gate`에서 '검토 없음 = 실패'로 바꿈. 시간 초과 시 Claude 검토관을 **다시 부르기**만 함(최대 3번, 기존 값) | 3번 실패 → 그 PR만 needs-lee 이슈, 나머지 작업 계속 | Codex가 없어도 Claude 검토관이 있으면 기존처럼 진행. **기존 Lee 규칙(2026-11-11 '멈추지 않게')을 바꾸는 부분이라 7절 결정 7** — 문서 수정은 S3에 포함 | Codex 한도 초과 PR에서 Claude 검토 결과 없이는 `merge-gate`가 실패하는지 |
| P5 | `LEE-APPROVE`·`LEE-DEMO-APPLY` 댓글, `검증장치-승인` 라벨을 AI가 만들 수 있음 | G5·G9, F11(Lee 열쇠 자동 사용 3회) [직접 확인] | Lee 열쇠 제거(2절) 뒤에는 Lee 계정 댓글 = Lee 본인. 라벨 승인은 폐지하고 결정 문서와 같은 Lee 리뷰·댓글로 | 승인 확인 실패 = 병합 잠김 | **데모 "적용" 흐름이 바뀐다**: 지금은 작업자가 Lee 계정으로 `LEE-DEMO-APPLY`를 대신 달 수 있었지만(CLAUDE.md AI 팀 절, `bot-pr-automerge.yml:129`는 Lee 로그인 댓글만 인정), 열쇠를 지우면 작업자는 달 수 없다 → 7절 Lee 결정 항목 6으로 올림. CLAUDE.md·RULES_CORE 문구 수정은 S3 작업에 포함 | Lee 아닌 계정이 단 `LEE-APPROVE`가 무시되는지(기존 시험 확장) |
| P6 | 운영 DB 쓰기 수동 실행 6개가 실행자·브랜치 제한 없음 | F14 [직접 확인 grep] | 각 잡에 `if: github.ref == 'refs/heads/master'` + DB 비밀값을 **GitHub Environment `production`**(master만 허용)으로 이동 | 브랜치에서 실행 = 비밀값 없음 → 실패(쓰기 안 됨) | master에서 실행하던 기존 사용법은 그대로 | 브랜치에서 실행 시 비밀값이 비어 실패하는지(쓰기 없는 점검 모드) |
| P7 | 옛 작업 브랜치 push가 DB 비밀값으로 실행: `admin-operations`(`codex/admin-operations`)·`p0-foundation`(`codex/p0-foundation-security`) | [직접 확인] yml `push.branches` + `SUPABASE_SERVICE_ROLE_KEY` | 1회용이면 제거, 필요하면 master 전용 + Environment | 위와 같음 | 8월 이후 실행 없음 — 영향 없음 [직접 확인 실행 기록] | 제거 전 참조 grep |
| P8 | `vercel-deploy`가 `demo/**` 브랜치 push에서 `SUPABASE_DB_URL`·`VERCEL_TOKEN`으로 실행(브랜치의 워크플로 파일이 쓰임) | [직접 확인] | demo 실행 잡에서 DB 비밀값 제거(필요하면 읽기 전용 열쇠), 배포 열쇠는 Preview 전용 범위 | 데모 빌드만 실패, 운영 영향 없음 | 데모 링크 흐름 유지 확인 필요 | demo 브랜치 빌드가 DB 열쇠 없이 되는지 |
| P9 | 같은 저장소 PR·브랜치가 **새 워크플로 파일**을 추가하면 저장소 비밀값으로 실행될 수 있음 | 저장소 공개, 봇 push 권한(F1). GitHub 동작 [기존 지식, 이 저장소에서 미시험 — 시험 금지] | DB·배포·외부 API 비밀값을 모두 Environment로 옮기고 master만 허용 → 저장소 기본 비밀값에는 GITHUB_TOKEN과 무해한 값만 | 브랜치 워크플로는 비밀값 없이 실패 | 모든 비밀값 사용 워크플로에 `environment:` 줄 추가 필요(S4 목록: 71개 표의 S4 표시). 단 AI 판독 교정(ANTHROPIC_API_KEY)은 PR head 증거가 필요해 표 7번 방식으로 먼저 정한 뒤 이동 | 비밀값 이동 뒤 master 실행 정상, 브랜치 실행 실패 확인 |
| P10 | Lee 로그인 하드코딩(인정 계정 목록) | F7 [직접 확인] | Lee 열쇠 제거 뒤에도 '진짜 Lee 판단' 표시로 쓰므로 유지. 단 `REPLY_AUTHORS`(Claude 답 인정)에서는 Lee 계정 제거 → 봇 계정 | — | Claude 답 표시를 봇 계정이 다는 것으로 바뀜 | `codex-review-gate.test.mjs` 사례 갱신 |
| P11 | 필수가 아닌 PR 검사 8개는 빨개도 아무것도 안 막음 | G21 [직접 확인 `required-checks-pass.jq`] | S7에서 시험 파일 단위로 대조 후 `checks`로 합치거나 필수화 | 합치기 전까지 현재와 같음 | — | 대조 표 |
| P12 | 브랜치 보호 실제 값·master 직접 push 가능 여부 | **미확인**(F4, 봇은 관리자 아님) | S3 시작 전 Lee 계정 세션 또는 Lee 화면으로 값 조회 → 이 문서 갱신 | 확인 전 S3 보호 설정 변경 금지 | — | 조회 결과를 #808에 기록 |
| P13 | VPS 자체 러너 상태 | **미확인**(F9, API 403) | VPS에서 러너 상태 명령 실행 결과(기존 `vps-diag`)로 확인 — 지금은 대기 중 | 러너 꺼짐이면 해당 8개는 실행 안 됨(쓰기 없음) | — | vps-diag 결과 |

## 2. Lee 개인 자격증명 의존 제거 + Codex 교차 검증 경로

**지금 Lee 열쇠가 쓰이는 곳** [직접 확인]: `CODEX_TRIGGER_TOKEN` — claude-auto codex-response가 ① PR 본문 수정 ② `@codex review` 요청(Codex는 Lee 계정 요청에만 반응). 이번 S1에서 자동으로 3회 사용(F11).

**제거 순서** (S3 첫 작업, Lee 조작 1회): ① claude-auto에서 이 열쇠를 쓰는 두 단계를 지우는 PR(봇 계정 열쇠로 본문 수정) → ② 병합 뒤 Lee가 GitHub 설정에서 `CODEX_TRIGGER_TOKEN` 삭제·폐기. 순서를 바꾸면 ①이 실패만 하고 기능 손실은 없다(열쇠 없으면 건너뛰는 처리가 이미 있음 — `claude-auto.yml:202`).

**Codex 교차 검증을 쓸 수 있는 경로**

| 경로 | 권한 | 비용 | 자동화 | 판단 |
|---|---|---|---|---|
| A. Lee 열쇠로 자동 요청(현재) | Lee 계정 | 없음 | 자동 | **쓰지 않음** — AI가 Lee 신원을 쓰는 구조(S2 지시 2) |
| B. 봇 계정에 Codex 연결 | 봇의 ChatGPT 계정 | 유료 요금제 필요 가능 **[미확인]** | 자동 | 기본 전제로 삼지 않음(S2 지시 2). 필요하면 Lee 비용 결정 |
| C. Lee가 원할 때 직접 `@codex review` | Lee 본인 | 없음 | 수동(선택) | **선택 사항으로 유지** — 필수 대기 조건 아님 |
| D. Gemini Code Assist for GitHub(Google 공식 PR 검토 앱) | 앱 설치 1회(Lee 조작) | Google 문서: 공개·비공개 저장소 무료 검토, 개인용 한도 하루 PR 33개 [직접 확인: 웹 검색 — Google 블로그·developers.google.com 문서]. 단 GitHub 앱 페이지는 'Google Cloud 고객용'으로 표기 → 개인 Gmail 설치 경로 **미확인** | 자동(PR 열릴 때) + `/gemini review` 댓글은 PR 참여자 누구나 가능(문서) → 봇 계정이 다시 부를 수 있음 | **다른 회사 AI 교차 검토의 1순위 후보** — S3 전 설치 경로 확인. 대안: Gemini CLI GitHub Actions(AI Studio 무료 한도, 열쇠 1개 필요) |
| E. Claude 별도 세션 검토(현재 작동) | 구독 열쇠 `CLAUDE_CODE_OAUTH_TOKEN` | 추가 요금 없음 [기존 기록] | 자동 | **필수 검토자의 기본값**. 한계: 같은 회사 모델 |

필수 검토 규칙: 최신 커밋에 E 또는 D(또는 C) 결과가 하나 이상 있고, 지적마다 Claude 답(`<!-- claude-codex-reply -->`, 봇 계정)이 있어야 `merge-gate` 통과. 고위험 파일(`needsSecondReview` 목록)은 **D 또는 C가 가능해지면** 두 회사 검토를 요구할지 S3에서 결정(D 확인 결과에 따라).

## 3. 검증 전 병합 차단 — 병합 경로 하나

```
PR(봇 계정, Draft로 시작) → 필수 검사 checks·guard·app-screen(+publication-gate 결정) 
→ Draft 해제(작업자) → merge-gate: ① Draft 아님 ② 최신 head 커밋에 독립 검토 결과 ③ 지적마다 답 
   ④ 결정 문서·화면 틀·needs-lee면 Lee 승인 ⑤ 파괴적 migration이면 승인 목록 
→ GitHub 자동 병합(보호 설정이 필수 검사 전부 초록일 때만 병합) → deploy-verify
```
- Draft PR은 `merge-gate`가 항상 실패 → 자동 병합 불가.
- 새 커밋이 오면 검토 결과는 무효(최신 head 기준, 기존 `codexGate` 방식).
- 병합하는 주체는 GitHub뿐. 봇 병합·`crawl-guard` 병합·사람 수동 병합 모두 같은 필수 검사를 통과해야 한다(보호 설정 enforce_admins 유지 — 값 확인 P12).
- **판정 코드는 PR이 바꿀 수 없게 master 것으로만 돈다**(검토관 지적 반영): 지금 봇 판정은 master 파일로 돌아 PR이 못 바꾼다(`workflow_run`·`schedule`·`issue_comment`은 기본 브랜치 파일 사용). `merge-gate`도 같아야 한다 → ① 워크플로는 `pull_request_target`(워크플로 파일을 기준 브랜치에서 읽음)으로 두고 **PR 코드는 체크아웃·실행하지 않는다**(PR 정보는 API로만 읽음) ② 판정 스크립트는 기준(base) 커밋 사본으로 실행 — 스크립트를 기준 사본으로 돌리는 방식은 이미 있다: `occupation-publication-check.yml:51-52`(S1 G4). 단 그 워크플로는 `pull_request`라 워크플로 파일 자체는 PR 것이 쓰인다 — `merge-gate`는 ①로 이 빈틈까지 막는다 ③ 그래서 판정 코드를 바꾸는 PR은 **자기 판정에 영향을 못 준다**(병합된 뒤부터 적용).
- 판정 코드·워크플로·보호 설정 관련 파일(`.github/workflows/`·`scripts/codex-review-gate.mjs`·`scripts/decision-approval-gate.mjs`·`scripts/check-*.mjs`·`scripts/ci/`)을 바꾸는 PR은 **고위험(검사 약화 가능)**: 두 회사 검토(2절 D 또는 C + E) + Lee에게 "검사를 약하게 하는 변경인가" 한국어 결정 요약(#807 '검사 약화는 대표님에게만 물을 사항'). 기존 `needsSecondReview` 목록(`check-repository-policy.mjs`)을 이 판정의 대상 목록으로 재사용.
- **플랫폼 한계**: GitHub 자동 병합 켜기와 보호 필수 목록 변경은 저장소 관리자(Lee) 조작이다.

## 4. AI 자율 순환 — 단계별 "누가 실제로 실행시키나"

| 단계 | 실행을 시키는 것 | 권한·비용 | 실패 시 | 자동화 못 하는 부분 |
|---|---|---|---|---|
| ① 지시 접수 | GitHub 이슈에 `ai-task` 라벨 + 지시 본문(Lee 또는 GPT가 작성) → **이슈 이벤트로 claude-auto 실행**(현재 issue-mention은 읽기 전용 → 작업 잡으로 확장) | 구독 열쇠, 추가 요금 없음 [기존 기록] / 라벨 붙일 수 있는 계정만 | 실행 실패 = 이슈에 오류 한 줄, 다음 예약 실행 때 재시도 | 이 claude.ai 대화창은 GitHub가 부를 수 없다 — 대화창 작업은 계속 Lee가 연다 |
| ② 과거 기록 탐색 | 작업 세션이 시작 때 같은 파일의 최근 PR·이슈·실패 기록을 자동 조회(기존 `check-pr-ready` `recentPrsFor`·`recordProblems` 재사용) | 읽기만 | 조회 실패 = 필수 검사 실패(기존 동작) | 의미 판단은 AI 몫 |
| ③ 재현·원인·공통 수정·회귀 시험 | 작업 세션 | — | 같은 원인 2번 실패 → 멈추고 방법 변경안 댓글(CLAUDE.md 규칙을 `merge-gate`가 셀 수 있게 PR 기록으로) | 새 언어·OCR 오류를 시험이 모두 잡지는 못함 |
| ④ 독립 검토 | `merge-gate`가 검토 결과 없으면 Claude 검토관 호출(기존 fallback-review), D 도입 시 자동 | 위 2절 | 3번 실패 → needs-lee | — |
| ⑤ 병합·배포 | GitHub 자동 병합 → `deploy-verify` | — | 배포 검사 실패 → 기존 '운영 배포 검증 실패' 이슈, 다음 일반 병합 잠금(S6) | 되돌리기는 Lee 승인(기존 DR6) |
| ⑥ 중단·인계·재개 | 진행 상태 = PR 본문 「완료/남은 작업/다음 할 일」 + #808 진행표. 예약 실행(밤 근무, 현재 꺼짐)이 `ai-task` 열린 이슈를 다시 집음 | 구독 한도 | 한도 소진 = 다음 예약 때 이어서, 이슈에 한 줄 | 구독 남은 한도는 밖에서 못 봄 [추정] |
| ⑦ 오류 기록 누적 | 수집 밖 공통 기록 **없음**(F13) → 별도 표를 새로 만들지 않고 GitHub 이슈 라벨 `regression` + PR 본문 「원인·재현 시험」 칸으로 연결, `check-pr-ready`가 '고침' PR에 그 칸을 요구 | — | 칸 누락 = 필수 검사 실패 | — |

## 5. 71개 워크플로 1:1 계획 (S1 분류와 대응)

| # | 파일 | S1 분류 | S2 계획 | 단계 |
|---|---|---|---|---|
| 1 | `admin-line-pick-e2e.yml` | 업무용 유지 | 그대로. DB 비밀값을 쓰는 수동 실행분은 S4 실행 환경 점검 대상에 포함 | S4 점검 |
| 2 | `admin-location-confirm.yml` | 실패 반복 | 원인 조사를 별도 이슈로(ai-team) | S7 |
| 3 | `admin-location-evening-report.yml` | 업무용 유지 | 그대로. DB 비밀값을 쓰는 수동 실행분은 S4 실행 환경 점검 대상에 포함 | S4 점검 |
| 4 | `admin-location-review-e2e.yml` | 업무용 유지 | 그대로. DB 비밀값을 쓰는 수동 실행분은 S4 실행 환경 점검 대상에 포함 | S4 점검 |
| 5 | `admin-operations.yml` | 점검+차단 | 옛 작업 브랜치 push에서 DB 비밀값으로 실행됨(P7) → master 전용으로 바꾸거나 제거 | S4 |
| 6 | `administrative-pin-check.yml` | 실패 반복 | 원인 조사를 별도 이슈로(ai-team) | S7 |
| 7 | `ai-reader-calibration.yml` | 점검+수정 | 지금은 PR 브랜치에서 workflow_dispatch로 돌고 `ai-reader-guard.mjs`가 PR head SHA의 성공 실행만 인정함 → ANTHROPIC_API_KEY를 master 전용 Environment로 옮기면 교정 증거를 못 만듦. S4에서 함께 정함: 브랜치 실행에만 쓰는 별도 한도·교정 전용 열쇠(Environment, 승인 필요) 또는 master 실행이 PR head를 받아 교정하고 head SHA를 결과에 남기도록 가드 수정(PR 코드에 운영 열쇠를 주지 않음). 정해지기 전에는 이 열쇠를 이동하지 않음 | S4 |
| 8 | `android-twa-build.yml` | 업무용 유지 | 그대로. DB 비밀값을 쓰는 수동 실행분은 S4 실행 환경 점검 대상에 포함 | S4 점검 |
| 9 | `android-upload-key-init.yml` | 업무용 유지 | 그대로. DB 비밀값을 쓰는 수동 실행분은 S4 실행 환경 점검 대상에 포함 | S4 점검 |
| 10 | `app-screen-check.yml` | G6 유지 | 그대로(필수) | — |
| 11 | `auto-location.yml` | 업무용 유지 | 그대로. DB 비밀값을 쓰는 수동 실행분은 S4 실행 환경 점검 대상에 포함 | S4 점검 |
| 12 | `bot-pr-automerge.yml` | G8 중복 통합 | 판정(G9·G10·데모 적용)을 필수 검사 `merge-gate`로 옮긴 뒤 이 봇 제거. 병합은 GitHub 자동 병합 | S3(이전)→S3 끝(제거) |
| 13 | `brand-logo-watch.yml` | 업무용 유지 | 그대로. DB 비밀값을 쓰는 수동 실행분은 S4 실행 환경 점검 대상에 포함 | S4 점검 |
| 14 | `brand-logo.yml` | 업무용 유지 | 그대로. DB 비밀값을 쓰는 수동 실행분은 S4 실행 환경 점검 대상에 포함 | S4 점검 |
| 15 | `business-search-compare.yml` | 업무용 유지 | 그대로. DB 비밀값을 쓰는 수동 실행분은 S4 실행 환경 점검 대상에 포함 | S4 점검 |
| 16 | `claude-auto.yml` | G11 수정 | CODEX_TRIGGER_TOKEN 단계 제거(S3 첫 작업). fallback-review는 `merge-gate`가 부르는 필수 검토자로. issue 지시 실행 잡 추가 검토(4절) | S3·S5 |
| 17 | `codex-wait-timer.yml` | G10 수정 | `merge-gate` 재평가 깨우기로만 사용, 봇 제거 때 함께 정리 | S3 |
| 18 | `company-code-assign.yml` | F14 차단 | 운영 DB 쓰기 → master 전용 + 보호된 실행 환경(P6) | S4 |
| 19 | `company-reread.yml` | F14 차단 | 운영 DB 쓰기 → master 전용 + 보호된 실행 환경(P6) | S4 |
| 20 | `crawl-chotot-probe.yml` | 러너 확인 | VPS 러너 상태 확인 후 유지/정리(미확인 F9) | S6 |
| 21 | `crawl-facebook-one.yml` | 러너 확인 | VPS 러너 상태 확인 후 유지/정리(미확인 F9) | S6 |
| 22 | `crawl-guard.yml` | G20 수정 | ⑤ 직접 `gh pr merge` 제거 → 자동수리 PR도 `merge-gate`+자동 병합으로 | S3 |
| 23 | `crawl.yml` | 제거 후보 | 참조 확인 후 제거(꺼짐, 8월 이후 실패) | S7 |
| 24 | `crawler-cli-tests.yml` | G21 중복 통합 후보 | 시험 파일 단위 대조 후 필요한 것은 `checks`로 합치거나 필수화. 합치기 전까지 그대로 | S7 |
| 25 | `demo-capture.yml` | 업무용 유지 | 그대로. DB 비밀값을 쓰는 수동 실행분은 S4 실행 환경 점검 대상에 포함 | S4 점검 |
| 26 | `deploy-verify.yml` | G17 유지 | 그대로 | — |
| 27 | `desktop-header-proof.yml` | 업무용 유지 | 그대로. DB 비밀값을 쓰는 수동 실행분은 S4 실행 환경 점검 대상에 포함 | S4 점검 |
| 28 | `detail-read.yml` | 업무용 유지 | 그대로. DB 비밀값을 쓰는 수동 실행분은 S4 실행 환경 점검 대상에 포함 | S4 점검 |
| 29 | `dup-count.yml` | 업무용 유지 | 그대로. DB 비밀값을 쓰는 수동 실행분은 S4 실행 환경 점검 대상에 포함 | S4 점검 |
| 30 | `facebook-preview-read.yml` | 업무용 유지 | 그대로. DB 비밀값을 쓰는 수동 실행분은 S4 실행 환경 점검 대상에 포함 | S4 점검 |
| 31 | `fetch-occupation-source.yml` | 업무용 유지 | 그대로. DB 비밀값을 쓰는 수동 실행분은 S4 실행 환경 점검 대상에 포함 | S4 점검 |
| 32 | `job-ocr-check.yml` | 업무용 유지 | 그대로. DB 비밀값을 쓰는 수동 실행분은 S4 실행 환경 점검 대상에 포함 | S4 점검 |
| 33 | `job-policy-tests.yml` | G21 중복 통합 후보 | 시험 파일 단위 대조 후 필요한 것은 `checks`로 합치거나 필수화. 합치기 전까지 그대로 | S7 |
| 34 | `job-repair-preview.yml` | F14 차단 | 운영 DB 쓰기 → master 전용 + 보호된 실행 환경(P6) | S4 |
| 35 | `job-rules-apply.yml` | 실패 반복 | 원인 조사를 별도 이슈로(ai-team) | S7 |
| 36 | `jobcard-integrity.yml` | 실패 반복 | 원인 조사를 별도 이슈로(ai-team) | S7 |
| 37 | `korea-fb-research.yml` | 러너 확인 | VPS 러너 상태 확인 후 유지/정리(미확인 F9) | S6 |
| 38 | `korea-fb-survey-read.yml` | 업무용 유지 | 그대로. DB 비밀값을 쓰는 수동 실행분은 S4 실행 환경 점검 대상에 포함 | S4 점검 |
| 39 | `korea-fb-survey.yml` | 러너 확인 | VPS 러너 상태 확인 후 유지/정리(미확인 F9) | S6 |
| 40 | `local-jobs-privileges-apply.yml` | 점검 | 1회용 여부 참조 확인 후 제거 또는 유지 | S7 |
| 41 | `location-ladder-compare.yml` | F14 차단 | 운영 DB 쓰기 → master 전용 + 보호된 실행 환경(P6) | S4 |
| 42 | `map-pin-fit-check.yml` | G21 점검 | 계속 건너뛰는 원인 확인 → 고치거나 제거 | S7 |
| 43 | `merge-provenance.yml` | G15 유지 | 그대로 + `merge-gate` 통과 기록 대조 항목 추가 | S6 |
| 44 | `migrations-apply.yml` | 유지 | 그대로(ops-run-sql의 Lee 로그인 고정은 P10 정리 때) | S4 |
| 45 | `mobile-home-preview.yml` | G21 중복 통합 후보 | 시험 파일 단위 대조 후 필요한 것은 `checks`로 합치거나 필수화. 합치기 전까지 그대로 | S7 |
| 46 | `mobile-screens.yml` | 업무용 유지 | 그대로. DB 비밀값을 쓰는 수동 실행분은 S4 실행 환경 점검 대상에 포함 | S4 점검 |
| 47 | `multi-role-presentation.yml` | G21 중복 통합 후보 | 시험 파일 단위 대조 후 필요한 것은 `checks`로 합치거나 필수화. 합치기 전까지 그대로 | S7 |
| 48 | `occupation-gazette-monthly-check.yml` | 업무용 유지 | 그대로. DB 비밀값을 쓰는 수동 실행분은 S4 실행 환경 점검 대상에 포함 | S4 점검 |
| 49 | `occupation-master-apply.yml` | 점검 | 1회용 여부 참조 확인 후 제거 또는 유지 | S7 |
| 50 | `occupation-publication-check.yml` | G21/G4 수정 | `publication-gate`를 보호 필수로 올릴지 결정, ai-reader-guard 교정 실행 자동 호출 | S3 |
| 51 | `occupation-r8-apply.yml` | 업무용 유지 | 그대로. DB 비밀값을 쓰는 수동 실행분은 S4 실행 환경 점검 대상에 포함 | S4 점검 |
| 52 | `occupation-weekly-unclassified.yml` | 업무용 유지 | 그대로. DB 비밀값을 쓰는 수동 실행분은 S4 실행 환경 점검 대상에 포함 | S4 점검 |
| 53 | `ops-insert-job.yml` | F14 차단 | 운영 DB 쓰기 → master 전용 + 보호된 실행 환경(P6) | S4 |
| 54 | `ops-publish-jobs.yml` | F14 차단 | 운영 DB 쓰기 → master 전용 + 보호된 실행 환경(P6) | S4 |
| 55 | `ops-run-sql.yml` | 유지 | 그대로(ops-run-sql의 Lee 로그인 고정은 P10 정리 때) | S4 |
| 56 | `p0-foundation.yml` | 점검+차단 | 옛 작업 브랜치 push에서 DB 비밀값으로 실행됨(P7) → master 전용으로 바꾸거나 제거 | S4 |
| 57 | `pr-checks.yml` | G1 수정 | `checks` 유지. 형식 검사(G2 가)를 경고 단계로 분리, 나머지 그대로 | S3 |
| 58 | `r7-source-aware-unit.yml` | G21 중복 통합 후보 | 시험 파일 단위 대조 후 필요한 것은 `checks`로 합치거나 필수화. 합치기 전까지 그대로 | S7 |
| 59 | `refresh-facebook-existing.yml` | 업무용 유지 | 그대로. DB 비밀값을 쓰는 수동 실행분은 S4 실행 환경 점검 대상에 포함 | S4 점검 |
| 60 | `reprocess-queue-ci.yml` | G21 중복 통합 후보 | 시험 파일 단위 대조 후 필요한 것은 `checks`로 합치거나 필수화. 합치기 전까지 그대로 | S7 |
| 61 | `rules-core-sync.yml` | G14 중복 통합 | RULES_CORE를 CLAUDE.md에서 자동 생성 → 이 검사 제거 | S7 |
| 62 | `status-guard.yml` | G5 유지+수정 | 라벨 통과(`검증장치-승인`)를 병합 관문의 승인 방식(G9)으로 교체 | S3 |
| 63 | `status-report.yml` | G19 유지 | 그대로 | — |
| 64 | `street-center-dryrun.yml` | 점검 | 1회용 여부 참조 확인 후 제거 또는 유지 | S7 |
| 65 | `supabase-keepalive.yml` | 업무용 유지 | 그대로. DB 비밀값을 쓰는 수동 실행분은 S4 실행 환경 점검 대상에 포함 | S4 점검 |
| 66 | `unmerged-work-alert.yml` | G16 유지 | 그대로 | — |
| 67 | `vercel-deploy.yml` | G18 유지+수정 | demo/** 브랜치 실행에서 DB 비밀값 접근 차단(P8) | S4 |
| 68 | `vn-admin-sync.yml` | G21 중복 통합 후보 | 시험 파일 단위 대조 후 필요한 것은 `checks`로 합치거나 필수화. 합치기 전까지 그대로 | S7 |
| 69 | `vps-clean-old-runner.yml` | 러너 확인 | VPS 러너 상태 확인 후 유지/정리(미확인 F9) | S6 |
| 70 | `vps-diag.yml` | 러너 확인 | VPS 러너 상태 확인 후 유지/정리(미확인 F9) | S6 |
| 71 | `vps-disk-report.yml` | 러너 확인 | VPS 러너 상태 확인 후 유지/정리(미확인 F9) | S6 |

## 6. 실행 순서 S3~S8 — 각 단계 완료 기준·되돌리기

| 단계 | 내용 | 완료 기준(실제 실행 증거) | 되돌리기 | Lee 조작 |
|---|---|---|---|---|
| S3 | (7절 결정 6·7 반영) Lee 열쇠 제거(2절) → `merge-gate` 필수 검사 추가(P1·P4·P5) + CLAUDE.md·RULES_CORE·AGENTS.md 규칙 문구 수정 → crawl-guard 병합 교체(P2) → 병합 봇 제거(P3) | 시험 Draft PR 4종(일반·결정 문서·검토 없음·Draft)에서 `merge-gate` 결과가 표대로 / 열쇠 삭제 뒤 codex-response가 열쇠 없이 정상 종료 | `merge-gate`를 보호 필수에서 빼면 이전 상태(봇은 이미 꺼짐) | 보호 필수 목록에 `merge-gate` 추가, 자동 병합 켜기, 열쇠 삭제, (D 설치 여부 결정) |
| S4 | 비밀값을 Environment `production`으로 이동(P6~P9), 운영 쓰기 6개 master 전용 | master 실행 정상 + 브랜치 실행이 비밀값 없이 실패(쓰기 없는 점검 모드) | 비밀값을 저장소 기본으로 되돌림 | Environment 만들기·비밀값 옮기기 |
| S5 | 이슈 지시 → Claude 작업 자동 실행(4절 ①), 밤 근무 재개 | Lee가 이슈에 지시 1건 → 사람 전달 없이 Draft PR까지 생성된 실행 기록 | 잡 끄기 | 없음 |
| S6 | 배포 실패 시 일반 병합 잠금, 러너 상태 확인(P13), merge-provenance에 `merge-gate` 대조 | 배포 실패 모의(Preview)에서 잠금 동작 기록 | 잠금 해제 | 없음 |
| S7 | G21 시험 통합, 1회용·꺼진 워크플로 정리, RULES_CORE 자동 생성, 반복 오류 기록(4절 ⑦) | 71개 표 각 줄 처리 결과 기록, 제거 전 참조 grep 0 | git 되돌리기 | 없음 |
| S8 | 전체 흐름 통합 검증 | 실제 개발 작업 1건이 지시→PR→검토→병합→배포→운영 확인까지 사람 전달 없이 끝난 기록 | — | 지시 1건 |

## 7. Lee만 할 수 있는 조작 (플랫폼 고유, 우회하지 않음)

1. 브랜치 보호 현재값 확인(P12) — S3 전.
2. `CODEX_TRIGGER_TOKEN` 삭제·폐기 — S3 ① PR 병합 뒤.
3. 보호 필수 목록에 `merge-gate` 추가, 저장소 자동 병합 켜기 — S3.
4. (선택) Gemini Code Assist GitHub 앱 설치 — 개인 설치 경로 확인 뒤 결정.
5. Environment `production` 만들기·비밀값 옮기기 — S4.
6. **데모 "적용" 방식 결정**(P5): 열쇠를 지우면 Lee가 채팅에서 "적용"이라고 해도 AI가 GitHub에 Lee 이름으로 표시할 수 없다. 선택지 ① Lee가 휴대폰 GitHub 앱에서 그 PR의 승인 버튼 1번 ② 봇이 "Lee 채팅 적용" 기록 댓글을 달고 화면 틀 PR도 그것으로 인정(AI가 대신 승인하는 구조라 위조 위험을 받아들이는 것). S3 전에 Lee가 고른다.
7. **검토가 끝내 없을 때 멈출지**(P4): 지금 규칙(CLAUDE.md AI 팀 절, Lee 2026-11-11)은 검토관이 20분 안에 없으면 일반 파일은 기존 검사만으로 진행한다. S2 지시(#808)는 '검토 없는 병합 기본 금지'다. 선택지 ① 그 PR만 기다리고 needs-lee(다른 작업은 계속) — Claude 검토관이 3번 연속 실패할 때만 해당하므로 실제로 멈추는 경우는 드물다 [추정, #809·#810에서 검토관 실패 0회] ② 지금처럼 일반 파일은 진행. 이 설계는 ①을 기본으로 그렸고, Lee가 고른 쪽으로 S3에서 CLAUDE.md·.claude/RULES_CORE.md·AGENTS.md 문구를 함께 고친다.

## 8. 미확인 항목과 확인 경로

| 항목 | 확인 경로 |
|---|---|
| 브랜치 보호 실제 값(P12) | Lee 계정 세션 `gh api repos/.../branches/master/protection` 또는 Lee 화면 |
| VPS 러너 상태(P13) | `vps-diag` 결과(현재 대기 중) |
| 새 워크플로 PR의 비밀값 접근(P9) | 시험 금지 — 비밀값 이동(S4)으로 위험 자체를 없앤 뒤 확인 |
| Gemini 검토 앱 개인 설치 경로(D) | 앱 페이지 'Google Cloud 고객용' 표기와 문서의 개인용 무료 안내가 다름 → 실제 설치 화면으로 확인 |
| 봇 계정 Codex 연결 비용(B) | 필요할 때만 확인 |
| 구독 한도 외부 조회 가능 여부 | S5에서 확인 |
