# S4 병합 조건 검사 — 대표님 GitHub 설정과 되돌리는 법 (2026-11-15, #808·#833)

코드는 GitHub 설정을 바꾸지 않는다. 아래는 대표님이 직접 켜는 항목이다. 순서를 지킬 것.

## 구조 한 장
- 필수 검사 4종(`checks`·`guard`·`app-screen`·`migration-postgres`)은 그대로.
- 새로 검사 전용 앱(`viecganban-checks`)이 만드는 검사 2개: `ai-review`(독립 검토 완료·지적 답 있음), `approval-gate`(위험도 판정 + 고위험은 4대 보고 + Lee 공식 Approve).
- 만드는 곳: `.github/workflows/approval-checks.yml` → `scripts/ci/approval-checks.mjs` (master 사본만, PR 코드 안 받음·안 돌림).
- (2026-11-16 변경) Claude 앱 토큰 교환은 checks:write를 내주지 않음(run 43797922253 401) → 검사 전용 GitHub 앱(Checks 쓰기만, jobi-app만 설치)으로 올린다. 앱 열쇠는 기존 운영 열쇠 환경 `ops-keys`(배포 브랜치 master만, secret-isolation R8)의 비밀값에만 → PR 브랜치 워크플로·AI 작업은 열쇠를 못 꺼내 같은 이름의 통과 결과를 만들 수 없다. (GitHub Actions 앱이 만든 검사는 PR 쪽이 흉내 낼 수 있어 `출처 앱` 지정이 필요한 이유.)
- 검사 전용 앱 준비(대표님 설정): 앱 생성(Checks Read and write만, Webhook 끔) → jobi-app만 설치 → 기존 environment `ops-keys`에 비밀값 `APPROVAL_CHECKS_APP_KEY`·변수 `APPROVAL_CHECKS_APP_ID` 추가(새 환경 만들지 않음).

## 켜는 순서
1. 이 PR(#833) Lee 승인·병합. 병합 뒤 열린 PR 하나에서 `병합 조건 검사` 워크플로가 돌아 `ai-review`·`approval-gate`가 PR에 나타나는지 확인(Actions → 같은 이름 실행, 또는 `gh workflow run approval-checks.yml -f pr=<번호>`).
   - 안 나타나면 3번 설정을 하지 말 것(필수로 지정하면 모든 PR이 영구 대기).
2. 두 검사가 최소 한 번 나타난 뒤에만: Settings → Branches → `master` 규칙 → **Require status checks to pass** → 검사 검색창에 `ai-review` 입력 → 오른쪽 출처 드롭다운에서 **viecganban-checks** 선택 → 추가. `approval-gate`도 같게.
   - 기존 `checks`·`guard`·`app-screen`(출처 GitHub Actions)은 건드리지 않는다.
   - 같은 화면의 "Do not allow bypassing the above settings"(관리자도 따름)는 선택: 켜면 Lee 계정(관리자)도 우회 못 함. 지금은 enforcement=non_admins.
3. (선택) Ruleset: 위 2번만으로 쓰기 권한 계정(viecganban-bot·PR 브랜치 GITHUB_TOKEN)은 두 검사 없이 병합할 수 없다. 병합 실행을 한 곳으로 더 좁히려면 Settings → Rules → Rulesets → New branch ruleset(대상 `master`, 집행 Active) → **Restrict updates** + 우회 목록에 Claude 앱만. 현재 Ruleset 0개. (2단계 별도 결정 — 병합기 열쇠를 Claude 앱으로 바꾸는 PR이 따로 필요.)
4. 봇 자동 병합(`bot-pr-automerge.yml`) 켜기는 1~2 검증 뒤 별도 승인.
   - **순서 주의(검토관 지적)**: `ai-review`는 Codex가 없을 때 Claude 검토관이 이 커밋을 검토해야 success가 되는데, 검토관을 부르는 곳은 봇 병합기(또는 수동 `claude-auto.yml` fallback_pr 실행)뿐이다. 봇이 꺼진 동안 2번(필수 지정)을 하면 Codex가 한도 초과·무응답인 PR은 검토관 요청이 안 나가 `ai-review`가 영원히 대기한다. 그래서 필수 지정 전에 둘 중 하나를 정한다: ① 봇을 먼저 켠다(대표님 결정) ② 필수 지정 뒤에는 PR마다 `gh api -X POST repos/<저장소>/actions/workflows/claude-auto.yml/dispatches -f ref=master -f 'inputs[fallback_pr]=<번호>'`를 수동 실행한다.

## 되돌리는 법
- 2번 되돌리기: master 규칙의 필수 검사 목록에서 `ai-review`·`approval-gate` 삭제(규칙 저장).
- 3번 되돌리기: Ruleset을 Disabled로 바꾸거나 삭제.
- 코드 되돌리기: #833 병합 커밋을 revert(검사 2개는 만들어지지 않고, 기존 4종 필수 검사는 그대로).

## 남는 한계(숨기지 않고 적음)
- **승인 철회 뒤에도 success가 남는 창**: Lee가 Approve를 철회하거나 변경 요청을 하면 `review-signal.yml` 신호가 끝난 뒤 `approval-checks.yml`이 master 사본으로 다시 판정한다(보통 1~2분, 봇 켜짐과 무관). 그 사이와, PR이 `review-signal.yml`을 지우거나 바꿔 신호가 안 오는 경우에는 5분 예약이 다시 판정할 때까지 이전 success가 남는다(최대 약 5분). `approval-checks.yml` 자체에는 리뷰 이벤트 트리거를 두지 않는다(PR 브랜치 사본이 돌 수 있어서).
- PR 본문(4대 보고)은 Approve 뒤에도 고칠 수 있다: Approve는 커밋 기준이라 본문 변경을 잡지 못한다. 완화: 본문 수정(`edited`) 때마다 판정이 다시 돌고 `approval-gate`가 갱신되지만, 이미 준 Approve는 유지된다.
- 리뷰 신호(`review-signal.yml`, `pull_request_review`)는 PR 브랜치 사본이 돌 수 있지만 권한이 없는 신호일 뿐이다 → 실제 판정은 `workflow_run`·5분 예약으로 늘 master 사본이 한다. 신호가 막혀도 최대 5분 지연.
- 위험 내용 판정은 패턴 목록(`CONTENT_SIGNALS`·`KNOWN_HOSTS`)이라 완벽하지 않다 → 목록에 없는 새 위험은 막지 못한다. 그래서 경로 판정(⑥ 일반 목록 밖 = 판단 불가)과 독립 검토가 함께 있다. 최근 병합 60건 재판정: 새로 막힌 건 2건(#797·#708, DB 권한 migration), 오탐 0건.

## 승인 취소(Dismiss) 즉시 차단 — 2026-11-15 최종 합의 반영
- **즉시 재검사**: Lee가 승인·승인 취소·변경 요청을 하면 `review-signal.yml`(권한 없는 신호)이 돌고, 끝나면 `approval-checks.yml`이 `workflow_run`(항상 master 사본)으로 깨어나 열린 PR 전체를 다시 판정해 `approval-gate`를 success → 차단(action_required/failure)으로 덮는다. 5분 예약은 보조 백업.
  - 한계: PR이 `review-signal.yml`을 지우거나 바꾸면 신호가 안 나간다 → 그 경우만 최대 5분(예약). 그런 PR은 `.github/` 변경이라 고위험이다.
- **병합 직전 재검증**: 봇 병합기는 병합 API를 부르기 바로 전에 리뷰·댓글·라벨·본문을 다시 받아 같은 판정기를 한 번 더 돌린다(승인 취소면 "병합 중단"). 봇이 꺼져 있으면 이 단계는 돌지 않는다.
- **GitHub 자체 보호 연계(실제 저장소 기준 확인, 설정은 바꾸지 않음)**: 저장소는 공개(public)·개인 계정 소유. 지금 master 보호는 `require_code_owner_reviews=true`, 승인 수 0, `dismiss_stale_reviews=true`, enforce_admins=false, Ruleset 0개. CODEOWNERS는 `/docs/decisions/`와 `/.github/CODEOWNERS`만 Lee 소유(결정 0003, `scripts/check-approval-scope.mjs`가 범위 고정).
  - 가능: CODEOWNERS에 고위험 경로(`/.github/`·`/scripts/ci/`·`/scripts/*-gate.mjs`·`/scripts/check-*.mjs`·`AGENTS.md`)를 Lee 소유로 추가하면 GitHub 자체가 병합 시점에 Lee 승인을 요구하고, 승인 취소는 즉시 반영된다(Actions 지연 없음). 소유자 없는 일반 경로는 승인이 필요 없어 일반 PR 자동 병합과 충돌하지 않는다. `/*` 기본 소유 + 일반 폴더만 소유자 비움 방식이면 "일반 목록 밖 = 판단 불가"도 GitHub이 강제한다.
  - 한계: ① 결정 0003("CODEOWNERS는 결정 문서만")과 `check-approval-scope.mjs`를 바꿔야 해서 **대표님 결정 필요**(코드가 임의로 안 바꿈). ② 경로만 본다 — 바뀐 줄 내용 위험(⑦)·4대 보고는 못 막으므로 approval-gate와 함께 쓴다. ③ PR 작성자 본인은 자기 PR을 승인할 수 없으므로 Lee 계정이 쓴 PR이 소유 경로를 바꾸면 관리자 우회(enforce_admins=false)로만 병합된다. ④ Ruleset 쪽 "경로 제한(push rule)"은 이 계정 플랜에서 가능한지 확인하지 못했다(미확인, 대표님 설정 화면에서 확인).
  - 결론: 일괄 대표 승인 1건 강제(승인 수 1)는 일반 PR 자동 병합을 막으므로 쓰지 않는다. 경로 한정 CODEOWNERS 확장이 유일한 "GitHub 자체" 결합안이며 결정 0003 개정이 선행 조건이다.
