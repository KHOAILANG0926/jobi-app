# S4 병합 조건 검사 — 대표님 GitHub 설정과 되돌리는 법 (2026-11-15, #808·#833)

코드는 GitHub 설정을 바꾸지 않는다. 아래는 대표님이 직접 켜는 항목이다. 순서를 지킬 것.

## 구조 한 장
- 필수 검사 4종(`checks`·`guard`·`app-screen`·`migration-postgres`)은 그대로.
- 새로 Claude 앱이 만드는 검사 2개: `ai-review`(독립 검토 완료·지적 답 있음), `approval-gate`(위험도 판정 + 고위험은 4대 보고 + Lee 공식 Approve).
- 만드는 곳: `.github/workflows/approval-checks.yml` → `scripts/ci/approval-checks.mjs` (master 사본만, PR 코드 안 받음·안 돌림).
- Claude 앱 토큰은 master 워크플로에만 발급(OIDC 교환) → PR 브랜치 워크플로는 같은 이름의 통과 결과를 만들 수 없다. (GitHub Actions 앱이 만든 검사는 PR 쪽이 흉내 낼 수 있어 `출처 앱` 지정이 필요한 이유.)
- Claude 앱의 검사 생성 권한: 공개 앱 정보상 `checks: write` 있음(2026-11-15 `gh api apps/claude` 확인). **이 저장소 설치본에서 실제로 만들어지는지는 이 PR 병합 뒤 첫 실행으로 확인**(실행 로그 `approval-checks` 잡).

## 켜는 순서
1. 이 PR(#833) Lee 승인·병합. 병합 뒤 열린 PR 하나에서 `병합 조건 검사` 워크플로가 돌아 `ai-review`·`approval-gate`가 PR에 나타나는지 확인(Actions → 같은 이름 실행, 또는 `gh workflow run approval-checks.yml -f pr=<번호>`).
   - 안 나타나면 3번 설정을 하지 말 것(필수로 지정하면 모든 PR이 영구 대기).
2. 두 검사가 최소 한 번 나타난 뒤에만: Settings → Branches → `master` 규칙 → **Require status checks to pass** → 검사 검색창에 `ai-review` 입력 → 오른쪽 출처 드롭다운에서 **Claude** 선택 → 추가. `approval-gate`도 같게.
   - 기존 `checks`·`guard`·`app-screen`(출처 GitHub Actions)은 건드리지 않는다.
   - 같은 화면의 "Do not allow bypassing the above settings"(관리자도 따름)는 선택: 켜면 Lee 계정(관리자)도 우회 못 함. 지금은 enforcement=non_admins.
3. (선택) Ruleset: 위 2번만으로 쓰기 권한 계정(viecganban-bot·PR 브랜치 GITHUB_TOKEN)은 두 검사 없이 병합할 수 없다. 병합 실행을 한 곳으로 더 좁히려면 Settings → Rules → Rulesets → New branch ruleset(대상 `master`, 집행 Active) → **Restrict updates** + 우회 목록에 Claude 앱만. 현재 Ruleset 0개. (2단계 별도 결정 — 병합기 열쇠를 Claude 앱으로 바꾸는 PR이 따로 필요.)
4. 봇 자동 병합(`bot-pr-automerge.yml`) 켜기는 1~2 검증 뒤 별도 승인.

## 되돌리는 법
- 2번 되돌리기: master 규칙의 필수 검사 목록에서 `ai-review`·`approval-gate` 삭제(규칙 저장).
- 3번 되돌리기: Ruleset을 Disabled로 바꾸거나 삭제.
- 코드 되돌리기: #833 병합 커밋을 revert(검사 2개는 만들어지지 않고, 기존 4종 필수 검사는 그대로).

## 남는 한계(숨기지 않고 적음)
- PR 본문(4대 보고)은 Approve 뒤에도 고칠 수 있다: Approve는 커밋 기준이라 본문 변경을 잡지 못한다. 완화: 본문 수정(`edited`) 때마다 판정이 다시 돌고 `approval-gate`가 갱신되지만, 이미 준 Approve는 유지된다.
- `pull_request_review` 트리거는 PR 브랜치 사본이 돌 수 있어 그 PR이 `approval-checks.yml`을 바꾸면 토큰을 못 받는다 → 15분 예약 실행(master 사본)이 다시 판정한다. 최대 15분 지연.
- 위험 내용 판정은 패턴 목록(`CONTENT_SIGNALS`·`KNOWN_HOSTS`)이라 완벽하지 않다 → 목록에 없는 새 위험은 막지 못한다. 그래서 경로 판정(⑥ 일반 목록 밖 = 판단 불가)과 독립 검토가 함께 있다. 최근 병합 60건 재판정: 새로 막힌 건 2건(#797·#708, DB 권한 migration), 오탐 0건.
